using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Saxovat.Domain;

namespace Saxovat.Infrastructure.Persistence;

public sealed class SaxovatDbContext(DbContextOptions<SaxovatDbContext> options) : DbContext(options)
{
    private static readonly ValueConverter<PaymentMethod, string> PaymentMethodConverter =
        new(
            method => method.ToString(),
            value => ParseStoredPaymentMethod(value));

    private static PaymentMethod ParseStoredPaymentMethod(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return PaymentMethod.Cash;
        }

        return value.Trim().ToUpperInvariant() switch
        {
            "CASH" => PaymentMethod.Cash,
            "CASH ON DELIVERY" => PaymentMethod.Cash,
            "BALANCE" => PaymentMethod.Balance,
            "PAY FROM ACCOUNT" => PaymentMethod.Balance,
            "CARD" => PaymentMethod.Card,
            "CLICK" => PaymentMethod.Card,
            _ => PaymentMethod.Cash,
        };
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(50).IsRequired();
            entity.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.Balance).HasPrecision(18, 2);
            entity.Property(x => x.Role).HasConversion<string>().HasMaxLength(50);
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Icon).HasMaxLength(100);
        });

        modelBuilder.Entity<Medicine>(entity =>
        {
            entity.ToTable("medicines");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.SKU).IsUnique();
            entity.HasIndex(x => x.ExternalId).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.GenericName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.BrandName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.ShortDescription).HasMaxLength(500).IsRequired();
            entity.Property(x => x.SKU).HasMaxLength(50).IsRequired();
            entity.Property(x => x.ExternalId).HasMaxLength(100);
            entity.Property(x => x.Manufacturer).HasMaxLength(200).IsRequired();
            entity.Property(x => x.DosageForm).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Strength).HasMaxLength(100).IsRequired();
            entity.Property(x => x.PackageSize).HasMaxLength(100).IsRequired();
            entity.Property(x => x.ImageUrl).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.Price).HasPrecision(18, 2);
            entity.Property(x => x.DiscountPrice).HasPrecision(18, 2);
            entity.HasOne(x => x.Category)
                .WithMany(x => x.Medicines)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.ToTable("orders");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.OrderNumber).IsUnique();
            entity.Property(x => x.OrderNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
            entity.Property(x => x.PaymentStatus).HasConversion<string>().HasMaxLength(50);
            entity.Property(x => x.PaymentMethod).HasConversion(PaymentMethodConverter).HasMaxLength(50);
            entity.Property(x => x.DeliveryType).HasConversion<string>().HasMaxLength(50);
            entity.Property(x => x.DeliveryAddress).HasMaxLength(1000);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.DeliveryFee).HasPrecision(18, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.HasOne(x => x.Customer)
                .WithMany(x => x.Orders)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.ToTable("order_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.MedicineName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ImageUrl).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.TotalPrice).HasPrecision(18, 2);
            entity.HasOne(x => x.Order)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.ToTable("payments");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.OrderId).IsUnique();
            entity.Property(x => x.Method).HasConversion(PaymentMethodConverter).HasMaxLength(50);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.AmountPaid).HasPrecision(18, 2);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasOne(x => x.Order)
                .WithMany(x => x.Payments)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Customer)
                .WithMany(x => x.Payments)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Type).HasConversion<string>().HasMaxLength(50);
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.RelatedEntityType).HasMaxLength(100);
            entity.Property(x => x.RelatedEntityId).HasMaxLength(100);
            entity.HasOne(x => x.User)
                .WithMany(x => x.Notifications)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAt });
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Action).HasMaxLength(100).IsRequired();
            entity.Property(x => x.EntityType).HasMaxLength(100).IsRequired();
            entity.Property(x => x.EntityId).HasMaxLength(100);
            entity.Property(x => x.Description).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.MetadataJson).HasMaxLength(4000);
            entity.HasOne(x => x.ActorUser)
                .WithMany()
                .HasForeignKey(x => x.ActorUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(x => x.CreatedAt);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.Property(x => x.TokenHash).HasMaxLength(256).IsRequired();
            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
