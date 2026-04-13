using System.ComponentModel.DataAnnotations;

namespace Saxovat.Application.Contracts;

public record AuthTokensResponse(
    string AccessToken,
    string? RefreshToken,
    string TokenType,
    string? ExpiresAt);

public record AuthSessionResponse(
    UserResponse User,
    AuthTokensResponse Tokens);

public record LoginResponse(AuthSessionResponse Session);

public record CurrentUserResponse(UserResponse User);

public sealed class LoginRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}
