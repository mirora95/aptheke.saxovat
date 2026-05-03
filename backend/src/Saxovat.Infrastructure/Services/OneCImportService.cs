using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class OneCImportService(
    HttpClient httpClient,
    SaxovatDbContext dbContext) : IOneCImportService
{
    private const string DefaultImportedCategoryName = "Imported from 1C";

    public async Task<OneCImportResult> SyncMedicinesAsync(CancellationToken cancellationToken = default)
    {
        var products = await FetchProductsAsync(cancellationToken);
        var importedAt = DateTime.UtcNow;

        var medicinesByExternalId = await dbContext.Medicines
            .Where(x => x.ExternalId != null)
            .ToDictionaryAsync(x => x.ExternalId!, cancellationToken);

        var skuOwners = await dbContext.Medicines
            .AsNoTracking()
            .Where(x => !string.IsNullOrWhiteSpace(x.SKU))
            .ToDictionaryAsync(x => x.SKU, x => x.Id, cancellationToken);

        var createdCount = 0;
        var updatedCount = 0;
        var failedCount = 0;
        Category? importedCategory = null;

        foreach (var item in products)
        {
            try
            {
                var externalId = item.ExternalId.Trim();

                if (string.IsNullOrWhiteSpace(externalId))
                {
                    failedCount++;
                    continue;
                }

                var name = SafeText(item.Name, $"Imported medicine {externalId}");
                var barcode = SafeText(item.Barcode, externalId);
                var price = Math.Max(0m, item.Price);
                var stock = Math.Max(0, item.Stock);

                if (medicinesByExternalId.TryGetValue(externalId, out var existingMedicine))
                {
                    if (skuOwners.TryGetValue(barcode, out var skuOwnerId) && skuOwnerId != existingMedicine.Id)
                    {
                        failedCount++;
                        continue;
                    }

                    existingMedicine.Name = name;
                    existingMedicine.SKU = barcode;
                    existingMedicine.Price = price;
                    existingMedicine.StockQuantity = stock;
                    existingMedicine.UpdatedAt = importedAt;
                    existingMedicine.LastSyncedAt = importedAt;

                    skuOwners[barcode] = existingMedicine.Id;
                    updatedCount++;
                    continue;
                }

                if (skuOwners.ContainsKey(barcode))
                {
                    failedCount++;
                    continue;
                }

                importedCategory ??= await EnsureImportedCategoryAsync(cancellationToken);

                var medicine = new Medicine
                {
                    Id = Guid.NewGuid(),
                    Name = name,
                    GenericName = string.Empty,
                    BrandName = string.Empty,
                    CategoryId = importedCategory.Id,
                    Description = name,
                    ShortDescription = name,
                    Price = price,
                    DiscountPrice = null,
                    StockQuantity = stock,
                    SKU = barcode,
                    ExternalId = externalId,
                    Manufacturer = string.Empty,
                    DosageForm = string.Empty,
                    Strength = string.Empty,
                    PackageSize = string.Empty,
                    ImageUrl = string.Empty,
                    RequiresPrescription = false,
                    IsFeatured = false,
                    IsActive = true,
                    CreatedAt = importedAt,
                    UpdatedAt = importedAt,
                    LastSyncedAt = importedAt,
                };

                dbContext.Medicines.Add(medicine);
                medicinesByExternalId[externalId] = medicine;
                skuOwners[barcode] = medicine.Id;
                createdCount++;
            }
            catch
            {
                failedCount++;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return new OneCImportResult(
            ImportedCount: products.Count,
            UpdatedCount: updatedCount,
            CreatedCount: createdCount,
            FailedCount: failedCount);
    }

    private async Task<List<OneCProductDto>> FetchProductsAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.GetAsync("products", cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw new ValidationAppException("1C product API is unavailable");
            }

            return await response.Content.ReadFromJsonAsync<List<OneCProductDto>>(cancellationToken: cancellationToken)
                ?? [];
        }
        catch (ValidationAppException)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            throw new ValidationAppException("1C product API is unavailable");
        }
        catch (TaskCanceledException)
        {
            throw new ValidationAppException("1C product API is unavailable");
        }
        catch (JsonException)
        {
            throw new ValidationAppException("1C product API returned an invalid payload");
        }
        catch (NotSupportedException)
        {
            throw new ValidationAppException("1C product API returned an invalid payload");
        }
    }

    private async Task<Category> EnsureImportedCategoryAsync(CancellationToken cancellationToken)
    {
        var category = await dbContext.Categories.SingleOrDefaultAsync(
            x => x.Name == DefaultImportedCategoryName,
            cancellationToken);

        if (category is not null)
        {
            return category;
        }

        category = new Category
        {
            Id = Guid.NewGuid(),
            Name = DefaultImportedCategoryName,
            Description = "Medicines imported from 1C",
            IsActive = true,
        };

        dbContext.Categories.Add(category);
        return category;
    }

    private static string SafeText(string? value, string fallback)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? fallback : trimmed;
    }
}
