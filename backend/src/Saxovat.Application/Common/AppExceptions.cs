namespace Saxovat.Application.Common;

public abstract class AppException : Exception
{
    protected AppException(string code, string message, int statusCode, IReadOnlyCollection<ApiFieldError>? fieldErrors = null)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        FieldErrors = fieldErrors;
    }

    public string Code { get; }
    public int StatusCode { get; }
    public IReadOnlyCollection<ApiFieldError>? FieldErrors { get; }
}

public sealed class ValidationAppException : AppException
{
    public ValidationAppException(string message, IReadOnlyCollection<ApiFieldError>? fieldErrors = null)
        : base("VALIDATION", message, 400, fieldErrors)
    {
    }
}

public sealed class NotFoundAppException : AppException
{
    public NotFoundAppException(string entity, string id)
        : base("NOT_FOUND", $"{entity} not found", 404)
    {
    }
}

public sealed class UnauthorizedAppException : AppException
{
    public UnauthorizedAppException(string message = "Unauthorized")
        : base("UNAUTHORIZED", message, 401)
    {
    }
}

public sealed class ForbiddenAppException : AppException
{
    public ForbiddenAppException(string message = "Forbidden")
        : base("FORBIDDEN", message, 403)
    {
    }
}

public sealed class ConflictAppException : AppException
{
    public ConflictAppException(string message)
        : base("CONFLICT", message, 409)
    {
    }
}
