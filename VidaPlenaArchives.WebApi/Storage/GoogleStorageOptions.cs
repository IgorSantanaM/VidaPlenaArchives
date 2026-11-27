namespace VidaPlenaArchives.WebApi.Storage;

public sealed class GoogleStorageOptions
{
    public static string SectionName => "GoogleStorage";
    public string BucketName { get; set; } = "";
}
