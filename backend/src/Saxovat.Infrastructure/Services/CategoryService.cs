using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class CategoryService(
    SaxovatDbContext dbContext,
    AuditLogWriter auditLogWriter) : ICategoryService
{
    public async Task<ApiListResponse<CategoryResponse>> GetCategoriesAsync(GetCategoriesQuery query, CancellationToken cancellationToken = default)
    {
        var categoriesQuery = dbContext.Categories.AsNoTracking().AsQueryable();

        if (query.IsActive.HasValue)
        {
            categoriesQuery = categoriesQuery.Where(x => x.IsActive == query.IsActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            categoriesQuery = categoriesQuery.Where(x => x.Name.ToLower().Contains(search) || x.Description.ToLower().Contains(search));
        }

        var categories = await categoriesQuery.OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return new ApiListResponse<CategoryResponse>(categories.Select(x => x.ToResponse()).ToArray(), categories.Count);
    }

    public async Task<CategoryResponse> CreateCategoryAsync(CreateCategoryRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        var normalizedName = request.Name.Trim().ToLowerInvariant();
        var duplicate = await dbContext.Categories.AnyAsync(x => x.Name.ToLower() == normalizedName, cancellationToken);
        if (duplicate)
        {
            throw new ConflictAppException("A category with this name already exists");
        }

        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            Icon = string.IsNullOrWhiteSpace(request.Icon) ? null : request.Icon.Trim(),
            IsActive = request.IsActive,
        };

        dbContext.Categories.Add(category);
        await auditLogWriter.WriteAsync(
            actorUserId,
            "CATEGORY_CREATED",
            "Category",
            category.Id.ToString(),
            $"Category {category.Name} was created",
            new { category.IsActive },
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return category.ToResponse();
    }

    public async Task<CategoryResponse> UpdateCategoryAsync(string id, UpdateCategoryRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        var categoryId = MappingExtensions.ParseGuid(id, "Category id");
        var category = await dbContext.Categories.SingleOrDefaultAsync(x => x.Id == categoryId, cancellationToken)
            ?? throw new NotFoundAppException("Category", id);

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var normalizedName = request.Name.Trim().ToLowerInvariant();
            var duplicate = await dbContext.Categories.AnyAsync(x => x.Id != categoryId && x.Name.ToLower() == normalizedName, cancellationToken);
            if (duplicate)
            {
                throw new ConflictAppException("A category with this name already exists");
            }

            category.Name = request.Name.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Description)) category.Description = request.Description.Trim();
        if (request.Icon is not null) category.Icon = string.IsNullOrWhiteSpace(request.Icon) ? null : request.Icon.Trim();
        if (request.IsActive.HasValue) category.IsActive = request.IsActive.Value;

        await auditLogWriter.WriteAsync(
            actorUserId,
            "CATEGORY_UPDATED",
            "Category",
            category.Id.ToString(),
            $"Category {category.Name} was updated",
            new { category.IsActive, category.Icon },
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return category.ToResponse();
    }
}
