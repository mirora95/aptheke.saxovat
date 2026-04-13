using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Interfaces;
using Saxovat.Domain;

namespace Saxovat.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(SaxovatDbContext dbContext, IPasswordHasherService passwordHasher, CancellationToken cancellationToken = default)
    {
        await dbContext.Database.MigrateAsync(cancellationToken);

        if (await dbContext.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        var customerId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var pharmacistId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var adminId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var painCategoryId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
        var antibioticsCategoryId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
        var vitaminsCategoryId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3");
        var medicineOneId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1");
        var medicineTwoId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2");
        var medicineThreeId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3");
        var orderId = Guid.Parse("cccccccc-cccc-cccc-cccc-ccccccccccc1");

        var users = new[]
        {
            new User
            {
                Id = customerId,
                FullName = "Otabek Mirdadoev",
                Email = "customer@example.com",
                Phone = "+998901234567",
                PasswordHash = passwordHasher.HashPassword("password"),
                Role = UserRole.Customer,
                Address = "Tashkent, Yunusobod",
                Balance = 80000m,
                IsActive = true,
                CreatedAt = DateTime.Parse("2024-01-01T10:00:00Z").ToUniversalTime(),
            },
            new User
            {
                Id = pharmacistId,
                FullName = "Dr. Azizbek",
                Email = "pharmacist@example.com",
                Phone = "+998907654321",
                PasswordHash = passwordHasher.HashPassword("password"),
                Role = UserRole.Pharmacist,
                Balance = 0m,
                IsActive = true,
                CreatedAt = DateTime.Parse("2024-01-01T10:00:00Z").ToUniversalTime(),
            },
            new User
            {
                Id = adminId,
                FullName = "Admin Saxovat",
                Email = "admin@example.com",
                Phone = "+998990000000",
                PasswordHash = passwordHasher.HashPassword("password"),
                Role = UserRole.SuperAdmin,
                Balance = 0m,
                IsActive = true,
                CreatedAt = DateTime.Parse("2024-01-01T10:00:00Z").ToUniversalTime(),
            }
        };

        var categories = new[]
        {
            new Category { Id = painCategoryId, Name = "Pain Relief", Description = "Medicines for pain and fever", Icon = "pill", IsActive = true },
            new Category { Id = antibioticsCategoryId, Name = "Antibiotics", Description = "Bacterial infection treatments", Icon = "shield-plus", IsActive = true },
            new Category { Id = vitaminsCategoryId, Name = "Vitamins", Description = "Supplements and vitamins", Icon = "sparkles", IsActive = true },
        };

        var createdAt = DateTime.Parse("2024-01-01T10:00:00Z").ToUniversalTime();
        var medicines = new[]
        {
            new Medicine
            {
                Id = medicineOneId,
                Name = "Paracetamol 500mg",
                GenericName = "Paracetamol",
                BrandName = "Panadol",
                CategoryId = painCategoryId,
                Description = "Effective relief from pain and fever.",
                ShortDescription = "Pain and fever relief",
                Price = 15000m,
                StockQuantity = 150,
                SKU = "MED-001",
                Manufacturer = "GSK",
                DosageForm = "Tablet",
                Strength = "500mg",
                PackageSize = "20 Tablets",
                ImageUrl = "https://picsum.photos/seed/paracetamol/400/400",
                RequiresPrescription = false,
                IsFeatured = true,
                IsActive = true,
                CreatedAt = createdAt,
                UpdatedAt = createdAt,
            },
            new Medicine
            {
                Id = medicineTwoId,
                Name = "Amoxicillin 250mg",
                GenericName = "Amoxicillin",
                BrandName = "Amoxil",
                CategoryId = antibioticsCategoryId,
                Description = "Broad-spectrum antibiotic for bacterial infections.",
                ShortDescription = "Bacterial infection treatment",
                Price = 45000m,
                StockQuantity = 20,
                SKU = "MED-002",
                Manufacturer = "Pfizer",
                DosageForm = "Capsule",
                Strength = "250mg",
                PackageSize = "15 Capsules",
                ImageUrl = "https://picsum.photos/seed/amoxicillin/400/400",
                RequiresPrescription = true,
                IsFeatured = false,
                IsActive = true,
                CreatedAt = createdAt,
                UpdatedAt = createdAt,
            },
            new Medicine
            {
                Id = medicineThreeId,
                Name = "Vitamin C 1000mg",
                GenericName = "Ascorbic Acid",
                BrandName = "C-Vit",
                CategoryId = vitaminsCategoryId,
                Description = "Immune system support and antioxidant.",
                ShortDescription = "Immune support",
                Price = 35000m,
                StockQuantity = 200,
                SKU = "MED-003",
                Manufacturer = "Bayer",
                DosageForm = "Effervescent Tablet",
                Strength = "1000mg",
                PackageSize = "10 Tablets",
                ImageUrl = "https://picsum.photos/seed/vitaminc/400/400",
                RequiresPrescription = false,
                IsFeatured = true,
                IsActive = true,
                CreatedAt = createdAt,
                UpdatedAt = createdAt,
            },
        };

        var order = new Order
        {
            Id = orderId,
            OrderNumber = "ORD-2024-001",
            CustomerId = customerId,
            Status = OrderStatus.Delivered,
            PaymentStatus = PaymentStatus.Paid,
            PaymentMethod = PaymentMethod.Card,
            DeliveryType = DeliveryType.Delivery,
            DeliveryAddress = "Tashkent, Yunusobod 19-2-45",
            Subtotal = 30000m,
            DeliveryFee = 15000m,
            DiscountAmount = 0m,
            TotalAmount = 45000m,
            CreatedAt = DateTime.Parse("2024-02-15T14:30:00Z").ToUniversalTime(),
            UpdatedAt = DateTime.Parse("2024-02-15T16:00:00Z").ToUniversalTime(),
            Items =
            {
                new OrderItem
                {
                    Id = Guid.Parse("dddddddd-dddd-dddd-dddd-ddddddddddd1"),
                    MedicineId = medicineOneId,
                    MedicineName = "Paracetamol 500mg",
                    Quantity = 2,
                    UnitPrice = 15000m,
                    TotalPrice = 30000m,
                    ImageUrl = "https://picsum.photos/seed/paracetamol/400/400",
                }
            }
        };

        var payment = new Payment
        {
            Id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1"),
            OrderId = orderId,
            CustomerId = customerId,
            Method = PaymentMethod.Card,
            Status = PaymentStatus.Paid,
            Amount = 45000m,
            AmountPaid = 45000m,
            Notes = "Seeded card payment",
            CreatedAt = DateTime.Parse("2024-02-15T14:32:00Z").ToUniversalTime(),
            ProcessedAt = DateTime.Parse("2024-02-15T14:32:00Z").ToUniversalTime(),
            UpdatedAt = DateTime.Parse("2024-02-15T14:32:00Z").ToUniversalTime(),
        };

        var notifications = new[]
        {
            new Notification
            {
                Id = Guid.Parse("ffffffff-ffff-ffff-ffff-fffffffffff1"),
                UserId = customerId,
                Type = NotificationType.Order,
                Title = "Order delivered",
                Message = "Your seeded order ORD-2024-001 has been delivered.",
                RelatedEntityType = "Order",
                RelatedEntityId = orderId.ToString(),
                IsRead = false,
                CreatedAt = DateTime.Parse("2024-02-15T16:00:00Z").ToUniversalTime(),
            },
            new Notification
            {
                Id = Guid.Parse("ffffffff-ffff-ffff-ffff-fffffffffff2"),
                UserId = pharmacistId,
                Type = NotificationType.Inventory,
                Title = "Low stock alert",
                Message = "Amoxicillin 250mg is at low stock level.",
                RelatedEntityType = "Medicine",
                RelatedEntityId = medicineTwoId.ToString(),
                IsRead = false,
                CreatedAt = DateTime.Parse("2024-02-16T10:00:00Z").ToUniversalTime(),
            },
        };

        var auditLogs = new[]
        {
            new AuditLog
            {
                Id = Guid.Parse("abababab-abab-abab-abab-ababababab01"),
                ActorUserId = customerId,
                Action = "ORDER_CREATED",
                EntityType = "Order",
                EntityId = orderId.ToString(),
                Description = "Seeded order was created",
                CreatedAt = DateTime.Parse("2024-02-15T14:30:00Z").ToUniversalTime(),
            },
            new AuditLog
            {
                Id = Guid.Parse("abababab-abab-abab-abab-ababababab02"),
                ActorUserId = pharmacistId,
                Action = "PAYMENT_RECORDED",
                EntityType = "Payment",
                EntityId = payment.Id.ToString(),
                Description = "Seeded payment was completed",
                CreatedAt = DateTime.Parse("2024-02-15T14:32:00Z").ToUniversalTime(),
            },
        };

        await dbContext.Users.AddRangeAsync(users, cancellationToken);
        await dbContext.Categories.AddRangeAsync(categories, cancellationToken);
        await dbContext.Medicines.AddRangeAsync(medicines, cancellationToken);
        await dbContext.Orders.AddAsync(order, cancellationToken);
        await dbContext.Payments.AddAsync(payment, cancellationToken);
        await dbContext.Notifications.AddRangeAsync(notifications, cancellationToken);
        await dbContext.AuditLogs.AddRangeAsync(auditLogs, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
