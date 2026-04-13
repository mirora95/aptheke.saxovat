using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.API.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;

namespace Saxovat.API.Controllers;

[ApiController]
[Authorize(Roles = "PHARMACIST,SUPERADMIN")]
[Route("analytics")]
public sealed class AnalyticsController(IAnalyticsService analyticsService) : ControllerBase
{
    [HttpGet("dashboard")]
    [ProducesResponseType<DashboardAnalyticsResponse>(StatusCodes.Status200OK)]
    public Task<DashboardAnalyticsResponse> GetDashboard(CancellationToken cancellationToken)
        => analyticsService.GetDashboardAnalyticsAsync(User.GetRequiredRole(), cancellationToken);
}
