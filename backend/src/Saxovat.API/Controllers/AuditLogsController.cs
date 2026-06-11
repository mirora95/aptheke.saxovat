using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;

namespace Saxovat.API.Controllers;

[ApiController]
[Route("audit-logs")]
[Authorize(Roles = "SUPERADMIN")]
public sealed class AuditLogsController(IAuditLogService auditLogService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ApiListResponse<AuditLogResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAuditLogs([FromQuery] AuditLogQuery query, CancellationToken cancellationToken)
    {
        var result = await auditLogService.GetAuditLogsAsync(query, cancellationToken);
        return Ok(result);
    }
}
