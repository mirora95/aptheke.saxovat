using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.API.Common;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;

namespace Saxovat.API.Controllers;

[ApiController]
[Authorize]
[Route("medicines")]
public sealed class MedicinesController(IMedicineService medicineService) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType<ApiListResponse<MedicineResponse>>(StatusCodes.Status200OK)]
    public Task<ApiListResponse<MedicineResponse>> GetMedicines([FromQuery] GetMedicinesQuery query, CancellationToken cancellationToken)
    {
        if (User.GetRequiredRole() == UserRole.Customer)
        {
            query.IsActive = true;
        }

        return medicineService.GetMedicinesAsync(query, cancellationToken);
    }

    [AllowAnonymous]
    [HttpGet("{id}")]
    [ProducesResponseType<MedicineResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MedicineResponse>> GetMedicineById(string id, CancellationToken cancellationToken)
    {
        var medicine = await medicineService.GetMedicineByIdAsync(id, cancellationToken);
        if (medicine is null)
        {
            return NotFound(new ApiErrorResponse("NOT_FOUND", "Medicine not found", TraceId: HttpContext.TraceIdentifier));
        }

        if (User.GetRequiredRole() == UserRole.Customer && !medicine.IsActive)
        {
            return NotFound(new ApiErrorResponse("NOT_FOUND", "Medicine not found", TraceId: HttpContext.TraceIdentifier));
        }

        return Ok(medicine);
    }

    [Authorize(Roles = "PHARMACIST,SUPERADMIN")]
    [HttpPost]
    [ProducesResponseType<MedicineResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<MedicineResponse>> CreateMedicine([FromBody] CreateMedicineRequest request, CancellationToken cancellationToken)
    {
        var medicine = await medicineService.CreateMedicineAsync(request, User.GetRequiredUserId(), cancellationToken);
        return CreatedAtAction(nameof(GetMedicineById), new { id = medicine.Id }, medicine);
    }

    [Authorize(Roles = "PHARMACIST,SUPERADMIN")]
    [HttpPut("{id}")]
    [ProducesResponseType<MedicineResponse>(StatusCodes.Status200OK)]
    public Task<MedicineResponse> UpdateMedicine(string id, [FromBody] UpdateMedicineRequest request, CancellationToken cancellationToken)
        => medicineService.UpdateMedicineAsync(id, request, User.GetRequiredUserId(), cancellationToken);

    [Authorize(Roles = "PHARMACIST,SUPERADMIN")]
    [HttpPatch("{id}/status")]
    [ProducesResponseType<MedicineResponse>(StatusCodes.Status200OK)]
    public Task<MedicineResponse> UpdateMedicineStatus(string id, [FromBody] UpdateMedicineStatusRequest request, CancellationToken cancellationToken)
        => medicineService.UpdateMedicineStatusAsync(id, request, User.GetRequiredUserId(), cancellationToken);
}
