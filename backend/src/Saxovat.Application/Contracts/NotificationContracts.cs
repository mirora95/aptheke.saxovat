namespace Saxovat.Application.Contracts;

public record NotificationResponse(
    string Id,
    string UserId,
    string Type,
    string Title,
    string Message,
    string? RelatedEntityType,
    string? RelatedEntityId,
    bool IsRead,
    string CreatedAt);
