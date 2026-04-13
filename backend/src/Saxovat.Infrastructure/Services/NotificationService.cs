using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class NotificationService(SaxovatDbContext dbContext) : INotificationService
{
    public async Task<ApiListResponse<NotificationResponse>> GetNotificationsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var notifications = await dbContext.Notifications
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        return new ApiListResponse<NotificationResponse>(notifications.Select(x => x.ToResponse()).ToArray(), notifications.Count);
    }

    public async Task<NotificationResponse> MarkAsReadAsync(string id, Guid userId, CancellationToken cancellationToken = default)
    {
        var notificationId = MappingExtensions.ParseGuid(id, "Notification id");
        var notification = await dbContext.Notifications.SingleOrDefaultAsync(x => x.Id == notificationId, cancellationToken)
            ?? throw new NotFoundAppException("Notification", id);

        if (notification.UserId != userId)
        {
            throw new ForbiddenAppException("You do not have access to this notification");
        }

        notification.IsRead = true;
        await dbContext.SaveChangesAsync(cancellationToken);
        return notification.ToResponse();
    }

    internal async Task AddForUserAsync(
        Guid userId,
        NotificationType type,
        string title,
        string message,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = type,
            Title = title,
            Message = message,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            CreatedAt = DateTime.UtcNow,
        });

        await Task.CompletedTask;
    }

    internal async Task AddForRolesAsync(
        IEnumerable<UserRole> roles,
        NotificationType type,
        string title,
        string message,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default)
    {
        var roleList = roles.Distinct().ToArray();
        if (roleList.Length == 0)
        {
            return;
        }

        var userIds = await dbContext.Users
            .Where(x => x.IsActive && roleList.Contains(x.Role))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        foreach (var userId in userIds)
        {
            dbContext.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = type,
                Title = title,
                Message = message,
                RelatedEntityType = relatedEntityType,
                RelatedEntityId = relatedEntityId,
                CreatedAt = DateTime.UtcNow,
            });
        }
    }
}
