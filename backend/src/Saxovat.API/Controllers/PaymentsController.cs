using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.API.Common;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;

namespace Saxovat.API.Controllers;

[ApiController]
[Authorize]
[Route("payments")]
public sealed class PaymentsController(IPaymentService paymentService) : ControllerBase
{
    [HttpGet("order/{orderId}")]
    [ProducesResponseType<PaymentResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaymentResponse>> GetPaymentByOrder(string orderId, CancellationToken cancellationToken)
    {
        var payment = await paymentService.GetPaymentByOrderIdAsync(orderId, User.GetRequiredUserId(), User.GetRequiredRole(), cancellationToken);
        if (payment is null)
        {
            return NotFound(new ApiErrorResponse("NOT_FOUND", "Payment not found", TraceId: HttpContext.TraceIdentifier));
        }

        return Ok(payment);
    }

    [Authorize(Roles = "PHARMACIST,SUPERADMIN")]
    [HttpPost("order/{orderId}/record")]
    [ProducesResponseType<PaymentResponse>(StatusCodes.Status200OK)]
    public Task<PaymentResponse> RecordPayment(string orderId, [FromBody] RecordPaymentRequest request, CancellationToken cancellationToken)
        => paymentService.RecordPaymentAsync(orderId, request, User.GetRequiredUserId(), User.GetRequiredRole(), cancellationToken);
}
