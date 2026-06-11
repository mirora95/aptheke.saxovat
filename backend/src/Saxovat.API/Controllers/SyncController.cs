using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;

namespace Saxovat.API.Controllers;

[ApiController]
[Route("api/sync/1c")]
[Authorize(Roles = "PHARMACIST,SUPERADMIN")]
public sealed class SyncController(IOneCImportService oneCImportService) : ControllerBase
{
    [HttpPost("medicines")]
    [ProducesResponseType<OneCImportResult>(StatusCodes.Status200OK)]
    public Task<OneCImportResult> SyncMedicines(CancellationToken cancellationToken)
        => oneCImportService.SyncMedicinesAsync(cancellationToken);
}
