namespace Saxovat.Application.Contracts;
using System.Text.Json.Serialization;

public sealed record AuditLogResponse(
    string Id,
    string ActorName,
    string Action,
    string EntityType,
    string? EntityId,
    string Description,
    DateTime CreatedAt);

public sealed record AuditLogQuery(
    [property: JsonPropertyName("entityType")] string? EntityType = null,
    [property: JsonPropertyName("actorId")] string? ActorId = null,
    [property: JsonPropertyName("from")] DateTime? From = null,
    [property: JsonPropertyName("to")] DateTime? To = null,
    [property: JsonPropertyName("search")] string? Search = null,
    [property: JsonPropertyName("page")] int Page = 1,
    [property: JsonPropertyName("pageSize")] int PageSize = 20);
