using Microsoft.AspNetCore.Mvc;
using VidaPlenaArchives.WebApi.Storage;

namespace VidaPlenaArchives.WebApi.Endpoints;

public static class ArchiveEndpoints
{
    public const long MaxFileBytes = 20 * 1024 * 1024;

    public static void MapArchiveEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/archives").WithTags("Archives");

        group.MapPost("/archive", HandleUploadAsync)
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(MaxFileBytes + 1024 * 1024))
            .Produces<ArchiveDocument>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        group.MapGet("/", HandleListAsync);

        group.MapGet("/{id:guid}",HandleGetByIdAsync);

        group.MapGet("/{id:guid}/content", HandleGetContentByIdAsync);
    }

    #region Handlers
    private static async Task<IResult> HandleUploadAsync([FromForm] IFormFile file, [FromForm] int days,
        IArchiveStorage storage, HttpResponse response, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (file.Length is <= 0 or > MaxFileBytes)
            errors["file"] = ["Provide a non-empty document of up to 20 MiB."];

        if (days is < 1 or > 36500)
            errors["days"] = ["Days must be between 1 and 36500."];

        var fileName = Path.GetFileName(file.FileName.Replace('\\', '/'));

        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > 255 || fileName.Any(char.IsControl))
            errors["file"] = ["Provide a file name of up to 255 characters without control characters."];

        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        response.Headers.CacheControl = "no-store";

        var document = await storage.UploadAsync(file, fileName, days, cancellationToken);

        return Results.Created($"/api/archives/{document.Id}", document);
    }

    private static async Task<IResult> HandleListAsync(IArchiveStorage storage, HttpResponse response,
        int pageSize, string? pageToken, CancellationToken cancellationToken)
    {
        response.Headers.CacheControl = "no-store";
        if (pageSize is < 1 or > 100)
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["pageSize"] = ["Page size must be between 1 and 100."]
            });
        return Results.Ok(await storage.ListAsync(pageSize, pageToken, cancellationToken));
    }

    private static async Task<IResult> HandleGetByIdAsync(Guid id, IArchiveStorage storage, HttpResponse response,
        CancellationToken cancellationToken)
    {
        response.Headers.CacheControl = "no-store";
        var document = await storage.GetAsync(id, cancellationToken);
        return document is null ? Results.NotFound() : Results.Ok(document);
    }

    private static async Task<IResult> HandleGetContentByIdAsync(Guid id, IArchiveStorage storage,
        HttpResponse response, CancellationToken cancellationToken)
    {
        response.Headers.CacheControl = "no-store";
        var document = await storage.GetAsync(id, cancellationToken);
        return document is null ? Results.NotFound() : Results.Redirect(document.Url);
    }
    #endregion
}
