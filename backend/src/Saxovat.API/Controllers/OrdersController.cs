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
[Route("orders")]
public sealed class OrdersController(IOrderService orderService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ApiListResponse<OrderResponse>>(StatusCodes.Status200OK)]
    public Task<ApiListResponse<OrderResponse>> GetOrders([FromQuery] GetOrdersQuery query, CancellationToken cancellationToken)
        => orderService.GetOrdersAsync(query, User.GetRequiredUserId(), User.GetRequiredRole(), cancellationToken);

    [HttpGet("{id}")]
    [ProducesResponseType<OrderResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderResponse>> GetOrderById(string id, CancellationToken cancellationToken)
    {
        var order = await orderService.GetOrderByIdAsync(id, User.GetRequiredUserId(), User.GetRequiredRole(), cancellationToken);
        if (order is null)
        {
            return NotFound(new ApiErrorResponse("NOT_FOUND", "Order not found", TraceId: HttpContext.TraceIdentifier));
        }

        return Ok(order);
    }

    [Authorize(Roles = "CUSTOMER")]
    [HttpPost]
    [ProducesResponseType<OrderResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<OrderResponse>> CreateOrder([FromBody] CreateOrderRequest request, CancellationToken cancellationToken)
    {
        var order = await orderService.CreateOrderAsync(request, User.GetRequiredUserId(), cancellationToken);
        return CreatedAtAction(nameof(GetOrderById), new { id = order.Id }, order);
    }

    [Authorize(Roles = "PHARMACIST,SUPERADMIN")]
    [HttpPatch("{id}/status")]
    [ProducesResponseType<OrderResponse>(StatusCodes.Status200OK)]
    public Task<OrderResponse> UpdateOrderStatus(string id, [FromBody] UpdateOrderStatusRequest request, CancellationToken cancellationToken)
        => orderService.UpdateOrderStatusAsync(id, request, User.GetRequiredUserId(), cancellationToken);
}
