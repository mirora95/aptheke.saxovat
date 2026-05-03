# 1C Medicine Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manual 1C medicine sync endpoint that imports and updates medicines by `ExternalId`, uses a default import category for new medicines, and returns a robust batch summary.

**Architecture:** Keep `IOneCImportService` in the application layer and implement the integration in infrastructure with a typed `HttpClient`. Persist the new medicine sync fields in EF Core, keep the controller thin, and verify behavior with service-level automated tests using EF Core plus a stubbed HTTP handler.

**Tech Stack:** ASP.NET Core, EF Core, PostgreSQL migrations, xUnit, FluentAssertions, in-memory SQLite or EF Core in-memory test database, typed `HttpClient`

---

### Task 1: Add backend test project scaffolding

**Files:**
- Create: `backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj`
- Create: `backend/tests/Saxovat.Infrastructure.Tests/Usings.cs`
- Modify: `backend/Saxovat.slnx`

- [ ] **Step 1: Write the failing test project references and packages**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="FluentAssertions" Version="8.2.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="10.0.0" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\src\Saxovat.Application\Saxovat.Application.csproj" />
    <ProjectReference Include="..\..\src\Saxovat.Domain\Saxovat.Domain.csproj" />
    <ProjectReference Include="..\..\src\Saxovat.Infrastructure\Saxovat.Infrastructure.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Add global usings for the test project**

```csharp
global using FluentAssertions;
global using Microsoft.EntityFrameworkCore;
global using Microsoft.Extensions.Logging.Abstractions;
global using Saxovat.Application.Common;
global using Saxovat.Domain;
global using Saxovat.Infrastructure.Persistence;
global using Saxovat.Infrastructure.Services;
global using Xunit;
```

- [ ] **Step 3: Add the test project to the solution container**

```xml
<Folder Name="/tests/">
  <Project Path="tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj" />
</Folder>
```

- [ ] **Step 4: Run test discovery to verify the project is wired and currently empty**

Run: `dotnet test backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj --list-tests`
Expected: exit code `0` with no discovered tests yet

### Task 2: Write failing tests for the 1C import service

**Files:**
- Create: `backend/tests/Saxovat.Infrastructure.Tests/OneCImportServiceTests.cs`
- Test: `backend/tests/Saxovat.Infrastructure.Tests/OneCImportServiceTests.cs`

- [ ] **Step 1: Write the failing create/import test**

```csharp
[Fact]
public async Task SyncMedicinesAsync_CreatesMedicinesAndDefaultCategory_WhenExternalIdDoesNotExist()
{
    using var dbContext = TestDbContextFactory.Create();
    var service = TestOneCImportServiceFactory.Create(
        dbContext,
        """[{ "name":"Paracetamol 500mg","barcode":"111111111","price":10.5,"stock":100,"externalId":"P001" }]""");

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
```

- [ ] **Step 2: Run the create/import test to verify it fails**

Run: `dotnet test backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj --filter "FullyQualifiedName~SyncMedicinesAsync_CreatesMedicinesAndDefaultCategory_WhenExternalIdDoesNotExist"`
Expected: FAIL because `OneCImportService` and helper infrastructure do not exist yet

- [ ] **Step 3: Write the failing update test**

```csharp
[Fact]
public async Task SyncMedicinesAsync_UpdatesMedicine_WhenExternalIdMatchesExistingRow()
{
    using var dbContext = TestDbContextFactory.Create();
    var category = new Category { Id = Guid.NewGuid(), Name = "Pain Relief", Description = "Pain relief", IsActive = true };
    dbContext.Categories.Add(category);
    dbContext.Medicines.Add(new Medicine
    {
        Id = Guid.NewGuid(),
        Name = "Old Name",
        GenericName = "",
        BrandName = "",
        CategoryId = category.Id,
        Description = "Old Name",
        ShortDescription = "Old Name",
        Price = 1m,
        StockQuantity = 2,
        SKU = "OLD",
        Manufacturer = "",
        DosageForm = "",
        Strength = "",
        PackageSize = "",
        ImageUrl = "",
        IsActive = true,
        ExternalId = "P001",
        CreatedAt = DateTime.UtcNow.AddDays(-1),
        UpdatedAt = DateTime.UtcNow.AddDays(-1)
    });
    await dbContext.SaveChangesAsync();

    var service = TestOneCImportServiceFactory.Create(
        dbContext,
        """[{ "name":"Paracetamol 500mg","barcode":"111111111","price":10.5,"stock":100,"externalId":"P001" }]""");

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
```

- [ ] **Step 4: Run the update test to verify it fails**

Run: `dotnet test backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj --filter "FullyQualifiedName~SyncMedicinesAsync_UpdatesMedicine_WhenExternalIdMatchesExistingRow"`
Expected: FAIL because the sync service behavior is not implemented

- [ ] **Step 5: Write the failing unavailable-endpoint test**

```csharp
[Fact]
public async Task SyncMedicinesAsync_ThrowsValidationError_WhenOneCApiIsUnavailable()
{
    using var dbContext = TestDbContextFactory.Create();
    var service = TestOneCImportServiceFactory.CreateUnavailable(dbContext);

    var action = async () => await service.SyncMedicinesAsync();

    await action.Should().ThrowAsync<ValidationAppException>()
        .WithMessage("*1C product API is unavailable*");
}
```

- [ ] **Step 6: Run the unavailable-endpoint test to verify it fails**

Run: `dotnet test backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj --filter "FullyQualifiedName~SyncMedicinesAsync_ThrowsValidationError_WhenOneCApiIsUnavailable"`
Expected: FAIL because unavailable-endpoint handling is not implemented

### Task 3: Add application contracts and service interface

**Files:**
- Create: `backend/src/Saxovat.Application/Contracts/OneCImportContracts.cs`
- Modify: `backend/src/Saxovat.Application/Interfaces/ServiceInterfaces.cs`

- [ ] **Step 1: Add the 1C import DTOs and result contract**

```csharp
namespace Saxovat.Application.Contracts;

public sealed class OneCProductDto
{
    public string Name { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public string ExternalId { get; set; } = string.Empty;
}

public sealed record OneCImportResult(
    int ImportedCount,
    int UpdatedCount,
    int CreatedCount,
    int FailedCount);
```

- [ ] **Step 2: Add the application service interface**

```csharp
public interface IOneCImportService
{
    Task<OneCImportResult> SyncMedicinesAsync(CancellationToken cancellationToken = default);
}
```

- [ ] **Step 3: Run the tests to verify they still fail for the missing infrastructure implementation**

Run: `dotnet test backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj`
Expected: FAIL with missing implementation and persistence members, not with contract type errors

### Task 4: Add domain and persistence support

**Files:**
- Modify: `backend/src/Saxovat.Domain/Entities.cs`
- Modify: `backend/src/Saxovat.Infrastructure/Persistence/SaxovatDbContext.cs`
- Create: `backend/src/Saxovat.Infrastructure/Persistence/Migrations/<timestamp>_AddOneCMedicineSync.cs`
- Modify: `backend/src/Saxovat.Infrastructure/Persistence/Migrations/SaxovatDbContextModelSnapshot.cs`

- [ ] **Step 1: Add the new medicine fields**

```csharp
public string ExternalId { get; set; } = string.Empty;
public DateTime? LastSyncedAt { get; set; }
```

- [ ] **Step 2: Update EF Core configuration**

```csharp
entity.HasIndex(x => x.ExternalId).IsUnique();
entity.Property(x => x.ExternalId).HasMaxLength(100).IsRequired();
```

- [ ] **Step 3: Create the migration**

Run: `dotnet ef migrations add AddOneCMedicineSync --project backend/src/Saxovat.Infrastructure/Saxovat.Infrastructure.csproj --startup-project backend/src/Saxovat.API/Saxovat.API.csproj --output-dir Persistence/Migrations`
Expected: new migration adds `ExternalId` and `LastSyncedAt` columns plus a unique index for `ExternalId`

- [ ] **Step 4: Run the tests to verify they still fail only because the service is missing**

Run: `dotnet test backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj`
Expected: FAIL with missing `OneCImportService` behavior rather than schema member errors

### Task 5: Implement the import service and typed HttpClient

**Files:**
- Create: `backend/src/Saxovat.Infrastructure/Services/OneCImportService.cs`
- Modify: `backend/src/Saxovat.Infrastructure/DependencyInjection.cs`
- Modify: `backend/src/Saxovat.API/appsettings.json`
- Modify: `backend/src/Saxovat.API/appsettings.Development.json`

- [ ] **Step 1: Implement the minimal import service**

```csharp
public sealed class OneCImportService(
    HttpClient httpClient,
    SaxovatDbContext dbContext) : IOneCImportService
{
    public async Task<OneCImportResult> SyncMedicinesAsync(CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync("products", cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new ValidationAppException("1C product API is unavailable");
        }

        var products = await response.Content.ReadFromJsonAsync<List<OneCProductDto>>(cancellationToken: cancellationToken)
            ?? [];

        var importedAt = DateTime.UtcNow;
        var created = 0;
        var updated = 0;
        var failed = 0;
        Category? importedCategory = null;

        foreach (var item in products)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(item.ExternalId) || string.IsNullOrWhiteSpace(item.Name))
                {
                    failed++;
                    continue;
                }

                var medicine = await dbContext.Medicines.SingleOrDefaultAsync(x => x.ExternalId == item.ExternalId, cancellationToken);
                if (medicine is null)
                {
                    importedCategory ??= await EnsureImportedCategoryAsync(cancellationToken);
                    dbContext.Medicines.Add(new Medicine
                    {
                        Id = Guid.NewGuid(),
                        Name = item.Name.Trim(),
                        GenericName = string.Empty,
                        BrandName = string.Empty,
                        CategoryId = importedCategory.Id,
                        Description = item.Name.Trim(),
                        ShortDescription = item.Name.Trim(),
                        Price = item.Price,
                        StockQuantity = item.Stock,
                        SKU = item.Barcode.Trim(),
                        Manufacturer = string.Empty,
                        DosageForm = string.Empty,
                        Strength = string.Empty,
                        PackageSize = string.Empty,
                        ImageUrl = string.Empty,
                        RequiresPrescription = false,
                        IsFeatured = false,
                        IsActive = true,
                        ExternalId = item.ExternalId.Trim(),
                        CreatedAt = importedAt,
                        UpdatedAt = importedAt,
                        LastSyncedAt = importedAt
                    });
                    created++;
                }
                else
                {
                    medicine.Name = item.Name.Trim();
                    medicine.SKU = item.Barcode.Trim();
                    medicine.Price = item.Price;
                    medicine.StockQuantity = item.Stock;
                    medicine.UpdatedAt = importedAt;
                    medicine.LastSyncedAt = importedAt;
                    updated++;
                }
            }
            catch
            {
                failed++;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return new OneCImportResult(products.Count, updated, created, failed);
    }
}
```

- [ ] **Step 2: Register the typed HttpClient and service**

```csharp
services.AddHttpClient<IOneCImportService, OneCImportService>(client =>
{
    client.BaseAddress = new Uri(configuration["OneC:BaseUrl"]!);
});
```

- [ ] **Step 3: Add configuration for the 1C endpoint**

```json
"OneC": {
  "BaseUrl": "http://localhost/InfoBase/hs/productapi/"
}
```

- [ ] **Step 4: Run the focused tests to verify the service now passes**

Run: `dotnet test backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj --filter "FullyQualifiedName~OneCImportServiceTests"`
Expected: PASS for create, update, and unavailable-endpoint scenarios

### Task 6: Add the thin sync API endpoint

**Files:**
- Create: `backend/src/Saxovat.API/Controllers/SyncController.cs`

- [ ] **Step 1: Add the sync controller**

```csharp
[ApiController]
[Route("api/sync/1c")]
public sealed class SyncController(IOneCImportService oneCImportService) : ControllerBase
{
    [HttpPost("medicines")]
    [ProducesResponseType<OneCImportResult>(StatusCodes.Status200OK)]
    public Task<OneCImportResult> SyncMedicines(CancellationToken cancellationToken)
        => oneCImportService.SyncMedicinesAsync(cancellationToken);
}
```

- [ ] **Step 2: Run the full backend tests**

Run: `dotnet test backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj`
Expected: PASS with all import service tests green

- [ ] **Step 3: Run a build of the backend solution**

Run: `dotnet build backend/Saxovat.slnx`
Expected: exit code `0`
