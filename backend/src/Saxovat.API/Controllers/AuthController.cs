using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.API.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;

namespace Saxovat.API.Controllers;

[ApiController]
[Route("auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType<LoginResponse>(StatusCodes.Status200OK)]
    public Task<LoginResponse> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
        => authService.LoginAsync(request, cancellationToken);

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    public Task<CurrentUserResponse> Me(CancellationToken cancellationToken)
        => authService.GetCurrentUserAsync(User.GetRequiredUserId(), cancellationToken);
}
