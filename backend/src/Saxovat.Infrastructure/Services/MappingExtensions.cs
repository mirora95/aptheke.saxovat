using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Domain;

namespace Saxovat.Infrastructure.Services;

internal static class MappingExtensions
{
    public static UserResponse ToResponse(this User user) =>
        new(
            user.Id.ToString(),
            user.FullName,
            user.Phone,
            user.Email,
            user.Role.ToFrontendRole(),
            null,
            user.Address,
            user.Balance,
            user.IsActive,
            user.CreatedAt.ToString("O"));

    public static CategoryResponse ToResponse(this Category category) =>
        new(
            category.Id.ToString(),
            category.Name,
            category.Description,
            category.Icon,
            category.IsActive);

    public static MedicineResponse ToResponse(this Medicine medicine) =>
        new(
            medicine.Id.ToString(),
            medicine.Name,
            medicine.GenericName,
            medicine.BrandName,
            medicine.CategoryId.ToString(),
            medicine.Category?.Name ?? string.Empty,
            medicine.Description,
            medicine.ShortDescription,
            medicine.Price,
            medicine.DiscountPrice,
            medicine.StockQuantity,
            medicine.SKU,
            medicine.Manufacturer,
            medicine.DosageForm,
            medicine.Strength,
            medicine.PackageSize,
            medicine.ImageUrl,
            Array.Empty<string>(),
            medicine.RequiresPrescription,
            medicine.IsFeatured,
            medicine.IsActive,
            medicine.CreatedAt.ToString("O"),
            medicine.UpdatedAt.ToString("O"));

    public static OrderResponse ToResponse(this Order order) =>
        new(
            order.Id.ToString(),
            order.CustomerId.ToString(),
            order.OrderNumber,
            order.Status.ToString(),
            order.PaymentStatus.ToFrontendPaymentStatus(),
            order.PaymentMethod.ToFrontendPaymentMethod(),
            order.Payments.Sum(payment => payment.AmountPaid),
            Math.Max(order.TotalAmount - order.Payments.Sum(payment => payment.AmountPaid), 0m),
            order.DeliveryType.ToString(),
            order.DeliveryAddress,
            order.Items.Select(item => item.ToResponse()).ToArray(),
            order.Subtotal,
            order.DeliveryFee,
            order.DiscountAmount,
            order.TotalAmount,
            order.Notes,
            order.CreatedAt.ToString("O"),
            order.UpdatedAt.ToString("O"));

    public static OrderItemResponse ToResponse(this OrderItem item) =>
        new(
            item.Id.ToString(),
            item.MedicineId.ToString(),
            item.MedicineName,
            item.Quantity,
            item.UnitPrice,
            item.TotalPrice,
            item.ImageUrl);

    public static PaymentResponse ToResponse(this Payment payment) =>
        new(
            payment.Id.ToString(),
            payment.OrderId.ToString(),
            payment.CustomerId.ToString(),
            payment.Method.ToFrontendPaymentMethod(),
            payment.Status.ToFrontendPaymentStatus(),
            payment.Amount,
            payment.AmountPaid,
            Math.Max(payment.Amount - payment.AmountPaid, 0m),
            payment.Notes,
            payment.CreatedAt.ToString("O"),
            payment.ProcessedAt?.ToString("O"),
            payment.UpdatedAt.ToString("O"));

    public static NotificationResponse ToResponse(this Notification notification) =>
        new(
            notification.Id.ToString(),
            notification.UserId.ToString(),
            notification.Type.ToFrontendNotificationType(),
            notification.Title,
            notification.Message,
            notification.RelatedEntityType,
            notification.RelatedEntityId,
            notification.IsRead,
            notification.CreatedAt.ToString("O"));

    public static ActivityLogResponse ToResponse(this AuditLog auditLog) =>
        new(
            auditLog.Id.ToString(),
            auditLog.Action,
            auditLog.EntityType,
            auditLog.EntityId,
            auditLog.Description,
            auditLog.ActorUserId?.ToString(),
            auditLog.ActorUser?.FullName,
            auditLog.CreatedAt.ToString("O"));

    public static string ToFrontendRole(this UserRole role) =>
        role switch
        {
            UserRole.Customer => "CUSTOMER",
            UserRole.Pharmacist => "PHARMACIST",
            UserRole.SuperAdmin => "SUPERADMIN",
            _ => throw new ValidationAppException("Unsupported user role"),
        };

    public static string ToFrontendPaymentMethod(this PaymentMethod method) =>
        method switch
        {
            PaymentMethod.Cash => "Cash",
            PaymentMethod.Balance => "Balance",
            PaymentMethod.Card => "Card",
            _ => throw new ValidationAppException("Unsupported payment method"),
        };

    public static string ToFrontendPaymentStatus(this PaymentStatus status) =>
        status switch
        {
            PaymentStatus.Paid => "Paid",
            PaymentStatus.Refunded => "Refunded",
            PaymentStatus.Pending => "Unpaid",
            PaymentStatus.PartiallyPaid => "Unpaid",
            PaymentStatus.Failed => "Unpaid",
            _ => throw new ValidationAppException("Unsupported payment status"),
        };

    public static string ToFrontendNotificationType(this NotificationType type) =>
        type switch
        {
            NotificationType.Order => "order",
            NotificationType.Inventory => "inventory",
            NotificationType.Payment => "payment",
            NotificationType.System => "system",
            _ => throw new ValidationAppException("Unsupported notification type"),
        };

    public static Guid ParseGuid(string value, string fieldName)
    {
        if (!Guid.TryParse(value, out var parsed))
        {
            throw new ValidationAppException($"{fieldName} must be a valid identifier");
        }

        return parsed;
    }

    public static UserRole ParseUserRole(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ValidationAppException("Role is required");
        }

        return value.Trim().ToUpperInvariant() switch
        {
            "CUSTOMER" => UserRole.Customer,
            "PHARMACIST" => UserRole.Pharmacist,
            "SUPERADMIN" => UserRole.SuperAdmin,
            _ => throw new ValidationAppException("Role is not supported"),
        };
    }

    public static OrderStatus ParseOrderStatus(string value)
    {
        if (!Enum.TryParse<OrderStatus>(value, true, out var status))
        {
            throw new ValidationAppException("Order status is not supported");
        }

        return status;
    }

    public static DeliveryType ParseDeliveryType(string value)
    {
        if (!Enum.TryParse<DeliveryType>(value, true, out var deliveryType))
        {
            throw new ValidationAppException("Delivery type is not supported");
        }

        return deliveryType;
    }

    public static PaymentMethod ParsePaymentMethod(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ValidationAppException("Payment method is required");
        }

        return value.Trim().ToUpperInvariant() switch
        {
            "CASH" => PaymentMethod.Cash,
            "CASH ON DELIVERY" => PaymentMethod.Cash,
            "BALANCE" => PaymentMethod.Balance,
            "PAY FROM ACCOUNT" => PaymentMethod.Balance,
            "CARD" => PaymentMethod.Card,
            "CLICK" => PaymentMethod.Card,
            _ => throw new ValidationAppException("Payment method is not supported"),
        };
    }
}
