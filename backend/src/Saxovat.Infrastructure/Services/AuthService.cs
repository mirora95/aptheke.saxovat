using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class AuthService(
    SaxovatDbContext dbContext,
    IPasswordHasherService passwordHasher,
    IJwtTokenGenerator jwtTokenGenerator) : IAuthService
{
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
        return new LoginResponse(new AuthSessionResponse(user.ToResponse(), tokens));
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
}
