namespace Saxovat.Domain;

public enum UserRole
{
    Customer = 1,
    Pharmacist = 2,
    SuperAdmin = 3,
}

public enum OrderStatus
{
    Pending = 1,
    Confirmed = 2,
    Preparing = 3,
    Ready = 4,
    OutForDelivery = 5,
    Delivered = 6,
    Cancelled = 7,
}

public enum PaymentStatus
{
    Pending = 1,
    PartiallyPaid = 2,
    Paid = 3,
    Failed = 4,
    Refunded = 5,
}

public enum PaymentMethod
{
    Cash = 1,
    Balance = 2,
    Card = 3,
}

public enum DeliveryType
{
    Delivery = 1,
    Pickup = 2,
}

public enum NotificationType
{
    Order = 1,
    Inventory = 2,
    Payment = 3,
    System = 4,
}
