using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.API.Common;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;

namespace Saxovat.API.Controllers;

[ApiController]
[Authorize]
[Route("categories")]
public sealed class CategoriesController(ICategoryService categoryService) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType<ApiListResponse<CategoryResponse>>(StatusCodes.Status200OK)]
    public Task<ApiListResponse<CategoryResponse>> GetCategories([FromQuery] GetCategoriesQuery query, CancellationToken cancellationToken)
    {
        if (User.GetRequiredRole() == UserRole.Customer && !query.IsActive.HasValue)
        {
            query.IsActive = true;
        }

        return categoryService.GetCategoriesAsync(query, cancellationToken);
    }

    [Authorize(Roles = "SUPERADMIN")]
    [HttpPost]
    [ProducesResponseType<CategoryResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<CategoryResponse>> CreateCategory([FromBody] CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await categoryService.CreateCategoryAsync(request, User.GetRequiredUserId(), cancellationToken);
        return CreatedAtAction(nameof(GetCategories), new { id = category.Id }, category);
    }

    [Authorize(Roles = "SUPERADMIN")]
    [HttpPut("{id}")]
    [ProducesResponseType<CategoryResponse>(StatusCodes.Status200OK)]
    public Task<CategoryResponse> UpdateCategory(string id, [FromBody] UpdateCategoryRequest request, CancellationToken cancellationToken)
        => categoryService.UpdateCategoryAsync(id, request, User.GetRequiredUserId(), cancellationToken);
}
