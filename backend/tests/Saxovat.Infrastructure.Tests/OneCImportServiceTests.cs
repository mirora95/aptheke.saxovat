namespace Saxovat.Infrastructure.Tests;

public sealed class OneCImportServiceTests
{
    [Fact]
    public async Task SyncMedicinesAsync_CreatesMedicinesAndDefaultCategory_WhenExternalIdDoesNotExist()
    {
        await using var dbContext = TestDbContextFactory.Create();
        var service = TestOneCImportServiceFactory.Create(
            dbContext,
            """
            [{ "name":"Paracetamol 500mg","barcode":"111111111","price":10.5,"stock":100,"externalId":"P001" }]
            """);

        var result = await service.SyncMedicinesAsync();

        result.ImportedCount.Should().Be(1);
        result.CreatedCount.Should().Be(1);
        result.UpdatedCount.Should().Be(0);
        result.FailedCount.Should().Be(0);

        var category = await dbContext.Categories.SingleAsync();
        category.Name.Should().Be("Imported from 1C");

        var medicine = await dbContext.Medicines.SingleAsync();
        medicine.ExternalId.Should().Be("P001");
        medicine.Name.Should().Be("Paracetamol 500mg");
        medicine.SKU.Should().Be("111111111");
        medicine.Price.Should().Be(10.5m);
        medicine.StockQuantity.Should().Be(100);
        medicine.CategoryId.Should().Be(category.Id);
        medicine.Description.Should().Be("Paracetamol 500mg");
        medicine.ShortDescription.Should().Be("Paracetamol 500mg");
        medicine.LastSyncedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SyncMedicinesAsync_UpdatesMedicine_WhenExternalIdMatchesExistingRow()
    {
        await using var dbContext = TestDbContextFactory.Create();
        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = "Pain Relief",
            Description = "Pain relief",
            IsActive = true,
        };

        dbContext.Categories.Add(category);
        dbContext.Medicines.Add(new Medicine
        {
            Id = Guid.NewGuid(),
            Name = "Old Name",
            GenericName = string.Empty,
            BrandName = string.Empty,
            CategoryId = category.Id,
            Description = "Old Name",
            ShortDescription = "Old Name",
            Price = 1m,
            StockQuantity = 2,
            SKU = "OLD",
            Manufacturer = string.Empty,
            DosageForm = string.Empty,
            Strength = string.Empty,
            PackageSize = string.Empty,
            ImageUrl = string.Empty,
            IsActive = true,
            ExternalId = "P001",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow.AddDays(-1),
        });
        await dbContext.SaveChangesAsync();

        var service = TestOneCImportServiceFactory.Create(
            dbContext,
            """
            [{ "name":"Paracetamol 500mg","barcode":"111111111","price":10.5,"stock":100,"externalId":"P001" }]
            """);

        var result = await service.SyncMedicinesAsync();

        result.ImportedCount.Should().Be(1);
        result.CreatedCount.Should().Be(0);
        result.UpdatedCount.Should().Be(1);
        result.FailedCount.Should().Be(0);

        var medicine = await dbContext.Medicines.SingleAsync();
        medicine.Name.Should().Be("Paracetamol 500mg");
        medicine.SKU.Should().Be("111111111");
        medicine.Price.Should().Be(10.5m);
        medicine.StockQuantity.Should().Be(100);
        medicine.LastSyncedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SyncMedicinesAsync_CreatesMedicineWithSafeDefaults_WhenOptionalFieldsAreMissing()
    {
        await using var dbContext = TestDbContextFactory.Create();
        var service = TestOneCImportServiceFactory.Create(
            dbContext,
            """
            [{ "externalId":"P002" }]
            """);

        var result = await service.SyncMedicinesAsync();

        result.ImportedCount.Should().Be(1);
        result.CreatedCount.Should().Be(1);
        result.UpdatedCount.Should().Be(0);
        result.FailedCount.Should().Be(0);

        var medicine = await dbContext.Medicines.SingleAsync();
        medicine.ExternalId.Should().Be("P002");
        medicine.Name.Should().Be("Imported medicine P002");
        medicine.Description.Should().Be("Imported medicine P002");
        medicine.ShortDescription.Should().Be("Imported medicine P002");
        medicine.SKU.Should().Be("P002");
        medicine.Price.Should().Be(0m);
        medicine.StockQuantity.Should().Be(0);
        medicine.LastSyncedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SyncMedicinesAsync_ThrowsValidationError_WhenOneCApiIsUnavailable()
    {
        await using var dbContext = TestDbContextFactory.Create();
        var service = TestOneCImportServiceFactory.CreateUnavailable(dbContext);

        var action = async () => await service.SyncMedicinesAsync();

        await action.Should().ThrowAsync<ValidationAppException>()
            .WithMessage("*1C product API is unavailable*");
    }

    private static class TestDbContextFactory
    {
        public static SaxovatDbContext Create()
        {
            var options = new DbContextOptionsBuilder<SaxovatDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;

            return new SaxovatDbContext(options);
        }
    }

    private static class TestOneCImportServiceFactory
    {
        public static IOneCImportService Create(SaxovatDbContext dbContext, string json)
        {
            var httpClient = new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            }))
            {
                BaseAddress = new Uri("http://localhost/InfoBase/hs/productapi/")
            };

            return new OneCImportService(httpClient, dbContext);
        }

        public static IOneCImportService CreateUnavailable(SaxovatDbContext dbContext)
        {
            var httpClient = new HttpClient(new StubHttpMessageHandler(_ => throw new HttpRequestException("Unavailable")))
            {
                BaseAddress = new Uri("http://localhost/InfoBase/hs/productapi/")
            };

            return new OneCImportService(httpClient, dbContext);
        }
    }

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(handler(request));
    }
}
