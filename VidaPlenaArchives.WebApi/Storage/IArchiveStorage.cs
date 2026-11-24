namespace VidaPlenaArchives.WebApi.Storage
{
    public interface IArchiveStorage
    {
        Task<ArchiveDocument> UploadAsync(IFormFile file, string fileName, int days, CancellationToken cancellationToken);
        Task<ArchiveDocument?> GetAsync(Guid id, CancellationToken cancellationToken);
        Task<ArchivePage> ListAsync(int pageSize, string? pageToken, CancellationToken cancellationToken);

    }
}
