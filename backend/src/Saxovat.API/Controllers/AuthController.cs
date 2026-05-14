using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.API.Common;
using Saxovat.Application.Common;
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

    [AllowAnonymous]
    [HttpPost("refresh")]
    [ProducesResponseType<RefreshTokenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.RefreshTokenAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (UnauthorizedAppException)
        {
            return Unauthorized();
        }
    }

    [AllowAnonymous]
    [HttpPost("register")]
    [ProducesResponseType<LoginResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.RegisterAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (ValidationAppException)
        {
            return BadRequest();
        }
    }

    [Authorize]
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(User.GetRequiredUserId(), cancellationToken);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    public Task<CurrentUserResponse> Me(CancellationToken cancellationToken)
        => authService.GetCurrentUserAsync(User.GetRequiredUserId(), cancellationToken);
}
