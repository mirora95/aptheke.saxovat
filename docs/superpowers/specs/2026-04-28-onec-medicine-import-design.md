# 1C Medicine Import Design

## Goal

Add a manual 1C medicine sync flow that imports product data from the local 1C HTTP API into the Saxovat pharmacy backend, updates existing medicines by `ExternalId`, creates missing medicines with safe defaults, and returns a batch summary without placing 1C-specific logic in controllers or `MedicineService`.

## Current Context

The backend follows a simple Clean Architecture split:

- `Saxovat.Domain` contains entities.
- `Saxovat.Application` contains contracts and service interfaces.
- `Saxovat.Infrastructure` contains EF Core persistence and service implementations.
- `Saxovat.API` contains thin MVC controllers and application startup.

`Medicine` currently requires fields that 1C does not provide, including `CategoryId`, `Description`, `GenericName`, `BrandName`, `Manufacturer`, `DosageForm`, `Strength`, `PackageSize`, and `ImageUrl`. The import flow must fill these safely instead of failing.

## Requirements

### Functional

- Add `ExternalId` to `Medicine`.
- Add `LastSyncedAt` to `Medicine`.
- Create a `OneCProductDto` with `name`, `barcode`, `price`, `stock`, and `externalId`.
- Add `IOneCImportService` in the application layer.
- Implement `OneCImportService` in infrastructure using a typed `HttpClient`.
- Expose `POST /api/sync/1c/medicines`.
- Match existing medicines by `ExternalId`.
- Update existing medicines with:
  - `Name`
  - `SKU`
  - `Price`
  - `StockQuantity`
  - `UpdatedAt`
  - `LastSyncedAt`
- Create new medicines when no matching `ExternalId` exists.
- Ensure a default category named `Imported from 1C` exists and use it for new medicines imported from 1C.
- Continue processing the batch if one item fails, incrementing `FailedCount`.
- Return:
  - `ImportedCount`
  - `UpdatedCount`
  - `CreatedCount`
  - `FailedCount`

### Mapping Rules

- `name -> Medicine.Name`
- `barcode -> Medicine.SKU`
- `price -> Medicine.Price`
- `stock -> Medicine.StockQuantity`
- `externalId -> Medicine.ExternalId`

### Safe Defaults for New Medicines

- `CategoryId = ImportedFrom1CCategory.Id`
- `Description = item.name`
- `ShortDescription = item.name`
- `GenericName = ""`
- `BrandName = ""`
- `Manufacturer = ""`
- `DosageForm = ""`
- `Strength = ""`
- `PackageSize = ""`
- `ImageUrl = ""`
- `RequiresPrescription = false`
- `IsFeatured = false`
- `IsActive = true`

## Proposed Architecture

### Domain and Persistence

`Medicine` will gain `ExternalId` and `LastSyncedAt`. EF Core configuration in `SaxovatDbContext` will add:

- a unique index on `ExternalId`
- max length configuration for `ExternalId`
- nullable support for `LastSyncedAt`

A new EF migration will update the schema and model snapshot.

### Application Layer

Add integration contracts in `Saxovat.Application.Contracts`:

- `OneCProductDto`
- `OneCImportResult`

Add `IOneCImportService` in `Saxovat.Application.Interfaces` with a single sync method that accepts a `CancellationToken` and returns the summary contract.

This keeps the controller thin and prevents 1C-specific concerns from leaking into `MedicineService`.

### Infrastructure Layer

`OneCImportService` will:

1. Call the configured 1C endpoint using the typed `HttpClient`.
2. Handle transport and non-success HTTP failures with a clean application exception.
3. Deserialize the JSON array into `OneCProductDto[]`.
4. Load existing medicines matched by `ExternalId`.
5. Ensure the default category `Imported from 1C` exists before any new rows are created.
6. For each item:
   - skip invalid records with `FailedCount` incremented
   - update an existing medicine when `ExternalId` matches
   - create a new medicine otherwise
   - set `LastSyncedAt` to the current UTC time
7. Save the full batch once and return the import summary.

Per-item failures should not abort the entire batch. The service should isolate item-level exceptions, count them, and continue to the next record.

### API Layer

Add a dedicated `SyncController` with `POST /api/sync/1c/medicines`.

The controller should:

- inject `IOneCImportService`
- delegate directly to the service
- return the summary DTO

No 1C HTTP calls, matching logic, or persistence logic should be placed in the controller.

## Error Handling

- If the 1C endpoint cannot be reached, times out, or returns a non-success status, the service should throw an application exception with a clear integration message such as `1C product API is unavailable`.
- If deserialization fails, the service should throw an application exception indicating invalid 1C payload format.
- If an individual item is missing required mapping data such as `externalId` or `name`, that item should count as failed and the batch should continue.

## Testing Strategy

Add automated tests focused on the import service:

- creates a new medicine and auto-creates `Imported from 1C`
- updates an existing medicine by `ExternalId`
- throws a clean error when the 1C endpoint is unavailable

Tests should exercise real EF Core behavior with an isolated test database provider and a stubbed `HttpMessageHandler` for the typed `HttpClient`.

## Files Expected to Change

- `backend/src/Saxovat.Domain/Entities.cs`
- `backend/src/Saxovat.Application/Contracts/*`
- `backend/src/Saxovat.Application/Interfaces/ServiceInterfaces.cs`
- `backend/src/Saxovat.Infrastructure/DependencyInjection.cs`
- `backend/src/Saxovat.Infrastructure/Persistence/SaxovatDbContext.cs`
- `backend/src/Saxovat.Infrastructure/Persistence/Migrations/*`
- `backend/src/Saxovat.Infrastructure/Services/OneCImportService.cs`
- `backend/src/Saxovat.API/Controllers/SyncController.cs`
- `backend/src/Saxovat.API/appsettings*.json`
- new backend test project and test files

## Scope Notes

This design covers a manual sync endpoint only. Scheduled sync jobs, conflict resolution policies beyond `ExternalId`, and detailed per-item error reporting are intentionally out of scope.
