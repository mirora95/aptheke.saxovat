namespace Saxovat.Domain;

public class User
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Address { get; set; }
    public decimal Balance { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}

public class Category
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Medicine> Medicines { get; set; } = new List<Medicine>();
}

public class Medicine
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string GenericName { get; set; } = string.Empty;
    public string BrandName { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public string Description { get; set; } = string.Empty;
    public string ShortDescription { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal? DiscountPrice { get; set; }
    public int StockQuantity { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public string Manufacturer { get; set; } = string.Empty;
    public string DosageForm { get; set; } = string.Empty;
    public string Strength { get; set; } = string.Empty;
    public string PackageSize { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public bool RequiresPrescription { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSyncedAt { get; set; }

    public Category? Category { get; set; }
}

public class Order
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public DeliveryType DeliveryType { get; set; }
    public string? DeliveryAddress { get; set; }
    public string? Notes { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User? Customer { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid MedicineId { get; set; }
    public string MedicineName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public string ImageUrl { get; set; } = string.Empty;

    public Order? Order { get; set; }
}

public class Payment
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid CustomerId { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public decimal Amount { get; set; }
    public decimal AmountPaid { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Order? Order { get; set; }
    public User? Customer { get; set; }
}

public class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public NotificationType Type { get; set; } = NotificationType.System;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? RelatedEntityType { get; set; }
    public string? RelatedEntityId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? MetadataJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? ActorUser { get; set; }
}

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public User? User { get; set; }
}
