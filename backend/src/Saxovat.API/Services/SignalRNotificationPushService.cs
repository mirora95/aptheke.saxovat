using Microsoft.AspNetCore.SignalR;
using Saxovat.API.Hubs;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;

namespace Saxovat.API.Services;

public sealed class SignalRNotificationPushService(IHubContext<OrderHub> hubContext) : IOrderPushNotificationService
{
    public async Task PushOrderStatusChangedAsync(Guid orderId, string orderNumber, OrderStatus newStatus, Guid customerId, CancellationToken cancellationToken = default)
    {
        await hubContext.Clients.Group(customerId.ToString()).SendAsync("OrderStatusChanged", new
        {
            orderId = orderId.ToString(),
            orderNumber,
            newStatus = newStatus.ToString(),
            customerId = customerId.ToString(),
            timestamp = DateTime.UtcNow,
        }, cancellationToken);
        await hubContext.Clients.Group("pharmacists").SendAsync("OrderStatusChanged", new
        {
            orderId = orderId.ToString(),
            orderNumber,
            newStatus = newStatus.ToString(),
            customerId = customerId.ToString(),
            timestamp = DateTime.UtcNow,
        }, cancellationToken);
    }
}
