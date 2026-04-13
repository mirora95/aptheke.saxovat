using System.ComponentModel.DataAnnotations;

namespace Saxovat.Application.Contracts;

public record MedicineResponse(
    string Id,
    string Name,
    string GenericName,
    string BrandName,
    string CategoryId,
    string CategoryName,
    string Description,
    string ShortDescription,
    decimal Price,
    decimal? DiscountPrice,
    int StockQuantity,
    string SKU,
    string Manufacturer,
    string DosageForm,
    string Strength,
    string PackageSize,
    string ImageUrl,
    IReadOnlyCollection<string> GalleryImages,
    bool RequiresPrescription,
    bool IsFeatured,
    bool IsActive,
    string CreatedAt,
    string UpdatedAt);

public sealed class GetMedicinesQuery
{
    public string? Search { get; set; }
    public string? CategoryId { get; set; }
    public bool? IsActive { get; set; }
    public bool? LowStockOnly { get; set; }
    public bool? FeaturedOnly { get; set; }
    public bool? OutOfStockOnly { get; set; }
}

public sealed class CreateMedicineRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string GenericName { get; set; } = string.Empty;

    [Required]
    public string BrandName { get; set; } = string.Empty;

    [Required]
    public string CategoryId { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string ShortDescription { get; set; } = string.Empty;

    [Range(0, double.MaxValue)]
    public decimal Price { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? DiscountPrice { get; set; }

    [Range(0, int.MaxValue)]
    public int StockQuantity { get; set; }

    [Required]
    public string Manufacturer { get; set; } = string.Empty;

    [Required]
    public string DosageForm { get; set; } = string.Empty;

    [Required]
    public string Strength { get; set; } = string.Empty;

    [Required]
    public string PackageSize { get; set; } = string.Empty;

    [Required]
    public string ImageUrl { get; set; } = string.Empty;

    public bool RequiresPrescription { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateMedicineRequest
{
    public string? Name { get; set; }
    public string? GenericName { get; set; }
    public string? BrandName { get; set; }
    public string? CategoryId { get; set; }
    public string? Description { get; set; }
    public string? ShortDescription { get; set; }
    [Range(0, double.MaxValue)]
    public decimal? Price { get; set; }
    [Range(0, double.MaxValue)]
    public decimal? DiscountPrice { get; set; }
    [Range(0, int.MaxValue)]
    public int? StockQuantity { get; set; }
    public string? Manufacturer { get; set; }
    public string? DosageForm { get; set; }
    public string? Strength { get; set; }
    public string? PackageSize { get; set; }
    public string? ImageUrl { get; set; }
    public bool? RequiresPrescription { get; set; }
    public bool? IsFeatured { get; set; }
    public bool? IsActive { get; set; }
}

public sealed class UpdateMedicineStatusRequest
{
    [Required]
    public bool IsActive { get; set; }
}
