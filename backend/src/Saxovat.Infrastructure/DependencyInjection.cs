using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Saxovat.Application.Interfaces;
using Saxovat.Infrastructure.Persistence;
using Saxovat.Infrastructure.Security;
using Saxovat.Infrastructure.Services;

namespace Saxovat.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));

        services.AddDbContext<SaxovatDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("PostgreSql")));

        services.AddScoped<IPasswordHasherService, PasswordHasherService>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<AuditLogWriter>();
        services.AddScoped<NotificationService>();
        services.AddScoped<PaymentService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<IMedicineService, MedicineService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<INotificationService>(provider => provider.GetRequiredService<NotificationService>());
        services.AddScoped<IPaymentService>(provider => provider.GetRequiredService<PaymentService>());
        services.AddScoped<IAnalyticsService, AnalyticsService>();

        return services;
    }
}
