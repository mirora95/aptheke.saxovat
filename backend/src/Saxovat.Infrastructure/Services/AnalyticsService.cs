using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class AnalyticsService(SaxovatDbContext dbContext) : IAnalyticsService
{
    private const int LowStockThreshold = 20;

    public async Task<DashboardAnalyticsResponse> GetDashboardAnalyticsAsync(UserRole actorRole, CancellationToken cancellationToken = default)
    {
        var users = await dbContext.Users.AsNoTracking().ToListAsync(cancellationToken);
        var medicines = await dbContext.Medicines.AsNoTracking().ToListAsync(cancellationToken);
        var orders = await dbContext.Orders.AsNoTracking().ToListAsync(cancellationToken);
        var payments = await dbContext.Payments.AsNoTracking().ToListAsync(cancellationToken);
        var recentActivity = await dbContext.AuditLogs
            .AsNoTracking()
            .Include(x => x.ActorUser)
            .OrderByDescending(x => x.CreatedAt)
            .Take(actorRole == UserRole.SuperAdmin ? 12 : 8)
            .ToListAsync(cancellationToken);

        var ordersByStatus = Enum.GetValues<OrderStatus>()
            .Select(status => new OrderStatusMetricResponse(status.ToString(), orders.Count(order => order.Status == status)))
            .ToArray();

        var totalSales = payments.Sum(payment => payment.AmountPaid);

        return new DashboardAnalyticsResponse(
            users.Count,
            users.Count(user => user.Role == UserRole.Customer),
            users.Count(user => user.Role == UserRole.Pharmacist),
            users.Count(user => user.Role == UserRole.SuperAdmin),
            medicines.Count,
            medicines.Count(medicine => medicine.IsActive),
            medicines.Count(medicine => !medicine.IsActive),
            medicines.Count(medicine => medicine.IsActive && medicine.StockQuantity > 0 && medicine.StockQuantity <= LowStockThreshold),
            medicines.Count(medicine => medicine.StockQuantity <= 0),
            medicines.Count(medicine => medicine.IsFeatured),
            orders.Count,
            orders.Count(order => order.Status == OrderStatus.Pending),
            totalSales,
            ordersByStatus,
            recentActivity.Select(activity => activity.ToResponse()).ToArray());
    }
}
