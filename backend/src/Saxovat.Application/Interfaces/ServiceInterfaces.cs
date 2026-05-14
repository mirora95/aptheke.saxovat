using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Domain;

namespace Saxovat.Application.Interfaces;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<CurrentUserResponse> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<RefreshTokenResponse> RefreshTokenAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default);
    Task<LoginResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
    Task LogoutAsync(Guid userId, CancellationToken cancellationToken = default);
}

public interface IUserService
{
    Task<ApiListResponse<UserResponse>> GetUsersAsync(GetUsersQuery query, CancellationToken cancellationToken = default);
    Task<ApiListResponse<UserResponse>> GetPharmacistsAsync(CancellationToken cancellationToken = default);
    Task<UserResponse?> GetUserByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<UserResponse> CreatePharmacistAsync(CreatePharmacistRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdatePharmacistAsync(string id, UpdateUserRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateUserStatusAsync(string id, UpdateUserStatusRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default);
    Task<UserResponse> TopUpBalanceAsync(string id, TopUpBalanceRequest request, Guid actorUserId, UserRole actorRole, CancellationToken cancellationToken = default);
    Task<UserResponse> ResetPasswordAsync(string id, ResetPasswordRequest request, Guid actorUserId, UserRole actorRole, CancellationToken cancellationToken = default);
}

public interface ICategoryService
{
    Task<ApiListResponse<CategoryResponse>> GetCategoriesAsync(GetCategoriesQuery query, CancellationToken cancellationToken = default);
    Task<CategoryResponse> CreateCategoryAsync(CreateCategoryRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default);
    Task<CategoryResponse> UpdateCategoryAsync(string id, UpdateCategoryRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default);
}

public interface IMedicineService
{
    Task<ApiListResponse<MedicineResponse>> GetMedicinesAsync(GetMedicinesQuery query, CancellationToken cancellationToken = default);
    Task<MedicineResponse?> GetMedicineByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<MedicineResponse> CreateMedicineAsync(CreateMedicineRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default);
    Task<MedicineResponse> UpdateMedicineAsync(string id, UpdateMedicineRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default);
    Task<MedicineResponse> UpdateMedicineStatusAsync(string id, UpdateMedicineStatusRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default);
}

public interface IOneCImportService
{
    Task<OneCImportResult> SyncMedicinesAsync(CancellationToken cancellationToken = default);
}

public interface IOrderService
{
    Task<ApiListResponse<OrderResponse>> GetOrdersAsync(GetOrdersQuery query, Guid? currentUserId, UserRole currentRole, CancellationToken cancellationToken = default);
    Task<OrderResponse?> GetOrderByIdAsync(string id, Guid? currentUserId, UserRole currentRole, CancellationToken cancellationToken = default);
    Task<OrderResponse> CreateOrderAsync(CreateOrderRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<OrderResponse> UpdateOrderStatusAsync(string id, UpdateOrderStatusRequest request, Guid actorUserId, CancellationToken cancellationToken = default);
}

public interface IPaymentService
{
    Task<PaymentResponse?> GetPaymentByOrderIdAsync(string orderId, Guid currentUserId, UserRole currentRole, CancellationToken cancellationToken = default);
    Task<PaymentResponse> RecordPaymentAsync(string orderId, RecordPaymentRequest request, Guid actorUserId, UserRole actorRole, CancellationToken cancellationToken = default);
}

public interface INotificationService
{
    Task<ApiListResponse<NotificationResponse>> GetNotificationsAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<NotificationResponse> MarkAsReadAsync(string id, Guid userId, CancellationToken cancellationToken = default);
}

public interface IAnalyticsService
{
    Task<DashboardAnalyticsResponse> GetDashboardAnalyticsAsync(UserRole actorRole, CancellationToken cancellationToken = default);
}

public interface IPasswordHasherService
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}

public interface IJwtTokenGenerator
{
    AuthTokensResponse GenerateTokens(User user);
}
