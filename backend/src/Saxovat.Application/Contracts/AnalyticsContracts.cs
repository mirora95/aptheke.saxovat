namespace Saxovat.Application.Contracts;

public record OrderStatusMetricResponse(
    string Status,
    int Count);

public record ActivityLogResponse(
    string Id,
    string Action,
    string EntityType,
    string? EntityId,
    string Description,
    string? ActorUserId,
    string? ActorName,
    string CreatedAt);

public record DashboardAnalyticsResponse(
    int TotalUsers,
    int CustomerCount,
    int PharmacistCount,
    int SuperAdminCount,
    int TotalMedicines,
    int ActiveMedicines,
    int InactiveMedicines,
    int LowStockCount,
    int OutOfStockCount,
    int FeaturedMedicines,
    int TotalOrders,
    int PendingOrders,
    decimal TotalSales,
    IReadOnlyCollection<OrderStatusMetricResponse> OrdersByStatus,
    IReadOnlyCollection<ActivityLogResponse> RecentActivity);
