using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using Google;
using Google.Cloud.Storage.V1;
using Microsoft.Extensions.Options;
using StorageObject = Google.Apis.Storage.v1.Data.Object;

namespace VidaPlenaArchives.WebApi.Storage;

public sealed class ArchiveStorage(StorageClient client, IOptions<GoogleStorageOptions> options, TimeProvider clock) : IArchiveStorage
{
    private const string Prefix = "documents/";
    private readonly GoogleStorageOptions settings = options.Value;

    public async Task<ArchiveDocument> UploadAsync(IFormFile file, string fileName, int days,
        CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var document = new StorageObject
        {
            Bucket = settings.BucketName,
            Name = $"{Prefix}{Guid.NewGuid():D}",
            ContentType = MediaTypeHeaderValue.TryParse(file.ContentType, out var contentType)
                ? contentType.ToString() : "application/octet-stream",
            ContentDisposition = new ContentDispositionHeaderValue("inline") { FileNameStar = fileName }.ToString(),
            CacheControl = "private, no-store",
            // One bucket lifecycle rule deletes objects after their individual expiry.
            CustomTimeDateTimeOffset = now.AddDays(days),
            Metadata = new Dictionary<string, string>
            {
                ["file-name"] = fileName,
                ["uploaded-at"] = now.ToString("O", CultureInfo.InvariantCulture)
            }
        };

        await using var stream = file.OpenReadStream();
        var uploaded = await client.UploadObjectAsync(document, stream,
            new UploadObjectOptions { IfGenerationMatch = 0 }, cancellationToken);
        return ToDocument(uploaded, clock.GetUtcNow())
            ?? throw new InvalidOperationException("Uploaded document metadata is incomplete or expired.");
    }

    public async Task<ArchiveDocument?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var document = await client.GetObjectAsync(settings.BucketName, $"{Prefix}{id:D}",
                cancellationToken: cancellationToken);
            return ToDocument(document, clock.GetUtcNow());
        }
        catch (GoogleApiException exception) when (exception.HttpStatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<ArchiveContent?> DownloadAsync(Guid id, CancellationToken cancellationToken)
    {
        var content = new MemoryStream();
        try
        {
            var stored = await client.GetObjectAsync(settings.BucketName, $"{Prefix}{id:D}",
                cancellationToken: cancellationToken);
            var document = ToDocument(stored, clock.GetUtcNow());
            if (document is null)
            {
                content.Dispose();
                return null;
            }

            // Buffer before sending headers so missing/changed objects return 404.
            // The seekable stream also supports browser range requests for PDFs.
            await client.DownloadObjectAsync(settings.BucketName, stored.Name, content,
                new DownloadObjectOptions
                {
                    IfGenerationMatch = stored.Generation,
                    IfMetagenerationMatch = stored.Metageneration
                }, cancellationToken);

            if (document.ExpiresAt <= clock.GetUtcNow())
            {
                content.Dispose();
                return null;
            }

            content.Position = 0;
            return new ArchiveContent(document, content);
        }
        catch (GoogleApiException exception) when (exception.HttpStatusCode is
            HttpStatusCode.NotFound or HttpStatusCode.PreconditionFailed)
        {
            content.Dispose();
            return null;
        }
        catch
        {
            content.Dispose();
            throw;
        }
    }

    public async Task<ArchivePage> ListAsync(int pageSize, string? pageToken, CancellationToken cancellationToken)
    {
        var page = await client.ListObjectsAsync(settings.BucketName, Prefix,
            new ListObjectsOptions { PageSize = pageSize, PageToken = pageToken })
            .ReadPageAsync(pageSize, cancellationToken);
        var now = clock.GetUtcNow();
        var documents = page.Select(item => ToDocument(item, now))
            .OfType<ArchiveDocument>().ToList();
        return new ArchivePage(documents, page.NextPageToken);
    }

    private ArchiveDocument? ToDocument(StorageObject document, DateTimeOffset now)
    {
        if (!document.Name.StartsWith(Prefix, StringComparison.Ordinal)
            || !Guid.TryParse(document.Name[Prefix.Length..], out var id)
            || document.CustomTimeDateTimeOffset is not { } expiresAt
            || expiresAt.ToUnixTimeSeconds() <= now.ToUnixTimeSeconds()
            || document.Metadata is null
            || !document.Metadata.TryGetValue("file-name", out var fileName)
            || !document.Metadata.TryGetValue("uploaded-at", out var uploadedAtText)
            || !DateTimeOffset.TryParse(uploadedAtText, CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind, out var uploadedAt))
            return null;

        var contentType = MediaTypeHeaderValue.TryParse(document.ContentType, out var parsedType)
            ? parsedType.ToString() : "application/octet-stream";
        return new ArchiveDocument(id, fileName, contentType, document.Size ?? 0,
            uploadedAt, expiresAt, $"/api/archives/{id:D}/content");
    }
}
