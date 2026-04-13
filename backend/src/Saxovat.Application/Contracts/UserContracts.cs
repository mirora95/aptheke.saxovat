using System.ComponentModel.DataAnnotations;

namespace Saxovat.Application.Contracts;

public record UserResponse(
    string Id,
    string FullName,
    string Phone,
    string Email,
    string Role,
    string? ProfileImage,
    string? Address,
    decimal Balance,
    bool IsActive,
    string CreatedAt);

public sealed class GetUsersQuery
{
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
    public string? Search { get; set; }
}

public sealed class CreatePharmacistRequest
{
    [Required]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Phone { get; set; } = string.Empty;

    public string? Password { get; set; }
    public string? ProfileImage { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateUserRequest
{
    public string? FullName { get; set; }
    [EmailAddress]
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Password { get; set; }
    public string? ProfileImage { get; set; }
    public string? Address { get; set; }
    public bool? IsActive { get; set; }
}

public sealed class UpdateUserStatusRequest
{
    [Required]
    public bool IsActive { get; set; }
}

public sealed class TopUpBalanceRequest
{
    [Range(0.01, double.MaxValue)]
    public decimal Amount { get; set; }

    public string? Note { get; set; }
}
