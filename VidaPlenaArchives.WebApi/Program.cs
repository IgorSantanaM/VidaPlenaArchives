using Google.Cloud.Storage.V1;
using VidaPlenaArchives.WebApi.Endpoints;
using VidaPlenaArchives.WebApi.Storage;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddOptions<GoogleStorageOptions>()
    .BindConfiguration(GoogleStorageOptions.SectionName)
    .Validate(options => !string.IsNullOrWhiteSpace(options.BucketName), "GoogleStorage:BucketName is required.")
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

public partial class Program;
