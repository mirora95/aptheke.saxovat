using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class OrderService(
    SaxovatDbContext dbContext,
    PaymentService paymentService,
    AuditLogWriter auditLogWriter,
    NotificationService notificationService,
    IOrderPushNotificationService orderPushNotificationService) : IOrderService
{
    private static readonly Dictionary<OrderStatus, OrderStatus[]> AllowedTransitions = new()
    {
        [OrderStatus.Pending] = [OrderStatus.Confirmed, OrderStatus.Cancelled],
        [OrderStatus.Confirmed] = [OrderStatus.Preparing, OrderStatus.Cancelled],
        [OrderStatus.Preparing] = [OrderStatus.Ready, OrderStatus.Cancelled],
        [OrderStatus.Ready] = [OrderStatus.OutForDelivery, OrderStatus.Delivered, OrderStatus.Cancelled],
        [OrderStatus.OutForDelivery] = [OrderStatus.Delivered, OrderStatus.Cancelled],
        [OrderStatus.Delivered] = [],
        [OrderStatus.Cancelled] = [],
    };

    public async Task<ApiListResponse<OrderResponse>> GetOrdersAsync(
        GetOrdersQuery query,
        Guid? currentUserId,
        UserRole currentRole,
        CancellationToken cancellationToken = default)
    {
        var ordersQuery = dbContext.Orders
            .AsNoTracking()
            .Include(x => x.Items)
            .Include(x => x.Payments)
            .OrderByDescending(x => x.CreatedAt)
            .AsQueryable();

        if (currentRole == UserRole.Customer)
        {
            if (!currentUserId.HasValue)
            {
                throw new UnauthorizedAppException();
            }

            ordersQuery = ordersQuery.Where(x => x.CustomerId == currentUserId.Value);
        }
        else if (!string.IsNullOrWhiteSpace(query.CustomerId))
        {
            var customerId = MappingExtensions.ParseGuid(query.CustomerId, "Customer id");
            ordersQuery = ordersQuery.Where(x => x.CustomerId == customerId);
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = MappingExtensions.ParseOrderStatus(query.Status);
            ordersQuery = ordersQuery.Where(x => x.Status == status);
        }

        var orders = await ordersQuery.ToListAsync(cancellationToken);
        return new ApiListResponse<OrderResponse>(orders.Select(x => x.ToResponse()).ToArray(), orders.Count);
    }

    public async Task<OrderResponse?> GetOrderByIdAsync(string id, Guid? currentUserId, UserRole currentRole, CancellationToken cancellationToken = default)
    {
        var orderId = MappingExtensions.ParseGuid(id, "Order id");
        var order = await dbContext.Orders.AsNoTracking()
            .Include(x => x.Items)
            .Include(x => x.Payments)
            .SingleOrDefaultAsync(x => x.Id == orderId, cancellationToken);
        if (order is null)
        {
            return null;
        }

        if (currentRole == UserRole.Customer && order.CustomerId != currentUserId)
        {
            throw new ForbiddenAppException("Customers can only access their own orders");
        }

        return order.ToResponse();
    }

    public async Task<OrderResponse> CreateOrderAsync(CreateOrderRequest request, Guid currentUserId, CancellationToken cancellationToken = default)
    {
        var customerId = MappingExtensions.ParseGuid(request.CustomerId, "Customer id");
        if (customerId != currentUserId)
        {
            throw new ForbiddenAppException("Customers can only create orders for themselves");
        }

        var customer = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == customerId, cancellationToken)
            ?? throw new NotFoundAppException("User", request.CustomerId);

        if (customer.Role != UserRole.Customer)
        {
            throw new ValidationAppException("Orders can only be created for customer accounts");
        }

        if (!customer.IsActive)
        {
            throw new ForbiddenAppException("Customer account is inactive");
        }

        if (request.OrderItems.Count == 0)
        {
            throw new ValidationAppException("Order items are required");
        }

        var requestedItems = request.OrderItems
            .GroupBy(x => MappingExtensions.ParseGuid(x.MedicineId, "Medicine id"))
            .Select(group => new
            {
                MedicineId = group.Key,
                Quantity = group.Sum(item => item.Quantity),
            })
            .ToArray();

        var medicineIds = requestedItems.Select(x => x.MedicineId).ToArray();
        var medicines = await dbContext.Medicines.Where(x => medicineIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var item in requestedItems)
        {
            if (!medicines.TryGetValue(item.MedicineId, out var medicine))
            {
                throw new NotFoundAppException("Medicine", item.MedicineId.ToString());
            }

            if (!medicine.IsActive)
            {
                throw new ValidationAppException($"Medicine {medicine.Name} is not currently available");
            }

            if (medicine.StockQuantity < item.Quantity)
            {
                throw new ValidationAppException($"Medicine {medicine.Name} does not have enough stock");
            }
        }

        var paymentMethod = MappingExtensions.ParsePaymentMethod(request.PaymentMethod);
        var deliveryType = MappingExtensions.ParseDeliveryType(request.DeliveryType);
        if (deliveryType == DeliveryType.Delivery && string.IsNullOrWhiteSpace(request.DeliveryAddress))
        {
            throw new ValidationAppException("Delivery address is required for delivery orders");
        }

        var now = DateTime.UtcNow;
        var sequence = await dbContext.Orders.CountAsync(cancellationToken) + 1;
        var normalizedAddress = deliveryType == DeliveryType.Delivery
            ? request.DeliveryAddress?.Trim()
            : null;
        var deliveryFee = deliveryType == DeliveryType.Pickup ? 0m : Math.Max(request.DeliveryFee, 0m);
        var discountAmount = 0m;
        var subtotal = 0m;
        var lowStockNotifications = new List<Medicine>();

        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = $"ORD-{now.Year}-{sequence:000}",
            CustomerId = customerId,
            Status = OrderStatus.Pending,
            PaymentStatus = PaymentStatus.Pending,
            PaymentMethod = paymentMethod,
            DeliveryType = deliveryType,
            DeliveryAddress = normalizedAddress,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
        };

        foreach (var item in requestedItems)
        {
            var medicine = medicines[item.MedicineId];
            var unitPrice = medicine.DiscountPrice ?? medicine.Price;
            var itemTotal = unitPrice * item.Quantity;
            var itemDiscount = (medicine.Price - unitPrice) * item.Quantity;

            medicine.StockQuantity -= item.Quantity;
            medicine.UpdatedAt = now;
            if (medicine.IsActive && medicine.StockQuantity > 0 && medicine.StockQuantity <= 20)
            {
                lowStockNotifications.Add(medicine);
            }
            subtotal += itemTotal;
            discountAmount += itemDiscount;

            order.Items.Add(new OrderItem
            {
                Id = Guid.NewGuid(),
                MedicineId = item.MedicineId,
                MedicineName = medicine.Name,
                Quantity = item.Quantity,
                UnitPrice = unitPrice,
                TotalPrice = itemTotal,
                ImageUrl = medicine.ImageUrl,
            });
        }

        order.Subtotal = subtotal;
        order.DeliveryFee = deliveryFee;
        order.DiscountAmount = discountAmount;
        order.TotalAmount = subtotal + deliveryFee;

        var payment = paymentService.CreateInitialPayment(order, customerId, order.Notes);
        if (paymentMethod == PaymentMethod.Balance)
        {
            paymentService.ApplyImmediateBalancePayment(payment, customer, "Paid from customer balance");
        }

        dbContext.Orders.Add(order);
        await auditLogWriter.WriteAsync(
            currentUserId,
            "ORDER_CREATED",
            "Order",
            order.Id.ToString(),
            $"Order {order.OrderNumber} was created",
            new
            {
                order.PaymentMethod,
                order.PaymentStatus,
                order.DeliveryType,
                order.TotalAmount,
            },
            cancellationToken);
        await notificationService.AddForUserAsync(
            customerId,
            NotificationType.Order,
            "Order created",
            $"Your order {order.OrderNumber} has been created successfully.",
            "Order",
            order.Id.ToString(),
            cancellationToken);
        await notificationService.AddForRolesAsync(
            [UserRole.Pharmacist, UserRole.SuperAdmin],
            NotificationType.Order,
            "New order received",
            $"Order {order.OrderNumber} is ready for pharmacy processing.",
            "Order",
            order.Id.ToString(),
            cancellationToken);
        foreach (var lowStockMedicine in lowStockNotifications.DistinctBy(x => x.Id))
        {
            await notificationService.AddForRolesAsync(
                [UserRole.Pharmacist, UserRole.SuperAdmin],
                NotificationType.Inventory,
                "Low stock alert",
                $"{lowStockMedicine.Name} is low on stock with {lowStockMedicine.StockQuantity} units remaining.",
                "Medicine",
                lowStockMedicine.Id.ToString(),
                cancellationToken);
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return order.ToResponse();
    }

    public async Task<OrderResponse> UpdateOrderStatusAsync(string id, UpdateOrderStatusRequest request, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var orderId = MappingExtensions.ParseGuid(id, "Order id");
        var order = await dbContext.Orders
            .Include(x => x.Items)
            .Include(x => x.Payments)
            .SingleOrDefaultAsync(x => x.Id == orderId, cancellationToken)
            ?? throw new NotFoundAppException("Order", id);

        var nextStatus = MappingExtensions.ParseOrderStatus(request.Status);
        var allowedStatuses = AllowedTransitions[order.Status];

        if (order.Status != nextStatus && !allowedStatuses.Contains(nextStatus))
        {
            throw new ValidationAppException("Order status transition is not allowed");
        }

        var previousStatus = order.Status;
        order.Status = nextStatus;
        order.UpdatedAt = DateTime.UtcNow;

        await auditLogWriter.WriteAsync(
            actorUserId,
            "ORDER_STATUS_UPDATED",
            "Order",
            order.Id.ToString(),
            $"Order {order.OrderNumber} status changed from {previousStatus} to {nextStatus}",
            new { PreviousStatus = previousStatus, NextStatus = nextStatus },
            cancellationToken);
        await notificationService.AddForUserAsync(
            order.CustomerId,
            NotificationType.Order,
            "Order status updated",
            $"Your order {order.OrderNumber} is now {nextStatus}.",
            "Order",
            order.Id.ToString(),
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        try
        {
            await orderPushNotificationService.PushOrderStatusChangedAsync(order.Id, order.OrderNumber, nextStatus, order.CustomerId, cancellationToken);
        }
        catch
        {
            // Don't fail the order update if push fails
        }
        return order.ToResponse();
    }
}
