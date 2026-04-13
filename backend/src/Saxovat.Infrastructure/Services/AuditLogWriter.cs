using System.Text.Json;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class AuditLogWriter(SaxovatDbContext dbContext)
{
    public Task WriteAsync(
        Guid? actorUserId,
        string action,
        string entityType,
        string? entityId,
        string description,
        object? metadata = null,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorUserId = actorUserId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Description = description,
            MetadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata),
            CreatedAt = DateTime.UtcNow,
        });

        return Task.CompletedTask;
    }
}
