using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.API.Common;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;

namespace Saxovat.API.Controllers;

[ApiController]
[Authorize]
[Route("notifications")]
public sealed class NotificationsController(INotificationService notificationService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ApiListResponse<NotificationResponse>>(StatusCodes.Status200OK)]
    public Task<ApiListResponse<NotificationResponse>> GetNotifications(CancellationToken cancellationToken)
        => notificationService.GetNotificationsAsync(User.GetRequiredUserId(), cancellationToken);

    [HttpPatch("{id}/read")]
    [ProducesResponseType<NotificationResponse>(StatusCodes.Status200OK)]
    public Task<NotificationResponse> MarkAsRead(string id, CancellationToken cancellationToken)
        => notificationService.MarkAsReadAsync(id, User.GetRequiredUserId(), cancellationToken);
}
