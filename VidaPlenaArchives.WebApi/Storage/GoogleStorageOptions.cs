using System.Text.RegularExpressions;

namespace VidaPlenaArchives.WebApi.Storage;

public sealed class GoogleStorageOptions
{
    public static string SectionName => "GoogleStorage";
    public string BucketName { get; set; } = "";
    public string CdnBaseUrl { get; set; } = "";
    public string CdnKeyName { get; set; } = "";
    public string CdnSigningKey { get; set; } = "";
    public int SignedUrlMinutes { get; set; } = 15;

    public bool HasValidCdnUrl() => Uri.TryCreate(CdnBaseUrl, UriKind.Absolute, out var uri)
        && uri.Scheme == "https" && uri.IsDefaultPort && uri.UserInfo.Length == 0
        && uri.AbsolutePath == "/" && uri.Query.Length == 0 && uri.Fragment.Length == 0
        && !CdnBaseUrl.AsSpan("https://".Length).Contains(':');

    public bool HasValidSigningKey()
    {
        if (!Regex.IsMatch(CdnKeyName, "^[A-Za-z0-9_-]{1,63}$"))
            return false;
        try
        {
            return DecodeSigningKey().Length == 16;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    public byte[] DecodeSigningKey() => Convert.FromBase64String(
        CdnSigningKey.Replace('-', '+').Replace('_', '/').PadRight((CdnSigningKey.Length + 3) / 4 * 4, '='));
}
