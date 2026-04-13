# Saxovat Backend

ASP.NET Core Web API backend foundation for the Saxovat pharmacy app.

## Structure

- `src/Saxovat.Domain`: core entities and enums
- `src/Saxovat.Application`: frontend-aligned contracts, service interfaces, and API error models
- `src/Saxovat.Infrastructure`: EF Core, PostgreSQL, JWT, hashing, seed data, and service implementations
- `src/Saxovat.API`: controllers, auth/authorization, middleware, and Swagger

## Prerequisites

- .NET SDK 10.0+
- PostgreSQL 15+

## Configuration

Default connection strings are in:

- `src/Saxovat.API/appsettings.json`
- `src/Saxovat.API/appsettings.Development.json`

Update `ConnectionStrings:PostgreSql` if your local PostgreSQL credentials differ.

## Restore

```powershell
cd backend
dotnet restore Saxovat.slnx
```

## Build

```powershell
cd backend
dotnet build Saxovat.slnx --no-restore
```

## Run

```powershell
cd backend\src\Saxovat.API
dotnet run
```

Swagger will be available at:

- `https://localhost:7xxx/swagger`
- `http://localhost:5xxx/swagger`

The exact ports are shown in the startup output or `Properties/launchSettings.json`.

## Database and Seed Data

The API runs `Database.Migrate()` and seed initialization on startup.

Seeded demo users:

- `customer@example.com` / `password`
- `pharmacist@example.com` / `password`
- `admin@example.com` / `password`

Seeded demo data also includes categories, medicines, and one sample order.

## Migrations

The initial migration is already generated in:

- `src/Saxovat.Infrastructure/Persistence/Migrations`

To add another migration later:

```powershell
cd backend
dotnet tool restore
dotnet tool run dotnet-ef migrations add <MigrationName> --project src\Saxovat.Infrastructure\Saxovat.Infrastructure.csproj --startup-project src\Saxovat.API\Saxovat.API.csproj --output-dir Persistence\Migrations
```

## Frontend Integration

The frontend can later switch from mock services to HTTP services by pointing to this API base URL and mapping its prepared contracts to these endpoints:

- `POST /auth/login`
- `GET /auth/me`
- `GET /medicines`
- `GET /medicines/{id}`
- `POST /medicines`
- `PUT /medicines/{id}`
- `PATCH /medicines/{id}/status`
- `GET /categories`
- `POST /categories`
- `PUT /categories/{id}`
- `GET /orders`
- `GET /orders/{id}`
- `POST /orders`
- `PATCH /orders/{id}/status`
- `GET /users`
- `GET /users/{id}`
- `PATCH /users/{id}/status`
- `GET /pharmacists`
- `POST /pharmacists`
- `PUT /pharmacists/{id}`
- `PATCH /pharmacists/{id}/status`
