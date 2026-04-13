using Saxovat.Application.Common;

namespace Saxovat.API.Middleware;

public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (AppException exception)
        {
            context.Response.StatusCode = exception.StatusCode;
            await context.Response.WriteAsJsonAsync(
                new ApiErrorResponse(exception.Code, exception.Message, exception.FieldErrors, context.TraceIdentifier));
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled exception processing request {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(
                new ApiErrorResponse("UNKNOWN", "An unexpected error occurred", TraceId: context.TraceIdentifier));
        }
    }
}
