using System.Security.Claims;
using Saxovat.Application.Common;
using Saxovat.Domain;

namespace Saxovat.API.Common;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetRequiredUserId(this ClaimsPrincipal principal)
    {
        var subject = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue(ClaimTypes.Name)
            ?? principal.FindFirstValue("sub");

        if (!Guid.TryParse(subject, out var userId))
        {
            throw new UnauthorizedAppException();
        }

        return userId;
    }

    public static UserRole GetRequiredRole(this ClaimsPrincipal principal)
    {
        var role = principal.FindFirstValue(ClaimTypes.Role) ?? principal.FindFirstValue("role");

        return role switch
        {
            "CUSTOMER" => UserRole.Customer,
            "PHARMACIST" => UserRole.Pharmacist,
            "SUPERADMIN" => UserRole.SuperAdmin,
            _ => throw new UnauthorizedAppException(),
        };
    }
}
