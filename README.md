# Saxovat Pharmacy

Saxovat Pharmacy is a full-stack pharmacy management application with a React frontend and an ASP.NET Core backend. It supports customer shopping flows, pharmacist order handling, admin management, medicine and category catalogs, authentication, analytics, notifications, payments, and OneC medicine synchronization.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, React Router, Tailwind CSS, lucide-react
- Backend: ASP.NET Core, .NET 10, Entity Framework Core, PostgreSQL, JWT authentication
- Tests: xUnit backend tests and Node.js API client tests

## Project Structure

```text
.
├── src/                         # React frontend
│   ├── components/              # Shared UI and navigation
│   ├── context/                 # Auth and cart state
│   ├── screens/                 # Customer, pharmacist, admin, and auth screens
│   └── services/                # API client, session storage, mock data
├── backend/
│   ├── src/Saxovat.API          # Web API controllers, middleware, Swagger
│   ├── src/Saxovat.Application  # Contracts and service interfaces
│   ├── src/Saxovat.Domain       # Entities and enums
│   ├── src/Saxovat.Infrastructure # EF Core, services, migrations, seed data
│   └── tests/                   # Backend tests
└── docs/                        # Design and implementation notes
```

## Prerequisites

- Node.js 20+
- .NET SDK 10.0+
- PostgreSQL 15+

## Frontend Setup

Install dependencies:

```powershell
npm install
```

Run the frontend:

```powershell
npm run dev
```

The Vite dev server runs on:

```text
http://localhost:3000
```

By default, the frontend calls the backend at `http://localhost:5062`. To use a different API URL, create a local environment file and set:

```text
VITE_API_BASE_URL=http://localhost:5062
```

## Backend Setup

Restore and build:

```powershell
cd backend
dotnet restore Saxovat.slnx
dotnet build Saxovat.slnx --no-restore
```

Run the API:

```powershell
cd src\Saxovat.API
dotnet run
```

Default API URLs:

```text
http://localhost:5062
https://localhost:7274
```

Swagger is available at `/swagger` when the API is running.

## Configuration

Backend configuration is stored in:

- `backend/src/Saxovat.API/appsettings.json`
- `backend/src/Saxovat.API/appsettings.Development.json`

Update `ConnectionStrings:PostgreSql` for your local PostgreSQL database.

The OneC medicine sync base URL is configured with:

```json
{
  "OneC": {
    "BaseUrl": "http://localhost/InfoBase/hs/productapi/"
  }
}
```

## Database

The API applies EF Core migrations and initializes seed data on startup.

Seeded demo users:

- `customer@example.com` / `password`
- `pharmacist@example.com` / `password`
- `admin@example.com` / `password`

To add a migration:

```powershell
cd backend
dotnet tool restore
dotnet tool run dotnet-ef migrations add <MigrationName> --project src\Saxovat.Infrastructure\Saxovat.Infrastructure.csproj --startup-project src\Saxovat.API\Saxovat.API.csproj --output-dir Persistence\Migrations
```

## Tests

Run the frontend API client tests (mocked requests; no backend or credentials needed):

```powershell
npm test
```

Run backend tests:

```powershell
dotnet test backend/Saxovat.slnx
```

Run TypeScript checks:

```powershell
npm run lint
```

Build the frontend:

```powershell
npm run build
```

## Main API Areas

- Authentication: `/auth/login`, `/auth/me`
- Medicines: `/medicines`
- Categories: `/categories`
- Orders: `/orders`
- Users and pharmacists: `/users`, `/pharmacists`
- Notifications and analytics
- OneC synchronization: `/sync`
