using System.ComponentModel.DataAnnotations;

namespace Saxovat.Application.Contracts;

public record PaymentResponse(
    string Id,
    string OrderId,
    string CustomerId,
    string Method,
    string Status,
    decimal Amount,
    decimal AmountPaid,
    decimal AmountDue,
    string? Notes,
    string CreatedAt,
    string? ProcessedAt,
    string UpdatedAt);

public sealed class RecordPaymentRequest
{
    [Range(0, double.MaxValue)]
    public decimal Amount { get; set; }

    public bool MarkAsFailed { get; set; }
    public string? Notes { get; set; }
}
