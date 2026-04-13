using System.ComponentModel.DataAnnotations;

namespace Saxovat.Application.Contracts;

public record CategoryResponse(
    string Id,
    string Name,
    string Description,
    string? Icon,
    bool IsActive);

public sealed class GetCategoriesQuery
{
    public bool? IsActive { get; set; }
    public string? Search { get; set; }
}

public sealed class CreateCategoryRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    public string? Icon { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateCategoryRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public bool? IsActive { get; set; }
}
