namespace Saxovat.Application.Common;

public record ApiFieldError(string? Field, string Message);

public record ApiErrorResponse(
    string Code,
    string Message,
    IReadOnlyCollection<ApiFieldError>? FieldErrors = null,
    string? TraceId = null);

public record ApiListResponse<T>(IReadOnlyCollection<T> Items, int Total);
