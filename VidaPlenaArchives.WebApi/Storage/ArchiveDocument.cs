namespace VidaPlenaArchives.WebApi.Storage;

public sealed record ArchiveDocument(Guid Id, string FileName, string ContentType, ulong Size,
    DateTimeOffset UploadedAt, DateTimeOffset ExpiresAt, string Url);

public sealed record ArchiveContent(ArchiveDocument Document, Stream Content);

public sealed record ArchivePage(IReadOnlyList<ArchiveDocument> Documents, string? NextPageToken);
