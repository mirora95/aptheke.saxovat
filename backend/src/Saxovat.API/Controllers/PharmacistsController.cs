using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.API.Common;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;

namespace Saxovat.API.Controllers;

[ApiController]
[Authorize(Roles = "SUPERADMIN")]
[Route("pharmacists")]
public sealed class PharmacistsController(IUserService userService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ApiListResponse<UserResponse>>(StatusCodes.Status200OK)]
    public Task<ApiListResponse<UserResponse>> GetPharmacists(CancellationToken cancellationToken)
        => userService.GetPharmacistsAsync(cancellationToken);

    [HttpPost]
    [ProducesResponseType<UserResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<UserResponse>> CreatePharmacist([FromBody] CreatePharmacistRequest request, CancellationToken cancellationToken)
    {
        var pharmacist = await userService.CreatePharmacistAsync(request, User.GetRequiredUserId(), cancellationToken);
        return CreatedAtAction(nameof(GetPharmacists), new { id = pharmacist.Id }, pharmacist);
    }

    [HttpPut("{id}")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public Task<UserResponse> UpdatePharmacist(string id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
        => userService.UpdatePharmacistAsync(id, request, User.GetRequiredUserId(), cancellationToken);

    [HttpPatch("{id}/status")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public Task<UserResponse> UpdatePharmacistStatus(string id, [FromBody] UpdateUserStatusRequest request, CancellationToken cancellationToken)
        => userService.UpdateUserStatusAsync(id, request, User.GetRequiredUserId(), cancellationToken);
}
