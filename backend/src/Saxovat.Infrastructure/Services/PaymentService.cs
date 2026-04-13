using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class PaymentService(
    SaxovatDbContext dbContext,
    AuditLogWriter auditLogWriter,
    NotificationService notificationService) : IPaymentService
{
    public async Task<PaymentResponse?> GetPaymentByOrderIdAsync(string orderId, Guid currentUserId, UserRole currentRole, CancellationToken cancellationToken = default)
    {
        var parsedOrderId = MappingExtensions.ParseGuid(orderId, "Order id");
        var payment = await dbContext.Payments
            .AsNoTracking()
            .Include(x => x.Order)
            .SingleOrDefaultAsync(x => x.OrderId == parsedOrderId, cancellationToken);

        if (payment is null)
        {
            return null;
        }

        if (currentRole == UserRole.Customer && payment.CustomerId != currentUserId)
        {
            throw new ForbiddenAppException("Customers can only access payments for their own orders");
        }

        return payment.ToResponse();
    }

    public async Task<PaymentResponse> RecordPaymentAsync(
        string orderId,
        RecordPaymentRequest request,
        Guid actorUserId,
        UserRole actorRole,
        CancellationToken cancellationToken = default)
    {
        if (actorRole == UserRole.Customer)
        {
            throw new ForbiddenAppException("Customers cannot manually record payments");
        }

        var parsedOrderId = MappingExtensions.ParseGuid(orderId, "Order id");
        var payment = await dbContext.Payments
            .Include(x => x.Order)
            .SingleOrDefaultAsync(x => x.OrderId == parsedOrderId, cancellationToken)
            ?? throw new NotFoundAppException("Payment", orderId);

        if (payment.Order is null)
        {
            throw new NotFoundAppException("Order", orderId);
        }

        if (request.MarkAsFailed)
        {
            payment.Status = payment.AmountPaid > 0m ? PaymentStatus.PartiallyPaid : PaymentStatus.Failed;
            payment.UpdatedAt = DateTime.UtcNow;
            payment.Notes = string.IsNullOrWhiteSpace(request.Notes) ? payment.Notes : request.Notes.Trim();
            payment.Order.PaymentStatus = payment.Status;
        }
        else
        {
            if (request.Amount <= 0m)
            {
                throw new ValidationAppException("Payment amount must be greater than zero");
            }

            payment.AmountPaid = Math.Min(payment.AmountPaid + request.Amount, payment.Amount);
            payment.Status = payment.AmountPaid >= payment.Amount ? PaymentStatus.Paid : PaymentStatus.PartiallyPaid;
            payment.ProcessedAt = DateTime.UtcNow;
            payment.UpdatedAt = DateTime.UtcNow;
            payment.Notes = string.IsNullOrWhiteSpace(request.Notes) ? payment.Notes : request.Notes.Trim();
            payment.Order.PaymentStatus = payment.Status;
        }

        payment.Order.UpdatedAt = DateTime.UtcNow;

        await auditLogWriter.WriteAsync(
            actorUserId,
            "PAYMENT_RECORDED",
            "Payment",
            payment.Id.ToString(),
            $"Payment for order {payment.Order.OrderNumber} was updated to {payment.Status}",
            new
            {
                payment.OrderId,
                payment.Method,
                payment.Status,
                payment.Amount,
                payment.AmountPaid,
            },
            cancellationToken);

        await notificationService.AddForUserAsync(
            payment.CustomerId,
            NotificationType.Payment,
            "Payment updated",
            $"Your payment for order {payment.Order.OrderNumber} is now {payment.Status}.",
            "Order",
            payment.OrderId.ToString(),
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        return payment.ToResponse();
    }

    internal Payment CreateInitialPayment(Order order, Guid customerId, string? notes = null)
    {
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            CustomerId = customerId,
            Method = order.PaymentMethod,
            Status = PaymentStatus.Pending,
            Amount = order.TotalAmount,
            AmountPaid = 0m,
            Notes = notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        dbContext.Payments.Add(payment);
        order.Payments.Add(payment);
        return payment;
    }

    internal void ApplyImmediateBalancePayment(Payment payment, User customer, string? notes = null)
    {
        if (customer.Balance < payment.Amount)
        {
            throw new ValidationAppException("Customer balance is insufficient for this payment");
        }

        customer.Balance -= payment.Amount;
        payment.AmountPaid = payment.Amount;
        payment.Status = PaymentStatus.Paid;
        payment.ProcessedAt = DateTime.UtcNow;
        payment.UpdatedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(notes))
        {
            payment.Notes = notes.Trim();
        }

        if (payment.Order is not null)
        {
            payment.Order.PaymentStatus = PaymentStatus.Paid;
        }
    }
}
