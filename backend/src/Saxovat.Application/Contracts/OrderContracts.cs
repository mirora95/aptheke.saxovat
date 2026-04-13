using System.ComponentModel.DataAnnotations;

namespace Saxovat.Application.Contracts;

public record OrderItemResponse(
    string Id,
    string MedicineId,
    string MedicineName,
    int Quantity,
    decimal UnitPrice,
    decimal TotalPrice,
    string ImageUrl);

public record OrderResponse(
    string Id,
    string CustomerId,
    string OrderNumber,
    string OrderStatus,
    string PaymentStatus,
    string PaymentMethod,
    decimal AmountPaid,
    decimal AmountDue,
    string DeliveryType,
    string? DeliveryAddress,
    IReadOnlyCollection<OrderItemResponse> OrderItems,
    decimal Subtotal,
    decimal DeliveryFee,
    decimal DiscountAmount,
    decimal TotalAmount,
    string? Notes,
    string CreatedAt,
    string UpdatedAt);

public sealed class GetOrdersQuery
{
    public string? CustomerId { get; set; }
    public string? Status { get; set; }
}

public sealed class CreateOrderItemRequest
{
    [Required]
    public string MedicineId { get; set; } = string.Empty;

    [Required]
    public string MedicineName { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int Quantity { get; set; }

    [Range(0, double.MaxValue)]
    public decimal UnitPrice { get; set; }

    [Range(0, double.MaxValue)]
    public decimal TotalPrice { get; set; }

    [Required]
    public string ImageUrl { get; set; } = string.Empty;
}

public sealed class CreateOrderRequest
{
    [Required]
    public string CustomerId { get; set; } = string.Empty;

    [Required]
    public string PaymentMethod { get; set; } = string.Empty;

    [Required]
    public string DeliveryType { get; set; } = string.Empty;

    public string? DeliveryAddress { get; set; }
    [Required]
    public List<CreateOrderItemRequest> OrderItems { get; set; } = [];
    [Range(0, double.MaxValue)]
    public decimal Subtotal { get; set; }
    [Range(0, double.MaxValue)]
    public decimal DeliveryFee { get; set; }
    [Range(0, double.MaxValue)]
    public decimal DiscountAmount { get; set; }
    [Range(0, double.MaxValue)]
    public decimal TotalAmount { get; set; }
    public string? Notes { get; set; }
}

public sealed class UpdateOrderStatusRequest
{
    [Required]
    public string Status { get; set; } = string.Empty;
}
