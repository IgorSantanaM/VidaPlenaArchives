using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
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

        var urlExpiresAt = DateTimeOffset.FromUnixTimeSeconds(Math.Min(
            now.AddMinutes(settings.SignedUrlMinutes).ToUnixTimeSeconds(), expiresAt.ToUnixTimeSeconds()));
        var cdnOrigin = new Uri(settings.CdnBaseUrl).GetComponents(UriComponents.SchemeAndServer, UriFormat.UriEscaped);
        var url = $"{cdnOrigin}/{document.Name}"
            + $"?Expires={urlExpiresAt.ToUnixTimeSeconds()}&KeyName={settings.CdnKeyName}";
        var signature = HMACSHA1.HashData(settings.DecodeSigningKey(), Encoding.UTF8.GetBytes(url));
        var encodedSignature = Convert.ToBase64String(signature).Replace('+', '-').Replace('/', '_');

        return new ArchiveDocument(id, fileName, document.ContentType, document.Size ?? 0,
            uploadedAt, expiresAt, $"{url}&Signature={encodedSignature}", urlExpiresAt);
    }
}
