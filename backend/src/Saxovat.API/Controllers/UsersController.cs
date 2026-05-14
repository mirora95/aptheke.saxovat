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
[Route("users")]
public sealed class UsersController(IUserService userService) : ControllerBase
{
    [Authorize(Roles = "SUPERADMIN,PHARMACIST")]
    [HttpGet]
    [ProducesResponseType<ApiListResponse<UserResponse>>(StatusCodes.Status200OK)]
    public Task<ApiListResponse<UserResponse>> GetUsers([FromQuery] GetUsersQuery query, CancellationToken cancellationToken)
    {
        if (User.GetRequiredRole() == UserRole.Pharmacist)
        {
            query.Role = "CUSTOMER";
        }

        return userService.GetUsersAsync(query, cancellationToken);
    }

    [HttpGet("{id}")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<UserResponse>> GetUserById(string id, CancellationToken cancellationToken)
    {
        var user = await userService.GetUserByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return NotFound(new ApiErrorResponse("NOT_FOUND", "User not found", TraceId: HttpContext.TraceIdentifier));
        }

        var currentRole = User.GetRequiredRole();
        var currentUserId = User.GetRequiredUserId().ToString();
        var allowed =
            currentRole == UserRole.SuperAdmin ||
            (currentRole == UserRole.Pharmacist && user.Role == "CUSTOMER") ||
            (currentRole == UserRole.Customer && user.Id == currentUserId);

        if (!allowed)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ApiErrorResponse("FORBIDDEN", "You do not have access to this resource", TraceId: HttpContext.TraceIdentifier));
        }

        return Ok(user);
    }

    [Authorize(Roles = "SUPERADMIN")]
    [HttpPatch("{id}/status")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public Task<UserResponse> UpdateUserStatus(string id, [FromBody] UpdateUserStatusRequest request, CancellationToken cancellationToken)
        => userService.UpdateUserStatusAsync(id, request, User.GetRequiredUserId(), cancellationToken);

    [Authorize(Roles = "CUSTOMER,SUPERADMIN")]
    [HttpPost("{id}/balance/top-up")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public Task<UserResponse> TopUpBalance(string id, [FromBody] TopUpBalanceRequest request, CancellationToken cancellationToken)
        => userService.TopUpBalanceAsync(id, request, User.GetRequiredUserId(), User.GetRequiredRole(), cancellationToken);

    [HttpPatch("{id}/reset-password")]
    [Authorize(Roles = "PHARMACIST,SUPERADMIN")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword(string id, ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        var actorId = User.GetRequiredUserId();
        var result = await userService.ResetPasswordAsync(id, request, actorId, cancellationToken);
        return Ok(result);
    }
}
