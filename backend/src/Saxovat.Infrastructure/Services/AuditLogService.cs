using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class AuditLogService(SaxovatDbContext dbContext) : IAuditLogService
{
    public async Task<ApiListResponse<AuditLogResponse>> GetAuditLogsAsync(AuditLogQuery query, CancellationToken cancellationToken = default)
    {
        var q = dbContext.AuditLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.EntityType))
            q = q.Where(x => x.EntityType == query.EntityType);
        if (!string.IsNullOrWhiteSpace(query.ActorId) && Guid.TryParse(query.ActorId, out var actorGuid))
            q = q.Where(x => x.ActorUserId == actorGuid);
        if (query.From.HasValue)
            q = q.Where(x => x.CreatedAt >= query.From.Value);
        if (query.To.HasValue)
            q = q.Where(x => x.CreatedAt <= query.To.Value);
        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.Description.Contains(query.Search) || x.Action.Contains(query.Search));

        var total = await q.CountAsync(cancellationToken);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip((query.Page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditLogResponse(
                x.Id.ToString(),
                x.ActorUser != null ? x.ActorUser.FullName : "System",
                x.Action,
                x.EntityType,
                x.EntityId,
                x.Description,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return new ApiListResponse<AuditLogResponse>(items, total);
    }
}
