using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;
using Saxovat.Infrastructure.Security;

namespace Saxovat.Infrastructure.Services;

public sealed class AuthService(
    SaxovatDbContext dbContext,
    IPasswordHasherService passwordHasher,
    IJwtTokenGenerator jwtTokenGenerator,
    IOptions<JwtOptions> jwtOptions) : IAuthService
{
    private readonly JwtOptions _jwtOptions = jwtOptions.Value;

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Email.ToLower() == email, cancellationToken);

        if (user is null || !passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAppException("Invalid email or password");
        }

        if (!user.IsActive)
        {
            throw new ForbiddenAppException("Account is inactive");
        }

        var tokens = jwtTokenGenerator.GenerateTokens(user);
        var refreshToken = await GenerateRefreshToken(user.Id, cancellationToken);
        return new LoginResponse(new AuthSessionResponse(
            user.ToResponse(),
            tokens with { RefreshToken = refreshToken }));
    }

    public async Task<CurrentUserResponse> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new UnauthorizedAppException("Session is no longer valid");

        if (!user.IsActive)
        {
            throw new ForbiddenAppException("Account is inactive");
        }

        return new CurrentUserResponse(user.ToResponse());
    }

    public async Task<RefreshTokenResponse> RefreshTokenAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default)
    {
        var tokenHash = ComputeSha256Hash(request.RefreshToken);

        var affected = await dbContext.RefreshTokens
            .Where(x => x.TokenHash == tokenHash && !x.IsUsed && x.ExpiresAt > DateTime.UtcNow)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsUsed, true), cancellationToken);

        if (affected == 0)
            throw new UnauthorizedAppException("Invalid or expired refresh token");

        var storedToken = await dbContext.RefreshTokens
            .Include(x => x.User)
            .SingleAsync(x => x.TokenHash == tokenHash, cancellationToken);

        var tokens = jwtTokenGenerator.GenerateTokens(storedToken.User!);
        var newRefreshToken = await GenerateRefreshToken(storedToken.UserId, cancellationToken);

        return new RefreshTokenResponse(tokens with { RefreshToken = newRefreshToken });
    }

    public async Task<LoginResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var existingUser = await dbContext.Users.AnyAsync(x => x.Email.ToLower() == email, cancellationToken);
        if (existingUser)
        {
            throw new ValidationAppException("Email is already registered", [
                new ApiFieldError("Email", "A user with this email already exists"),
            ]);
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName,
            Email = email,
            Phone = request.Phone,
            PasswordHash = passwordHasher.HashPassword(request.Password),
            Role = UserRole.Customer,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        var tokens = jwtTokenGenerator.GenerateTokens(user);
        var refreshToken = await GenerateRefreshToken(user.Id, cancellationToken);

        return new LoginResponse(new AuthSessionResponse(
            user.ToResponse(),
            tokens with { RefreshToken = refreshToken }));
    }

    public async Task LogoutAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var activeTokens = await dbContext.RefreshTokens
            .Where(x => x.UserId == userId && !x.IsUsed)
            .ToListAsync(cancellationToken);

        foreach (var token in activeTokens)
        {
            token.IsUsed = true;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> GenerateRefreshToken(Guid userId, CancellationToken cancellationToken = default)
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        var rawToken = Convert.ToBase64String(randomBytes);
        var tokenHash = ComputeSha256Hash(rawToken);

        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(_jwtOptions.RefreshTokenDays),
            CreatedAt = DateTime.UtcNow,
        };

        dbContext.RefreshTokens.Add(refreshToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return rawToken;
    }

    private static string ComputeSha256Hash(string rawData)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawData));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
