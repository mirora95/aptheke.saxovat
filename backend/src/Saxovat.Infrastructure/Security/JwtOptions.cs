namespace Saxovat.Infrastructure.Security;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "Saxovat.API";
    public string Audience { get; set; } = "Saxovat.Frontend";
    public string Key { get; set; } = "super-secret-development-key-change-in-production";
    public int AccessTokenMinutes { get; set; } = 60;
    public int RefreshTokenDays { get; set; } = 7;
}
