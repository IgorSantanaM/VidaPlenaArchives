using Google.Cloud.Storage.V1;
using VidaPlenaArchives.WebApi.Endpoints;
using VidaPlenaArchives.WebApi.Storage;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddOptions<GoogleStorageOptions>()
    .BindConfiguration(GoogleStorageOptions.SectionName)
    .Validate(options => !string.IsNullOrWhiteSpace(options.BucketName), "GoogleStorage:BucketName is required.")
    .Validate(options => options.HasValidCdnUrl(), "GoogleStorage:CdnBaseUrl must be an HTTPS origin without a port, path, query or fragment.")
    .Validate(options => options.HasValidSigningKey(), "GoogleStorage requires a CDN key name and a base64url-encoded 16-byte signing key.")
    .Validate(options => options.SignedUrlMinutes is >= 1 and <= 60, "SignedUrlMinutes must be between 1 and 60.")
    .ValidateOnStart();

builder.Services.AddSingleton(_ => StorageClient.Create());
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IArchiveStorage, ArchiveStorage>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseExceptionHandler();

app.UseHttpsRedirection();

app.MapArchiveEndpoints();

app.Run();
