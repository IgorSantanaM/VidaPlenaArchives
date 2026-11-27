using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Google;
using Google.Api.Gax;
using Google.Apis.Download;
using Google.Apis.Storage.v1.Data;
using Google.Apis.Upload;
using Google.Cloud.Storage.V1;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using VidaPlenaArchives.WebApi.Storage;
using StorageObject = Google.Apis.Storage.v1.Data.Object;

namespace VidaPlenaArchives.WebApi.Tests;

public class ArchiveApiTests
{
    [Fact]
    public async Task UploadListDetailsAndContentWorkWithoutCdnSettings()
    {
        await using var app = new ArchiveApi();
        using var client = app.CreateClient();
        byte[] bytes = [0, 1, 2, 128, 255];
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new("application/pdf");
        form.Add(file, "file", "exame.pdf");
        form.Add(new StringContent("30"), "days");

        using var uploaded = await client.PostAsync("/api/archives/archive", form);
        Assert.Equal(HttpStatusCode.Created, uploaded.StatusCode);
        var document = (await uploaded.Content.ReadFromJsonAsync<ArchiveDocument>())!;
        Assert.Equal($"/api/archives/{document.Id}/content", document.Url);
        Assert.Equal(app.Clock.Now.AddDays(30), document.ExpiresAt);
        Assert.Equal(0, app.Storage.UploadOptions!.IfGenerationMatch);
        Assert.Equal(document.ExpiresAt, app.Storage.Objects.Values.Single().CustomTimeDateTimeOffset);
        Assert.Equal("no-store", uploaded.Headers.CacheControl!.ToString());

        var details = await client.GetFromJsonAsync<ArchiveDocument>(uploaded.Headers.Location);
        Assert.Equal(document, details);
        var listing = (await client.GetFromJsonAsync<ArchivePage>("/api/archives/?pageSize=20"))!;
        Assert.Equal(document, Assert.Single(listing.Documents));

        using var content = await client.GetAsync(document.Url);
        Assert.Equal(HttpStatusCode.OK, content.StatusCode);
        Assert.Null(content.Headers.Location);
        Assert.Equal(bytes, await content.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/pdf", content.Content.Headers.ContentType!.MediaType);
        Assert.Equal("inline", content.Content.Headers.ContentDisposition!.DispositionType);
        Assert.Equal("exame.pdf", content.Content.Headers.ContentDisposition.FileNameStar);
        Assert.Equal("no-store", content.Headers.CacheControl!.ToString());
        Assert.Equal("nosniff", Assert.Single(content.Headers.GetValues("X-Content-Type-Options")));
        Assert.Equal(1, app.Storage.DownloadOptions!.IfGenerationMatch);
        Assert.Equal(1, app.Storage.DownloadOptions.IfMetagenerationMatch);
    }

    [Theory]
    [InlineData("application/pdf", "inline")]
    [InlineData("image/png", "inline")]
    [InlineData("text/plain; charset=utf-8", "inline")]
    [InlineData("text/html", "attachment")]
    [InlineData("image/svg+xml", "attachment")]
    [InlineData("application/octet-stream", "attachment")]
    public async Task ContentUsesSafeDispositionAndPreservesUnicodeNames(string contentType, string disposition)
    {
        await using var app = new ArchiveApi();
        var id = app.AddDocument(contentType: contentType, fileName: "exame coração.pdf");
        using var response = await app.CreateClient().GetAsync($"/api/archives/{id}/content");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(disposition, response.Content.Headers.ContentDisposition!.DispositionType);
        Assert.Equal("exame coração.pdf", response.Content.Headers.ContentDisposition.FileNameStar);
    }

    [Fact]
    public async Task ContentSupportsRangesAndRejectsUnsatisfiableRanges()
    {
        await using var app = new ArchiveApi();
        var id = app.AddDocument(bytes: [10, 20, 30, 40]);
        using var client = app.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/archives/{id}/content");
        request.Headers.Range = new(1, 2);
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.PartialContent, response.StatusCode);
        Assert.Equal(new byte[] { 20, 30 }, await response.Content.ReadAsByteArrayAsync());
        Assert.Equal("bytes 1-2/4", response.Content.Headers.ContentRange!.ToString());

        using var invalid = new HttpRequestMessage(HttpMethod.Get, $"/api/archives/{id}/content");
        invalid.Headers.Range = new(20, 30);
        using var rejected = await client.SendAsync(invalid);
        Assert.Equal(HttpStatusCode.RequestedRangeNotSatisfiable, rejected.StatusCode);
    }

    [Fact]
    public async Task MissingExpiredAndInvalidMetadataDocumentsAreUnavailable()
    {
        await using var app = new ArchiveApi();
        var expired = app.AddDocument(expiresAt: app.Clock.Now);
        var invalid = app.AddDocument();
        app.Storage.Objects[$"documents/{invalid}"].Metadata.Clear();
        using var client = app.CreateClient();
        foreach (var id in new[] { Guid.NewGuid(), expired, invalid })
        {
            using var details = await client.GetAsync($"/api/archives/{id}");
            using var content = await client.GetAsync($"/api/archives/{id}/content");
            Assert.Equal(HttpStatusCode.NotFound, details.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, content.StatusCode);
        }
        var listing = (await client.GetFromJsonAsync<ArchivePage>("/api/archives/?pageSize=20"))!;
        Assert.Empty(listing.Documents);
        Assert.Equal(0, app.Storage.DownloadCount);
    }

    [Theory]
    [InlineData(404)]
    [InlineData(412)]
    public async Task DeletedOrChangedObjectsDuringDownloadReturn404(int statusCode)
    {
        await using var app = new ArchiveApi();
        var id = app.AddDocument();
        app.Storage.DownloadFailure = new GoogleApiException("storage", "Changed") { HttpStatusCode = (HttpStatusCode)statusCode };
        using var response = await app.CreateClient().GetAsync($"/api/archives/{id}/content");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.False(app.Storage.LastDestination!.CanRead);
    }

    [Fact]
    public async Task DocumentExpiringDuringDownloadReturns404()
    {
        await using var app = new ArchiveApi();
        var id = app.AddDocument(expiresAt: app.Clock.Now.AddSeconds(1));
        app.Storage.AfterDownload = () => app.Clock.Now = app.Clock.Now.AddSeconds(2);
        using var response = await app.CreateClient().GetAsync($"/api/archives/{id}/content");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.False(app.Storage.LastDestination!.CanRead);
    }

    [Theory]
    [InlineData(403)]
    [InlineData(500)]
    public async Task StorageFailuresReturnProblemDetailsAndDisposeTheBuffer(int statusCode)
    {
        await using var app = new ArchiveApi();
        var id = app.AddDocument();
        app.Storage.DownloadFailure = new GoogleApiException("storage", "internal-storage-diagnostic")
            { HttpStatusCode = (HttpStatusCode)statusCode };
        using var response = await app.CreateClient().GetAsync($"/api/archives/{id}/content");
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType!.MediaType);
        Assert.DoesNotContain("internal-storage-diagnostic", await response.Content.ReadAsStringAsync());
        Assert.False(app.Storage.LastDestination!.CanRead);
    }

    [Fact]
    public async Task CancelledDownloadsDisposeTheBufferAndPropagateCancellation()
    {
        await using var app = new ArchiveApi();
        var id = app.AddDocument();
        app.Storage.DownloadFailure = new OperationCanceledException();
        var storage = new ArchiveStorage(app.Storage,
            Microsoft.Extensions.Options.Options.Create(new GoogleStorageOptions { BucketName = "test-bucket" }), app.Clock);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => storage.DownloadAsync(id, CancellationToken.None));
        Assert.False(app.Storage.LastDestination!.CanRead);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(101)]
    public async Task InvalidPageSizeReturns400(int pageSize)
    {
        await using var app = new ArchiveApi();
        using var response = await app.CreateClient().GetAsync($"/api/archives/?pageSize={pageSize}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ListingWithoutPageSizeDefaultsTo20()
    {
        await using var app = new ArchiveApi();
        for (var index = 0; index < 25; index++) app.AddDocument();
        using var response = await app.CreateClient().GetAsync("/api/archives/");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var listing = (await response.Content.ReadFromJsonAsync<ArchivePage>())!;
        Assert.Equal(20, listing.Documents.Count);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(1, 0)]
    [InlineData(1, 36501)]
    [InlineData(20 * 1024 * 1024 + 1, 1)]
    public async Task InvalidUploadsReturn400WithoutWritingObjects(int byteCount, int days)
    {
        await using var app = new ArchiveApi();
        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(new byte[byteCount]), "file", "test.txt");
        form.Add(new StringContent(days.ToString(CultureInfo.InvariantCulture)), "days");
        using var response = await app.CreateClient().PostAsync("/api/archives/archive", form);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(app.Storage.Objects);
    }

    private sealed class ArchiveApi : WebApplicationFactory<Program>
    {
        public Clock Clock { get; } = new();
        public FakeStorageClient Storage { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?> { ["GoogleStorage:BucketName"] = "test-bucket" }));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<StorageClient>();
                services.AddSingleton<StorageClient>(Storage);
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(Clock);
            });
        }

        public Guid AddDocument(byte[]? bytes = null, string contentType = "application/pdf",
            string fileName = "test.pdf", DateTimeOffset? expiresAt = null)
        {
            var id = Guid.NewGuid();
            var name = $"documents/{id}";
            Storage.Objects[name] = new StorageObject
            {
                Name = name, Bucket = "test-bucket", ContentType = contentType,
                Size = (ulong)(bytes?.Length ?? 1), Generation = 1, Metageneration = 1,
                CustomTimeDateTimeOffset = expiresAt ?? Clock.Now.AddDays(1),
                Metadata = new Dictionary<string, string>
                {
                    ["file-name"] = fileName, ["uploaded-at"] = Clock.Now.ToString("O")
                }
            };
            Storage.Bytes[name] = bytes ?? [42];
            return id;
        }
    }

    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = DateTimeOffset.Parse("2026-11-27T12:00:00Z");
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class FakeStorageClient : StorageClient
    {
        public Dictionary<string, StorageObject> Objects { get; } = [];
        public Dictionary<string, byte[]> Bytes { get; } = [];
        public DownloadObjectOptions? DownloadOptions { get; private set; }
        public UploadObjectOptions? UploadOptions { get; private set; }
        public Exception? DownloadFailure { get; set; }
        public Action? AfterDownload { get; set; }
        public Stream? LastDestination { get; private set; }
        public int DownloadCount { get; private set; }

        public override Task<StorageObject> GetObjectAsync(string bucket, string objectName,
            GetObjectOptions? options = null, CancellationToken cancellationToken = default)
            => Objects.TryGetValue(objectName, out var value) ? Task.FromResult(value)
                : Task.FromException<StorageObject>(new GoogleApiException("storage", "Missing") { HttpStatusCode = HttpStatusCode.NotFound });

        public override async Task<StorageObject> DownloadObjectAsync(string bucket, string objectName,
            Stream destination, DownloadObjectOptions? options = null, CancellationToken cancellationToken = default,
            IProgress<IDownloadProgress>? progress = null)
        {
            DownloadCount++;
            DownloadOptions = options;
            LastDestination = destination;
            if (DownloadFailure is not null) throw DownloadFailure;
            await destination.WriteAsync(Bytes[objectName], cancellationToken);
            AfterDownload?.Invoke();
            return Objects[objectName];
        }

        public override async Task<StorageObject> UploadObjectAsync(StorageObject destination, Stream source,
            UploadObjectOptions? options = null, CancellationToken cancellationToken = default,
            IProgress<IUploadProgress>? progress = null)
        {
            UploadOptions = options;
            using var buffer = new MemoryStream();
            await source.CopyToAsync(buffer, cancellationToken);
            Bytes[destination.Name] = buffer.ToArray();
            destination.Size = (ulong)buffer.Length;
            destination.Generation = 1;
            destination.Metageneration = 1;
            Objects[destination.Name] = destination;
            return destination;
        }

        public override PagedAsyncEnumerable<Objects, StorageObject> ListObjectsAsync(string bucket,
            string? prefix = null, ListObjectsOptions? options = null)
            => new ObjectPage(Objects.Values.Where(obj => obj.Name.StartsWith(prefix ?? "")).ToArray());
    }

    private sealed class ObjectPage(StorageObject[] objects) : PagedAsyncEnumerable<Objects, StorageObject>
    {
        public override Task<Page<StorageObject>> ReadPageAsync(int pageSize, CancellationToken cancellationToken = default)
            => Task.FromResult(new Page<StorageObject>(objects.Take(pageSize), null));
        public override IAsyncEnumerable<Objects> AsRawResponses() => throw new NotSupportedException();
        public override IAsyncEnumerator<StorageObject> GetAsyncEnumerator(CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }
}
