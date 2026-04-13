using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class MedicineService(
    SaxovatDbContext dbContext,
    AuditLogWriter auditLogWriter,
    NotificationService notificationService) : IMedicineService
{
    private const int LowStockThreshold = 20;

    public async Task<ApiListResponse<MedicineResponse>> GetMedicinesAsync(GetMedicinesQuery query, CancellationToken cancellationToken = default)
    {
        var medicinesQuery = dbContext.Medicines.AsNoTracking().Include(x => x.Category).AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            medicinesQuery = medicinesQuery.Where(x =>
                x.Name.ToLower().Contains(search) ||
                x.GenericName.ToLower().Contains(search) ||
                x.BrandName.ToLower().Contains(search) ||
                x.Manufacturer.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(query.CategoryId))
        {
            var categoryId = MappingExtensions.ParseGuid(query.CategoryId, "Category id");
            medicinesQuery = medicinesQuery.Where(x => x.CategoryId == categoryId);
        }

        if (query.IsActive.HasValue) medicinesQuery = medicinesQuery.Where(x => x.IsActive == query.IsActive.Value);
        if (query.LowStockOnly == true) medicinesQuery = medicinesQuery.Where(x => x.IsActive && x.StockQuantity > 0 && x.StockQuantity <= LowStockThreshold);
        if (query.FeaturedOnly == true) medicinesQuery = medicinesQuery.Where(x => x.IsFeatured);
        if (query.OutOfStockOnly == true) medicinesQuery = medicinesQuery.Where(x => x.StockQuantity <= 0);

        var medicines = await medicinesQuery.OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return new ApiListResponse<MedicineResponse>(medicines.Select(x => x.ToResponse()).ToArray(), medicines.Count);
    }

    public async Task<MedicineResponse?> GetMedicineByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var medicineId = MappingExtensions.ParseGuid(id, "Medicine id");
        var medicine = await dbContext.Medicines.AsNoTracking().Include(x => x.Category).SingleOrDefaultAsync(x => x.Id == medicineId, cancellationToken);
        return medicine?.ToResponse();
    }

    public async Task<MedicineResponse> CreateMedicineAsync(CreateMedicineRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        var categoryId = MappingExtensions.ParseGuid(request.CategoryId, "Category id");
        var category = await dbContext.Categories.SingleOrDefaultAsync(x => x.Id == categoryId, cancellationToken)
            ?? throw new NotFoundAppException("Category", request.CategoryId);

        if (request.DiscountPrice.HasValue && request.DiscountPrice.Value > request.Price)
        {
            throw new ValidationAppException("Discount price cannot be greater than price");
        }

        var medicine = new Medicine
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            GenericName = request.GenericName.Trim(),
            BrandName = request.BrandName.Trim(),
            CategoryId = categoryId,
            Category = category,
            Description = request.Description.Trim(),
            ShortDescription = request.ShortDescription.Trim(),
            Price = request.Price,
            DiscountPrice = request.DiscountPrice,
            StockQuantity = request.StockQuantity,
            SKU = await GenerateSkuAsync(cancellationToken),
            Manufacturer = request.Manufacturer.Trim(),
            DosageForm = request.DosageForm.Trim(),
            Strength = request.Strength.Trim(),
            PackageSize = request.PackageSize.Trim(),
            ImageUrl = request.ImageUrl.Trim(),
            RequiresPrescription = request.RequiresPrescription,
            IsFeatured = request.IsFeatured,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        dbContext.Medicines.Add(medicine);
        await auditLogWriter.WriteAsync(
            actorUserId,
            "MEDICINE_CREATED",
            "Medicine",
            medicine.Id.ToString(),
            $"Medicine {medicine.Name} was created",
            new { medicine.StockQuantity, medicine.IsActive, medicine.IsFeatured },
            cancellationToken);
        await NotifyLowStockIfNeededAsync(medicine, null, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return medicine.ToResponse();
    }

    public async Task<MedicineResponse> UpdateMedicineAsync(string id, UpdateMedicineRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        var medicineId = MappingExtensions.ParseGuid(id, "Medicine id");
        var medicine = await dbContext.Medicines.Include(x => x.Category).SingleOrDefaultAsync(x => x.Id == medicineId, cancellationToken)
            ?? throw new NotFoundAppException("Medicine", id);
        var previousStock = medicine.StockQuantity;

        if (!string.IsNullOrWhiteSpace(request.CategoryId))
        {
            var categoryId = MappingExtensions.ParseGuid(request.CategoryId, "Category id");
            var category = await dbContext.Categories.SingleOrDefaultAsync(x => x.Id == categoryId, cancellationToken)
                ?? throw new NotFoundAppException("Category", request.CategoryId);
            medicine.CategoryId = categoryId;
            medicine.Category = category;
        }

        if (!string.IsNullOrWhiteSpace(request.Name)) medicine.Name = request.Name.Trim();
        if (!string.IsNullOrWhiteSpace(request.GenericName)) medicine.GenericName = request.GenericName.Trim();
        if (!string.IsNullOrWhiteSpace(request.BrandName)) medicine.BrandName = request.BrandName.Trim();
        if (!string.IsNullOrWhiteSpace(request.Description)) medicine.Description = request.Description.Trim();
        if (!string.IsNullOrWhiteSpace(request.ShortDescription)) medicine.ShortDescription = request.ShortDescription.Trim();
        if (request.Price.HasValue) medicine.Price = request.Price.Value;
        if (request.DiscountPrice.HasValue) medicine.DiscountPrice = request.DiscountPrice.Value;
        if (request.StockQuantity.HasValue) medicine.StockQuantity = request.StockQuantity.Value;
        if (!string.IsNullOrWhiteSpace(request.Manufacturer)) medicine.Manufacturer = request.Manufacturer.Trim();
        if (!string.IsNullOrWhiteSpace(request.DosageForm)) medicine.DosageForm = request.DosageForm.Trim();
        if (!string.IsNullOrWhiteSpace(request.Strength)) medicine.Strength = request.Strength.Trim();
        if (!string.IsNullOrWhiteSpace(request.PackageSize)) medicine.PackageSize = request.PackageSize.Trim();
        if (!string.IsNullOrWhiteSpace(request.ImageUrl)) medicine.ImageUrl = request.ImageUrl.Trim();
        if (request.RequiresPrescription.HasValue) medicine.RequiresPrescription = request.RequiresPrescription.Value;
        if (request.IsFeatured.HasValue) medicine.IsFeatured = request.IsFeatured.Value;
        if (request.IsActive.HasValue) medicine.IsActive = request.IsActive.Value;

        if (medicine.DiscountPrice.HasValue && medicine.DiscountPrice.Value > medicine.Price)
        {
            throw new ValidationAppException("Discount price cannot be greater than price");
        }

        medicine.UpdatedAt = DateTime.UtcNow;

        await auditLogWriter.WriteAsync(
            actorUserId,
            "MEDICINE_UPDATED",
            "Medicine",
            medicine.Id.ToString(),
            $"Medicine {medicine.Name} was updated",
            new { medicine.StockQuantity, medicine.IsActive, medicine.IsFeatured },
            cancellationToken);
        await NotifyLowStockIfNeededAsync(medicine, previousStock, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return medicine.ToResponse();
    }

    public async Task<MedicineResponse> UpdateMedicineStatusAsync(string id, UpdateMedicineStatusRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        var medicineId = MappingExtensions.ParseGuid(id, "Medicine id");
        var medicine = await dbContext.Medicines.Include(x => x.Category).SingleOrDefaultAsync(x => x.Id == medicineId, cancellationToken)
            ?? throw new NotFoundAppException("Medicine", id);

        medicine.IsActive = request.IsActive;
        medicine.UpdatedAt = DateTime.UtcNow;

        await auditLogWriter.WriteAsync(
            actorUserId,
            "MEDICINE_STATUS_UPDATED",
            "Medicine",
            medicine.Id.ToString(),
            $"Medicine {medicine.Name} was {(request.IsActive ? "activated" : "deactivated")}",
            new { medicine.StockQuantity, medicine.IsActive },
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return medicine.ToResponse();
    }

    private async Task<string> GenerateSkuAsync(CancellationToken cancellationToken)
    {
        var count = await dbContext.Medicines.CountAsync(cancellationToken);
        return $"MED-{count + 1:000}";
    }

    private async Task NotifyLowStockIfNeededAsync(Medicine medicine, int? previousStockQuantity, CancellationToken cancellationToken)
    {
        var isLowStock = medicine.IsActive && medicine.StockQuantity > 0 && medicine.StockQuantity <= LowStockThreshold;
        var wasLowStock = previousStockQuantity.HasValue && previousStockQuantity.Value > 0 && previousStockQuantity.Value <= LowStockThreshold;

        if (!isLowStock || wasLowStock)
        {
            return;
        }

        await notificationService.AddForRolesAsync(
            [UserRole.Pharmacist, UserRole.SuperAdmin],
            NotificationType.Inventory,
            "Low stock alert",
            $"{medicine.Name} is low on stock with {medicine.StockQuantity} units remaining.",
            "Medicine",
            medicine.Id.ToString(),
            cancellationToken);
    }
}
