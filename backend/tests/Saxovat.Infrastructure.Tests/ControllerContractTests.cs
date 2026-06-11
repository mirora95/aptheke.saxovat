using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.API.Controllers;

namespace Saxovat.Infrastructure.Tests;

public sealed class ControllerContractTests
{
    [Fact]
    public void AuditLogsController_MatchesFrontendRouteAndSuperAdminRole()
    {
        var route = GetAttribute<RouteAttribute>(typeof(AuditLogsController));
        var authorize = GetAttribute<AuthorizeAttribute>(typeof(AuditLogsController));

        route.Template.Should().Be("audit-logs");
        authorize.Roles.Should().Be("SUPERADMIN");
    }

    [Fact]
    public void SyncController_RequiresStaffAuthorization()
    {
        var authorize = GetAttribute<AuthorizeAttribute>(typeof(SyncController));

        authorize.Roles.Should().Be("PHARMACIST,SUPERADMIN");
    }

    private static TAttribute GetAttribute<TAttribute>(Type type)
        where TAttribute : Attribute
    {
        var attribute = type.GetCustomAttributes(typeof(TAttribute), inherit: false)
            .SingleOrDefault();

        attribute.Should().NotBeNull();
        return (TAttribute)attribute!;
    }
}
