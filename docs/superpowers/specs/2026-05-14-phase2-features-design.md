# Phase 2 Features: Notifications, Registration, Audit Log, Token Refresh, Docker, Charts

## 1. Real-time Notifications (SignalR)

### Architecture
Add an ASP.NET Core SignalR hub for pushing order status updates to connected clients. The existing `NotificationService` persists notifications to DB; the SignalR hub provides real-time push alongside the persistence.

### Backend Changes

**SignalR Hub** (`Saxovat.API/Hubs/OrderHub.cs`):
- Route: `/hubs/orders`
- Authenticated via JWT (configured in Program.cs)
- On connect: customers join a group matching their `userId`, pharmacists join a `pharmacists` group
- No server-invokable methods needed — server pushes only

**OrderService Update** (`Saxovat.Infrastructure/Services/OrderService.cs`):
- Inject `IHubContext<OrderHub>` via constructor
- After successful status update in `UpdateOrderStatusAsync`:
  1. Create persisted `Notification` via `NotificationService` (existing behavior)
  2. Push `OrderStatusChanged` event to customer's group + `pharmacists` group
  3. Event payload: `{ orderId, orderNumber, newStatus, customerId, timestamp }`

**NotificationService Update** (`Saxovat.Infrastructure/Services/NotificationService.cs`):
- Add method `GetUnreadCountAsync(userId)` for badge counter
- Already persists notifications — no structural change needed

**Startup** (`Saxovat.API/Program.cs`):
- `builder.Services.AddSignalR()`
- `app.MapHub<OrderHub>("/hubs/orders")`

### Frontend Changes

**Dependencies**: Add `@microsoft/signalr` npm package

**New Context** (`src/context/NotificationContext.tsx`):
- Creates `HubConnection` on auth state change (connect when logged in, disconnect on logout)
- Listens for `OrderStatusChanged` event
- Exposes: `notifications[]`, `unreadCount`, `markAsRead(id)`, `toast` (inline component)
- Stores last 50 notifications in state

**Toast Component** (inline in `NotificationContext` or new component):
- Shows animated slide-in toast when `OrderStatusChanged` fires
- Contains: order number, new status, link to order details
- Auto-dismisses after 6 seconds

**Badge Update**:
- `CustomerNavbar` reads `unreadCount` from notification context
- Shows badge on orders nav link

### Test Strategy
- Unit test `OrderService.UpdateOrderStatusAsync` with mocked `IHubContext<OrderHub>` to verify SendAsync is called with correct payload
- Hub connection/disconnection behavior tested via integration

### Files Changed/Added
- `backend/src/Saxovat.API/Hubs/OrderHub.cs` (new)
- `backend/src/Saxovat.API/Program.cs` (add SignalR)
- `backend/src/Saxovat.Infrastructure/Services/OrderService.cs` (add hub push)
- `backend/src/Saxovat.Infrastructure/Services/NotificationService.cs` (add unread count)
- `backend/src/Saxovat.API/Saxovat.API.csproj` (SignalR ref — already in ASP.NET Core)
- `src/context/NotificationContext.tsx` (new)
- `src/components/NotificationToast.tsx` (new)
- `src/components/Navigation.tsx` (badge update)
- `package.json` (add @microsoft/signalr)

---

## 2. Customer Registration & Password Reset

### Registration

**Backend — AuthService Extension** (`Saxovat.Infrastructure/Services/AuthService.cs`):
- New method `RegisterAsync(RegisterRequest request)`:
  - Validate email uniqueness
  - Create User (role: Customer, isActive: true)
  - Hash password, save to DB
  - Return `LoginResponse` with JWT tokens (auto-login)
- New DTO: `RegisterRequest { fullName, email, phone, password }` in `Saxovat.Application.Contracts`

**Backend — AuthController** (`Saxovat.API/Controllers/AuthController.cs`):
- `POST /auth/register` — public, no auth required
- Returns `LoginResponse`

**Frontend**:
- New `RegisterScreen` at `/register`
- Form: fullName, email, phone, password, confirm password
- On success: auto-login and redirect to customer home
- Link from login page: "Don't have an account? Register"
- Validation: email format, password min length, confirm match

**Files Changed/Added**:
- `backend/src/Saxovat.Application/Contracts/AuthContracts.cs` (add RegisterRequest)
- `backend/src/Saxovat.Infrastructure/Services/AuthService.cs` (add register)
- `backend/src/Saxovat.API/Controllers/AuthController.cs` (add /auth/register)
- `src/screens/AuthScreens.tsx` (add RegisterScreen)
- `src/App.tsx` (add /register route)

### Password Reset

**Backend**:
- `PATCH /users/{id}/reset-password` — requires `PHARMACIST` or `SUPERADMIN` role
- Accepts `{ newPassword }`, hashes and updates user's `PasswordHash`
- Validates minimum password length, user exists
- No email/token flow — pharmacist/admin directly sets new password

**Frontend**:
- Admin/Pharmacist user management: "Reset Password" button on user detail/edit
- Modal or inline form with new password + confirm password fields
- Calls `PATCH /users/{id}/reset-password`
- Only available for roles below the acting user's role (admin can reset any, pharmacist can reset customers)

**Files Changed/Added**:
- `backend/src/Saxovat.Application/Contracts/UserContracts.cs` (add ResetPasswordRequest)
- `backend/src/Saxovat.Application/Interfaces/ServiceInterfaces.cs` (add method)
- `backend/src/Saxovat.Infrastructure/Services/UserService.cs` (add reset password)
- `backend/src/Saxovat.API/Controllers/UsersController.cs` (add PATCH endpoint)
- `src/screens/AdminScreens.tsx` (add reset password UI)
- `src/screens/PharmacistScreens.tsx` (add reset password UI)

---

## 3. Audit Log Viewer

### Backend — Query Endpoint

**New Interface** (`Saxovat.Application.Interfaces`):
- `IAuditLogService { Task<ApiListResponse<AuditLogResponse>> GetAuditLogsAsync(AuditLogQuery query) }`

**New DTOs** (`Saxovat.Application.Contracts`):
- `AuditLogResponse { id, actorName, action, entityType, entityId, description, createdAt }`
- `AuditLogQuery { entityType?, actorId?, from?, to?, page, pageSize }`

**New Service** (`Saxovat.Infrastructure.Services.AuditLogService.cs`):
- Query `AuditLog` table with filters + pagination
- Join with `User` for actor name
- Default page size 20, max 100

**New Controller** (`Saxovat.API/Controllers/AuditLogsController.cs`):
- `GET /api/audit-logs` — requires `SUPERADMIN` role
- Returns paginated list

### Frontend

**New Screen** (`src/screens/AuditLogsScreen.tsx`):
- Table columns: Timestamp, Actor, Action, Entity Type, Entity ID, Description
- Filters: entity type dropdown, date range picker, text search
- Pagination controls
- Only accessible to SUPERADMIN role

**Sidebar Update** (`src/App.tsx`):
- Add "Audit Logs" link to admin sidebar between Reports and Settings
- Icon: `History` (from lucide-react)

**Service Update** (`src/services/index.ts`):
- Add `IAuditLogService` interface
- Add `ApiAuditLogService` implementation hitting `/audit-logs`

### Files Changed/Added
- `backend/src/Saxovat.Application/Contracts/AuditLogContracts.cs` (new)
- `backend/src/Saxovat.Application/Interfaces/ServiceInterfaces.cs` (add IAuditLogService)
- `backend/src/Saxovat.Infrastructure/Services/AuditLogService.cs` (new)
- `backend/src/Saxovat.Infrastructure/DependencyInjection.cs` (register)
- `backend/src/Saxovat.API/Controllers/AuditLogsController.cs` (new)
- `src/screens/AuditLogsScreen.tsx` (new)
- `src/App.tsx` (add route + sidebar link)
- `src/services/index.ts` (add service)
- `src/types/index.ts` (add types if needed)

---

## 4. Token Refresh

### Backend

**New Entity** (`Saxovat.Domain.Entities`):
- `RefreshToken { Id, UserId, Token (hashed), ExpiresAt, IsUsed, CreatedAt }`
- Navigation to `User`

**EF Core Configuration**:
- `SaxovatDbContext` — add `DbSet<RefreshToken>`, configure indexes on `Token`
- New migration: `AddRefreshTokens`

**AuthService Extension** (`Saxovat.Infrastructure.Services.AuthService`):
- `LoginAsync` now also generates and stores a refresh token
- `RefreshTokenAsync(RefreshTokenRequest request)`:
  1. Hash incoming token
  2. Find matching `RefreshToken` by hash where `!IsUsed && ExpiresAt > UtcNow`
  3. Mark found token as used
  4. Issue new access + refresh token pair
  5. Return `RefreshTokenResponse`
- Token expiry: access token 1 hour, refresh token 7 days

**New DTOs**:
- `RefreshTokenRequest { refreshToken }` (already exists in frontend types but backends needs it)
- Adjust `AuthTokensResponse` to include `refreshToken`

### Frontend

**apiClient.ts Interceptor**:
- On 401 response:
  1. Check if we have a refresh token (from `authSession.ts`)
  2. Call `POST /auth/refresh` with refresh token
  3. If success: update stored tokens, retry original request
  4. If fail: emit `AUTH_UNAUTHORIZED_EVENT`, clear session
- Guard against infinite loop (only retry once)

**authSession.ts Update**:
- Store and expose refresh token
- `getStoredRefreshToken()`, `clearStoredTokens()`

**ApiAuthService** (`src/services/index.ts`):
- Implement `refreshToken` method (currently throws "not supported")
- Call `POST /auth/refresh`

### Files Changed/Added
- `backend/src/Saxovat.Domain/Entities.cs` (add RefreshToken)
- `backend/src/Saxovat.Infrastructure/Persistence/SaxovatDbContext.cs` (add DbSet)
- `backend/src/Saxovat.Infrastructure/Persistence/Migrations/` (new migration)
- `backend/src/Saxovat.Infrastructure/Services/AuthService.cs` (add refresh logic)
- `backend/src/Saxovat.API/Controllers/AuthController.cs` (add /auth/refresh)
- `backend/src/Saxovat.Application/Contracts/AuthContracts.cs` (add refresh DTOs)
- `src/services/authSession.ts` (add refresh token storage)
- `src/services/apiClient.ts` (add refresh interceptor)
- `src/services/index.ts` (implement refreshToken)

---

## 5. Docker Setup

### Files

**`backend/Dockerfile`**:
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Saxovat.slnx .
COPY src/ ./src/
RUN dotnet restore
RUN dotnet publish src/Saxovat.API/Saxovat.API.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Saxovat.API.dll"]
```

**`docker-compose.yml`** (project root):
```yaml
services:
  db:
    image: postgres:16-alpine
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 5s
      timeout: 5s
      retries: 5
  api:
    build:
      context: ./backend
    ports:
      - "5062:8080"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
volumes:
  pgdata:
```

**`.env`** (project root):
```
POSTGRES_DB=saxovat_pharmacy
POSTGRES_USER=saxovat
POSTGRES_PASSWORD=changeme
ConnectionStrings__PostgreSql=Host=db;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}
OneC__BaseUrl=http://localhost/InfoBase/hs/productapi/
```

**`.dockerignore`** (project root / backend): standard dotnet ignores

### Files Added
- `Dockerfile` (in backend/)
- `docker-compose.yml`
- `.env` (gitignored — `.env.example` for template)
- `.dockerignore`

---

## 6. Charts/Visualizations

### Dependencies
- Add `recharts` npm package
- `recharts` is lightweight, React-native, well-maintained

### Implementation

**Charts Component** (`src/components/Charts.tsx`):
- `BarChartCard` — accepts data array, label accessors, title
- `PieChartCard` — accepts data array, value/label accessors, title
- `DonutChartCard` — same as pie but with center text
- Reusable, typed with generics

**AdminReportsScreen Update** (`src/screens/AdminScreens.tsx`):
- Replace plain text reports with charts:
  - Orders by status → Horizontal bar chart (`BarChart` from recharts)
  - Users by role → Pie chart with legend
  - Medicine stock health → Donut chart with center summary text
- Keep the summary numbers visible alongside charts
- Responsive layout: charts stack on mobile, side-by-side on desktop

**Chart Data Preparation**:
- Data already loaded and computed in `AdminReportsScreen`
- Transform `orderStatusCounts` → `[{name: "Pending", value: 5}, ...]` etc.
- Pass to chart components

### Files Changed/Added
- `src/components/Charts.tsx` (new)
- `src/screens/AdminScreens.tsx` (replace text with charts)
- `package.json` (add recharts)

---

## Implementation Order

1. **Token Refresh** — needed for any authenticated feature stability
2. **Docker Setup** — environment-agnostic, no code changes
3. **Customer Registration & Password Reset** — self-contained feature
4. **Audit Log Viewer** — depends on existing AuditLogWriter
5. **Charts/Visualizations** — UI-only, no backend changes
6. **SignalR Notifications** — most complex, requires backend + frontend coordination
