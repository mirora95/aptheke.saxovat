using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class UserService(
    SaxovatDbContext dbContext,
    IPasswordHasherService passwordHasher,
    AuditLogWriter auditLogWriter,
    NotificationService notificationService) : IUserService
{
    public async Task<ApiListResponse<UserResponse>> GetUsersAsync(GetUsersQuery query, CancellationToken cancellationToken = default)
    {
        var usersQuery = dbContext.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Role))
        {
            var role = MappingExtensions.ParseUserRole(query.Role);
            usersQuery = usersQuery.Where(x => x.Role == role);
        }

        if (query.IsActive.HasValue)
        {
            usersQuery = usersQuery.Where(x => x.IsActive == query.IsActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            usersQuery = usersQuery.Where(x =>
                x.FullName.ToLower().Contains(search) ||
                x.Email.ToLower().Contains(search) ||
                x.Phone.ToLower().Contains(search));
        }

        var users = await usersQuery.OrderBy(x => x.FullName).ToListAsync(cancellationToken);
        return new ApiListResponse<UserResponse>(users.Select(x => x.ToResponse()).ToArray(), users.Count);
    }

    public async Task<ApiListResponse<UserResponse>> GetPharmacistsAsync(CancellationToken cancellationToken = default)
    {
        var pharmacists = await dbContext.Users.AsNoTracking()
            .Where(x => x.Role == UserRole.Pharmacist)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        return new ApiListResponse<UserResponse>(pharmacists.Select(x => x.ToResponse()).ToArray(), pharmacists.Count);
    }

    public async Task<UserResponse?> GetUserByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var parsedId = MappingExtensions.ParseGuid(id, "User id");
        var user = await dbContext.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == parsedId, cancellationToken);
        return user?.ToResponse();
    }

    public async Task<UserResponse> CreatePharmacistAsync(CreatePharmacistRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var exists = await dbContext.Users.AnyAsync(x => x.Email.ToLower() == email, cancellationToken);
        if (exists)
        {
            throw new ConflictAppException("A user with this email already exists");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName.Trim(),
            Email = email,
            Phone = request.Phone.Trim(),
            PasswordHash = passwordHasher.HashPassword(string.IsNullOrWhiteSpace(request.Password) ? "password" : request.Password.Trim()),
            Role = UserRole.Pharmacist,
            Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
            Balance = 0m,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
        };

        dbContext.Users.Add(user);
        await auditLogWriter.WriteAsync(
            actorUserId,
            "PHARMACIST_CREATED",
            "User",
            user.Id.ToString(),
            $"Pharmacist account created for {user.FullName}",
            new { user.Email, user.Phone, user.IsActive },
            cancellationToken);
        await notificationService.AddForUserAsync(
            user.Id,
            NotificationType.System,
            "Pharmacist account ready",
            "Your pharmacist account has been created and is ready to use.",
            "User",
            user.Id.ToString(),
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return user.ToResponse();
    }

    public async Task<UserResponse> UpdatePharmacistAsync(string id, UpdateUserRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        var userId = MappingExtensions.ParseGuid(id, "Pharmacist id");
        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new NotFoundAppException("User", id);

        if (user.Role != UserRole.Pharmacist)
        {
            throw new ValidationAppException("Target user is not a pharmacist");
        }

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var duplicateEmail = await dbContext.Users.AnyAsync(x => x.Id != userId && x.Email.ToLower() == email, cancellationToken);
            if (duplicateEmail)
            {
                throw new ConflictAppException("A user with this email already exists");
            }

            user.Email = email;
        }

        if (!string.IsNullOrWhiteSpace(request.FullName)) user.FullName = request.FullName.Trim();
        if (!string.IsNullOrWhiteSpace(request.Phone)) user.Phone = request.Phone.Trim();
        if (!string.IsNullOrWhiteSpace(request.Password)) user.PasswordHash = passwordHasher.HashPassword(request.Password.Trim());
        if (request.Address is not null) user.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        if (request.IsActive.HasValue) user.IsActive = request.IsActive.Value;

        await auditLogWriter.WriteAsync(
            actorUserId,
            "PHARMACIST_UPDATED",
            "User",
            user.Id.ToString(),
            $"Pharmacist account updated for {user.FullName}",
            new { user.Email, user.Phone, user.IsActive },
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return user.ToResponse();
    }

    public async Task<UserResponse> UpdateUserStatusAsync(string id, UpdateUserStatusRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        var userId = MappingExtensions.ParseGuid(id, "User id");
        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new NotFoundAppException("User", id);

        if (user.Role == UserRole.SuperAdmin && !request.IsActive)
        {
            throw new ValidationAppException("SuperAdmin cannot be deactivated");
        }

        user.IsActive = request.IsActive;
        await auditLogWriter.WriteAsync(
            actorUserId,
            "USER_STATUS_UPDATED",
            "User",
            user.Id.ToString(),
            $"User {user.FullName} was {(request.IsActive ? "activated" : "deactivated")}",
            new { user.Role, user.IsActive },
            cancellationToken);
        await notificationService.AddForUserAsync(
            user.Id,
            NotificationType.System,
            "Account status updated",
            $"Your account is now {(request.IsActive ? "active" : "inactive")}.",
            "User",
            user.Id.ToString(),
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return user.ToResponse();
    }

    public async Task<UserResponse> TopUpBalanceAsync(
        string id,
        TopUpBalanceRequest request,
        Guid actorUserId,
        UserRole actorRole,
        CancellationToken cancellationToken = default)
    {
        var userId = MappingExtensions.ParseGuid(id, "User id");

        if (actorRole != UserRole.SuperAdmin && actorRole != UserRole.Customer)
        {
            throw new ForbiddenAppException("Only customers and superadmin can top up balances");
        }

        if (actorRole == UserRole.Customer && userId != actorUserId)
        {
            throw new ForbiddenAppException("Customers can only top up their own balance");
        }

        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new NotFoundAppException("User", id);

        if (request.Amount <= 0m)
        {
            throw new ValidationAppException("Top-up amount must be greater than zero");
        }

        user.Balance += request.Amount;

        await auditLogWriter.WriteAsync(
            actorUserId,
            "BALANCE_TOP_UP",
            "User",
            user.Id.ToString(),
            $"Balance top-up applied for {user.FullName}",
            new { request.Amount, user.Balance, request.Note },
            cancellationToken);

        await notificationService.AddForUserAsync(
            user.Id,
            NotificationType.Payment,
            "Balance updated",
            $"Your account balance was increased by {request.Amount:0.00}. Current balance: {user.Balance:0.00}.",
            "User",
            user.Id.ToString(),
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        return user.ToResponse();
    }

    public async Task<UserResponse> ResetPasswordAsync(string id, ResetPasswordRequest request, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var userId = MappingExtensions.ParseGuid(id, "User id");
        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new NotFoundAppException("User", id);

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            throw new ValidationAppException("Password must be at least 6 characters");

        user.PasswordHash = passwordHasher.HashPassword(request.NewPassword);
        await auditLogWriter.WriteAsync(
            actorUserId,
            "PASSWORD_RESET",
            "User",
            user.Id.ToString(),
            $"Password was reset for {user.FullName}",
            new { user.Email },
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return user.ToResponse();
    }
}
