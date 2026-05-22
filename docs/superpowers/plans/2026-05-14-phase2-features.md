# Phase 2 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 independent features: token refresh, Docker setup, customer registration & password reset, audit log viewer, charts/visualizations, and SignalR real-time notifications.

**Architecture:** Each feature is self-contained. Implementation order ensures dependencies are built first (token refresh before SignalR, Docker is standalone).

**Tech Stack:** ASP.NET Core, SignalR, EF Core, PostgreSQL, React 19, Recharts, Docker, @microsoft/signalr

---

## Feature 1: Token Refresh

### Task 1.1: Add RefreshToken entity and EF Core config

**Files:**
- Modify: `backend/src/Saxovat.Domain/Entities.cs`
- Modify: `backend/src/Saxovat.Infrastructure/Persistence/SaxovatDbContext.cs`

- [ ] **Step 1: Add RefreshToken entity to Domain**

Add after the `AuditLog` class:

```csharp
public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public User? User { get; set; }
}
```

- [ ] **Step 2: Add DbSet and config to SaxovatDbContext**

Add inside `SaxovatDbContext` class:
```csharp
public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
```

Add inside `OnModelCreating`:
```csharp
entity.HasIndex(x => x.TokenHash).IsUnique();
entity.Property(x => x.TokenHash).HasMaxLength(256).IsRequired();
entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
```

This config goes inside `OnModelCreating`, following the same `modelBuilder.Entity<RefreshToken>(entity => { ... });` pattern used for other entities in the file.

- [ ] **Step 3: Verify solution builds**

Run: `dotnet build backend/Saxovat.slnx`
Expected: exit code 0

### Task 1.2: Regenerate EF migration for RefreshTokens

**Files:**
- Create: `backend/src/Saxovat.Infrastructure/Persistence/Migrations/<timestamp>_AddRefreshTokens.cs`
- Modify: `backend/src/Saxovat.Infrastructure/Persistence/Migrations/SaxovatDbContextModelSnapshot.cs`

- [ ] **Step 1: Add the migration**

Run from `backend/`:
```powershell
dotnet tool restore
dotnet tool run dotnet-ef migrations add AddRefreshTokens --project src/Saxovat.Infrastructure/Saxovat.Infrastructure.csproj --startup-project src/Saxovat.API/Saxovat.API.csproj --output-dir Persistence/Migrations
```
Expected: Migration files created with `CreateTable("RefreshTokens"...)` containing TokenHash, UserId, ExpiresAt, IsUsed, CreatedAt columns.

- [ ] **Step 2: Verify solution still builds**

Run: `dotnet build backend/Saxovat.slnx`
Expected: exit code 0

### Task 1.3: Update backend AuthService with refresh token logic

**Files:**
- Modify: `backend/src/Saxovat.Application/Contracts/AuthContracts.cs`
- Modify: `backend/src/Saxovat.Infrastructure/Services/AuthService.cs`
- Modify: `backend/src/Saxovat.API/Controllers/AuthController.cs`

- [ ] **Step 1: Add refresh token DTOs**

In `backend/src/Saxovat.Application/Contracts/AuthContracts.cs`, add:

```csharp
public sealed record RefreshTokenRequest(string RefreshToken);

public sealed record RefreshTokenResponse(AuthTokensResponse Tokens);
```

- [ ] **Step 2: Add GenerateRefreshToken and RefreshTokenAsync to AuthService**

In `AuthService`, add fields:
```csharp
private readonly SaxovatDbContext _dbContext;
// Add to constructor alongside existing dependencies
```

In `LoginAsync`, after generating access token, add:
```csharp
var refreshToken = GenerateRefreshToken(user.Id);
_dbContext.RefreshTokens.Add(refreshToken);
await _dbContext.SaveChangesAsync(cancellationToken);
```

Update `LoginResponse` to include the refresh token value.

Add methods:
```csharp
private static RefreshToken GenerateRefreshToken(Guid userId)
{
    var tokenBytes = RandomNumberGenerator.GetBytes(64);
    var token = Convert.ToBase64String(tokenBytes);
    return new RefreshToken
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        TokenHash = ComputeSha256Hash(token),
        ExpiresAt = DateTime.UtcNow.AddDays(7),
        IsUsed = false,
    };
}

private static string ComputeSha256Hash(string rawData)
{
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawData));
    return Convert.ToBase64String(bytes);
}

public async Task<RefreshTokenResponse> RefreshTokenAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default)
{
    var tokenHash = ComputeSha256Hash(request.RefreshToken);
    var storedToken = await _dbContext.RefreshTokens
        .Include(x => x.User)
        .FirstOrDefaultAsync(x => x.TokenHash == tokenHash && !x.IsUsed && x.ExpiresAt > DateTime.UtcNow, cancellationToken);

    if (storedToken is null)
        throw new ValidationAppException("Invalid or expired refresh token");

    storedToken.IsUsed = true;

    var user = storedToken.User!;
    var accessToken = _jwtTokenGenerator.GenerateTokens(user);
    var newRefreshToken = GenerateRefreshToken(user.Id);
    _dbContext.RefreshTokens.Add(newRefreshToken);
    await _dbContext.SaveChangesAsync(cancellationToken);

    return new RefreshTokenResponse(new AuthTokensResponse(
        accessToken.AccessToken,
        accessToken.RefreshToken));  // Adjust AuthTokensResponse to carry refresh token
}

public async Task LogoutAsync(Guid userId, CancellationToken cancellationToken = default)
{
    var tokens = await _dbContext.RefreshTokens
        .Where(x => x.UserId == userId && !x.IsUsed)
        .ToListAsync(cancellationToken);
    foreach (var token in tokens)
        token.IsUsed = true;
    await _dbContext.SaveChangesAsync(cancellationToken);
}
```

Add IAuthService interface:
```csharp
Task<RefreshTokenResponse> RefreshTokenAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default);
```

- [ ] **Step 3: Add /auth/refresh endpoint to AuthController**

```csharp
[HttpPost("refresh")]
[ProducesResponseType<RefreshTokenResponse>(StatusCodes.Status200OK)]
[ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
public async Task<IActionResult> RefreshToken(RefreshTokenRequest request, CancellationToken cancellationToken)
{
    try
    {
        var result = await _authService.RefreshTokenAsync(request, cancellationToken);
        return Ok(result);
    }
    catch (ValidationAppException)
    {
        return Unauthorized(new ApiErrorResponse("UNAUTHORIZED", "Invalid or expired refresh token"));
    }
}
```

Also add logout endpoint:
```csharp
[HttpPost("logout")]
[Authorize]
public async Task<IActionResult> Logout(CancellationToken cancellationToken)
{
    var userId = User.GetUserId();
    await _authService.LogoutAsync(userId, cancellationToken);
    return NoContent();
}
```

Where `User.GetUserId()` is an extension method placed in a new file `backend/src/Saxovat.API/Common/ClaimsPrincipalExtensions.cs`:
```csharp
public static Guid GetUserId(this ClaimsPrincipal user)
{
    var claim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    return Guid.Parse(claim!);
}
```

- [ ] **Step 4: Verify solution builds**

Run: `dotnet build backend/Saxovat.slnx`
Expected: exit code 0

### Task 1.4: Update frontend authSession and apiClient for refresh

**Files:**
- Modify: `src/services/authSession.ts`
- Modify: `src/services/apiClient.ts`
- Modify: `src/services/index.ts`

- [ ] **Step 1: Update authSession to store and retrieve refresh token**

```typescript
const STORAGE_SESSION_KEY = 'saxovat-auth-session';
const STORAGE_REFRESH_KEY = 'saxovat-refresh-token';

export const writeStoredAuthSession = (session: AuthSession): void => {
  try {
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    if (session.tokens.refreshToken) {
      localStorage.setItem(STORAGE_REFRESH_KEY, session.tokens.refreshToken);
    }
  } catch { /* quota exceeded */ }
};

export const readStoredAuthSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch { return null; }
};

export const clearStoredAuthSession = (): void => {
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY);
    localStorage.removeItem(STORAGE_REFRESH_KEY);
  } catch { /* noop */ }
};

export const getStoredAccessToken = (): string | null => {
  const session = readStoredAuthSession();
  return session?.tokens.accessToken ?? null;
};

export const getStoredRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_REFRESH_KEY);
  } catch { return null; }
};
```

- [ ] **Step 2: Add refresh interceptor to apiClient**

Add a flag and retry logic inside `request` function. After the `!response.ok` block and before `throw createServiceError`:

```typescript
// Track refresh attempts per request chain
if (!requestRefreshPromise) {
  requestRefreshPromise = Promise.resolve(false);
}

if (response.status === 401 && !options.suppressUnauthorizedEvent) {
  const refreshToken = getStoredRefreshToken();
  if (refreshToken) {
    if (!requestRefreshPromise) {
      requestRefreshPromise = performTokenRefresh(refreshToken);
    }
    const refreshed = await requestRefreshPromise;
    if (refreshed) {
      // Retry original request with new token
      headers.set('Authorization', `Bearer ${getStoredAccessToken()}`);
      response = await fetch(buildUrl(path, options.query), { method, headers, body: options.body === undefined ? undefined : isJsonBody ? JSON.stringify(options.body) : (options.body as BodyInit) });
      if (response.ok) {
        const payload = response.status !== 204 && response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
        return payload as T;
      }
    }
  }
  emitUnauthorized();
}
```

Add at module level:
```typescript
let requestRefreshPromise: Promise<boolean> | null = null;

const performTokenRefresh = async (refreshToken: string): Promise<boolean> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const session = readStoredAuthSession();
    if (session) {
      session.tokens.accessToken = data.tokens.accessToken;
      session.tokens.refreshToken = data.tokens.refreshToken;
      writeStoredAuthSession(session);
    }
    return true;
  } catch {
    return false;
  } finally {
    requestRefreshPromise = null;
  }
};
```

- [ ] **Step 3: Update ApiAuthService refreshToken method**

In `src/services/index.ts`, replace the `ApiAuthService.refreshToken` method:

```typescript
async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
  return apiClient.post<RefreshTokenResponse>('/auth/refresh', request, {
    suppressUnauthorizedEvent: true,
  });
}
```

Also update the `IAuthService` interface to use the proper types (they already exist in `src/types/index.ts`).

- [ ] **Step 4: Run TypeScript lint check**

Run: `npx tsc --noEmit`
Expected: exit code 0

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement JWT refresh token rotation"
```

---

## Feature 2: Docker Setup

### Task 2.1: Create Dockerfile, docker-compose, and .env.example

**Files:**
- Create: `backend/Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Create backend/Dockerfile**

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

- [ ] **Step 2: Create docker-compose.yml**

```yaml
services:
  db:
    image: postgres:16-alpine
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-saxovat} -d ${POSTGRES_DB:-saxovat_pharmacy}"]
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

- [ ] **Step 3: Update .env.example**

```env
POSTGRES_DB=saxovat_pharmacy
POSTGRES_USER=saxovat
POSTGRES_PASSWORD=changeme
ConnectionStrings__PostgreSql=Host=db;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}
OneC__BaseUrl=http://localhost/InfoBase/hs/productapi/
Jwt__Key=super-secret-key-at-least-32-characters-long
Jwt__Issuer=SaxovatAPI
Jwt__Audience=SaxovatClient
```

- [ ] **Step 4: Ensure .gitignore includes .env**

Add to `.gitignore` if not already present:
```
.env
```

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile docker-compose.yml .env.example
git commit -m "feat: add Docker setup with PostgreSQL and API service"
```

---

## Feature 3: Customer Registration & Password Reset

### Task 3.1: Add registration endpoint to backend

**Files:**
- Modify: `backend/src/Saxovat.Application/Contracts/AuthContracts.cs`
- Modify: `backend/src/Saxovat.Infrastructure/Services/AuthService.cs`
- Modify: `backend/src/Saxovat.API/Controllers/AuthController.cs`

- [ ] **Step 1: Add RegisterRequest DTO**

In `AuthContracts.cs`:
```csharp
public sealed record RegisterRequest(
    string FullName,
    string Email,
    string Phone,
    string Password);
```

- [ ] **Step 2: Add RegisterAsync method to AuthService**

In `AuthService`:
```csharp
public async Task<LoginResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
{
    if (string.IsNullOrWhiteSpace(request.Email))
        throw new ValidationAppException("Email is required");

    var emailExists = await _dbContext.Users.AnyAsync(x => x.Email == request.Email.Trim(), cancellationToken);
    if (emailExists)
        throw new ValidationAppException("A user with this email already exists");

    var user = new User
    {
        Id = Guid.NewGuid(),
        FullName = request.FullName.Trim(),
        Email = request.Email.Trim().ToLowerInvariant(),
        Phone = request.Phone.Trim(),
        PasswordHash = _passwordHasher.HashPassword(request.Password),
        Role = UserRole.Customer,
        IsActive = true,
        CreatedAt = DateTime.UtcNow,
    };

    _dbContext.Users.Add(user);
    await _dbContext.SaveChangesAsync(cancellationToken);

    var tokens = _jwtTokenGenerator.GenerateTokens(user);
    return new LoginResponse(new AuthSessionResponse(
        new UserResponse(
            user.Id.ToString(), user.FullName, user.Phone, user.Email,
            "customer", user.IsActive, null, user.Address, user.CreatedAt),
        tokens));
}
```

Add to `IAuthService`:
```csharp
Task<LoginResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
```

- [ ] **Step 3: Add /auth/register endpoint**

In `AuthController`:
```csharp
[HttpPost("register")]
[AllowAnonymous]
[ProducesResponseType<LoginResponse>(StatusCodes.Status200OK)]
[ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
public async Task<IActionResult> Register(RegisterRequest request, CancellationToken cancellationToken)
{
    try
    {
        var result = await _authService.RegisterAsync(request, cancellationToken);
        return Ok(result);
    }
    catch (ValidationAppException ex)
    {
        return BadRequest(new ApiErrorResponse("VALIDATION", ex.Message));
    }
}
```

- [ ] **Step 4: Verify solution builds**

Run: `dotnet build backend/Saxovat.slnx`
Expected: exit code 0

### Task 3.2: Add password reset endpoint to backend

**Files:**
- Modify: `backend/src/Saxovat.Application/Contracts/UserContracts.cs`
- Modify: `backend/src/Saxovat.Application/Interfaces/ServiceInterfaces.cs`
- Modify: `backend/src/Saxovat.Infrastructure/Services/UserService.cs`
- Modify: `backend/src/Saxovat.API/Controllers/UsersController.cs`

- [ ] **Step 1: Add ResetPasswordRequest DTO**

In `UserContracts.cs`:
```csharp
public sealed record ResetPasswordRequest(string NewPassword);
```

- [ ] **Step 2: Add ResetPasswordAsync to IUserService and UserService**

In `ServiceInterfaces.cs`:
```csharp
Task<UserResponse> ResetPasswordAsync(string id, ResetPasswordRequest request, Guid actorUserId, CancellationToken cancellationToken = default);
```

In `UserService.cs`:
```csharp
private readonly IPasswordHasherService _passwordHasher;
// Already injected via constructor if present — add if missing

public async Task<UserResponse> ResetPasswordAsync(string id, ResetPasswordRequest request, Guid actorUserId, CancellationToken cancellationToken = default)
{
    var user = await _dbContext.Users.FindAsync([Guid.Parse(id)], cancellationToken)
        ?? throw new ValidationAppException("User not found");

    if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        throw new ValidationAppException("Password must be at least 6 characters");

    user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
    await _dbContext.SaveChangesAsync(cancellationToken);

    await _auditLogWriter.WriteAsync("ResetPassword", "User", id,
        $"Password reset for {user.Email} by actor {actorUserId}", actorUserId, cancellationToken);

    return _mapper.MapToUserResponse(user);
}
```

- [ ] **Step 3: Add PATCH /users/{id}/reset-password endpoint**

In `UsersController.cs`:
```csharp
[HttpPatch("{id}/reset-password")]
[Authorize(Roles = "Pharmacist,SuperAdmin")]
[ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
[ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
public async Task<IActionResult> ResetPassword(string id, ResetPasswordRequest request, CancellationToken cancellationToken)
{
    var actorId = User.GetUserId();
    var result = await _userService.ResetPasswordAsync(id, request, actorId, cancellationToken);
    return Ok(result);
}
```

- [ ] **Step 4: Verify solution builds**

Run: `dotnet build backend/Saxovat.slnx`
Expected: exit code 0

### Task 3.3: Add frontend registration screen

**Files:**
- Modify: `src/screens/AuthScreens.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add RegisterScreen component**

In `AuthScreens.tsx`, add before `LoginScreen`:
```tsx
export const RegisterScreen: React.FC = () => {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.password.trim()) {
      setError('All fields are required');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<LoginResponse>('/auth/register', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      const session = {
        user: response.session.user,
        tokens: response.session.tokens,
      };
      writeStoredAuthSession(session);
      window.location.reload(); // Triggers session restore in AuthProvider
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 20 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 tracking-tight">Saxovat</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>
        <Card className="p-8">
          <h2 className="text-xl font-semibold mb-6">Register</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full Name" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Your full name" required />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" required />
            <Input label="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+998901234567" required />
            <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="At least 6 characters" required />
            <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repeat password" required />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button type="submit" className="w-full" isLoading={loading}>Create Account</Button>
          </form>
          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign In</Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
```

Add import for `apiClient`, `writeStoredAuthSession`, `LoginResponse` at top:
```typescript
import { apiClient } from '../services/apiClient';
import { writeStoredAuthSession } from '../services/authSession';
import type { LoginResponse } from '../types';
```

- [ ] **Step 2: Add /register route in App.tsx**

Add import:
```typescript
import { RegisterScreen } from './screens/AuthScreens';
```

Inside `<Routes>`, before the `<Route path="/login"...>` line:
```tsx
<Route path="/register" element={<RegisterScreen />} />
```

- [ ] **Step 3: Add link from login to register**

In `LoginScreen`, replace the account registration disabled text with:
```tsx
<p className="text-sm text-gray-500">
  Don't have an account?{' '}
  <Link to="/register" className="text-blue-600 font-medium hover:underline">Register here</Link>
</p>
```

- [ ] **Step 4: Run TypeScript lint check**

Run: `npx tsc --noEmit`
Expected: exit code 0

### Task 3.4: Add password reset UI for pharmacists/admins

**Files:**
- Modify: `src/screens/AdminScreens.tsx`
- Modify: `src/screens/PharmacistScreens.tsx`

- [ ] **Step 1: Add Reset Password modal/button to Admin UserManagementScreen**

In `AdminScreens.tsx`, add state:
```typescript
const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
const [resetPasswordValue, setResetPasswordValue] = useState('');
const [resettingPassword, setResettingPassword] = useState(false);
```

Add a modal or inline form after the filtered users loop. Before the closing `</Card>` inside `UserManagementScreen`:
```tsx
{resetPasswordUserId ? (
  <Card className="p-6 mt-4">
    <h3 className="font-semibold text-gray-900 mb-2">Reset Password</h3>
    <p className="text-sm text-gray-500 mb-4">Enter a new password for this user.</p>
    <Input
      label="New Password"
      type="password"
      value={resetPasswordValue}
      onChange={e => setResetPasswordValue(e.target.value)}
      placeholder="At least 6 characters"
    />
    <div className="flex gap-3 mt-4">
      <Button
        isLoading={resettingPassword}
        onClick={async () => {
          if (!resetPasswordValue || resetPasswordValue.length < 6) return;
          setResettingPassword(true);
          try {
            await userService.resetPassword(resetPasswordUserId!, resetPasswordValue);
            setResetPasswordUserId(null);
            setResetPasswordValue('');
          } catch (err: any) {
            setError(err.message);
          } finally {
            setResettingPassword(false);
          }
        }}
      >
        Save New Password
      </Button>
      <Button variant="outline" onClick={() => { setResetPasswordUserId(null); setResetPasswordValue(''); }}>
        Cancel
      </Button>
    </div>
  </Card>
) : null}
```

Add "Reset Password" button in each user row alongside Deactivate:
```tsx
<Button variant="outline" onClick={() => setResetPasswordUserId(user.id)}>
  Reset Password
</Button>
```

- [ ] **Step 2: Add resetPassword to IUserService in frontend services**

In `src/services/index.ts`, add to `IUserService`:
```typescript
resetPassword(id: string, newPassword: string): Promise<UserResponse>;
```

Add to `ApiUserService`:
```typescript
async resetPassword(id: string, newPassword: string) {
  const response = await apiClient.patch<UserResponse>(`/users/${id}/reset-password`, { newPassword });
  return normalizeUser(response);
}
```

- [ ] **Step 3: Run TypeScript lint check**

Run: `npx tsc --noEmit`
Expected: exit code 0

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add customer registration and password reset"
```

---

## Feature 4: Audit Log Viewer

### Task 4.1: Add backend audit log query endpoint

**Files:**
- Create: `backend/src/Saxovat.Application/Contracts/AuditLogContracts.cs`
- Modify: `backend/src/Saxovat.Application/Interfaces/ServiceInterfaces.cs`
- Create: `backend/src/Saxovat.Infrastructure/Services/AuditLogService.cs`
- Modify: `backend/src/Saxovat.Infrastructure/DependencyInjection.cs`
- Create: `backend/src/Saxovat.API/Controllers/AuditLogsController.cs`

- [ ] **Step 1: Add AuditLogContracts**

Create `backend/src/Saxovat.Application/Contracts/AuditLogContracts.cs`:
```csharp
namespace Saxovat.Application.Contracts;

public sealed record AuditLogResponse(
    string Id,
    string ActorName,
    string Action,
    string EntityType,
    string? EntityId,
    string Description,
    DateTime CreatedAt);

public sealed record AuditLogQuery(
    string? EntityType = null,
    string? ActorId = null,
    DateTime? From = null,
    DateTime? To = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 20);
```

- [ ] **Step 2: Add IAuditLogService interface**

In `ServiceInterfaces.cs`:
```csharp
public interface IAuditLogService
{
    Task<ApiListResponse<AuditLogResponse>> GetAuditLogsAsync(AuditLogQuery query, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 3: Create AuditLogService**

Create `backend/src/Saxovat.Infrastructure/Services/AuditLogService.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;
using Saxovat.Infrastructure.Persistence;

namespace Saxovat.Infrastructure.Services;

public sealed class AuditLogService(SaxovatDbContext dbContext) : IAuditLogService
{
    public async Task<ApiListResponse<AuditLogResponse>> GetAuditLogsAsync(AuditLogQuery query, CancellationToken cancellationToken = default)
    {
        var q = dbContext.AuditLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.EntityType))
            q = q.Where(x => x.EntityType == query.EntityType);
        if (!string.IsNullOrWhiteSpace(query.ActorId))
            q = q.Where(x => x.ActorUserId == Guid.Parse(query.ActorId));
        if (query.From.HasValue)
            q = q.Where(x => x.CreatedAt >= query.From.Value);
        if (query.To.HasValue)
            q = q.Where(x => x.CreatedAt <= query.To.Value);
        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.Description.Contains(query.Search) || x.Action.Contains(query.Search));

        var total = await q.CountAsync(cancellationToken);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip((query.Page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditLogResponse(
                x.Id.ToString(),
                x.ActorUser != null ? x.ActorUser.FullName : "System",
                x.Action,
                x.EntityType,
                x.EntityId,
                x.Description,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return new ApiListResponse<AuditLogResponse>(items, total);
    }
}
```

- [ ] **Step 4: Register in DI**

In `DependencyInjection.cs`:
```csharp
services.AddScoped<IAuditLogService, AuditLogService>();
```

- [ ] **Step 5: Create AuditLogsController**

Create `backend/src/Saxovat.API/Controllers/AuditLogsController.cs`:
```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saxovat.Application.Common;
using Saxovat.Application.Contracts;
using Saxovat.Application.Interfaces;

namespace Saxovat.API.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Roles = "SuperAdmin")]
public sealed class AuditLogsController(IAuditLogService auditLogService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ApiListResponse<AuditLogResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAuditLogs([FromQuery] AuditLogQuery query, CancellationToken cancellationToken)
    {
        var result = await auditLogService.GetAuditLogsAsync(query, cancellationToken);
        return Ok(result);
    }
}
```

- [ ] **Step 6: Verify solution builds**

Run: `dotnet build backend/Saxovat.slnx`
Expected: exit code 0

### Task 4.2: Add frontend audit log screen

**Files:**
- Create: `src/screens/AuditLogsScreen.tsx`
- Modify: `src/services/index.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create AuditLogsScreen**

Create `src/screens/AuditLogsScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Badge, Button, Card, Input } from '../components/UI';
import { apiClient } from '../services/apiClient';
import type { ApiListResponse } from '../types';
import { formatDate } from '../lib/utils';

interface AuditLogEntry {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  createdAt: string;
}

const ENTITY_TYPES = ['User', 'Medicine', 'Category', 'Order', 'Payment'];

export const AuditLogsScreen: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadLogs = async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (entityType) params.set('entityType', entityType);
      if (search) params.set('search', search);
      params.set('page', String(p));
      params.set('pageSize', String(pageSize));
      const response = await apiClient.get<ApiListResponse<AuditLogEntry>>(`/audit-logs?${params.toString()}`);
      setLogs(response.items);
      setTotal(response.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadLogs(1); }, [entityType, search]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-2 text-sm text-gray-500">Track all administrative actions across the system.</p>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <Card className="p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <label className="text-sm font-medium text-gray-700 block mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={e => { setEntityType(e.target.value); setPage(1); }}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1 max-w-md">
            <Input
              label="Search"
              placeholder="Search by action or description"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Button variant="outline" onClick={() => void loadLogs(page)} isLoading={loading}>
            <History size={16} className="mr-2" /> Refresh
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="text-sm text-gray-500">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900">No audit logs found</h2>
          <p className="mt-2 text-sm text-gray-500">Try different filter criteria.</p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Timestamp</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Actor</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Action</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Entity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="py-3 px-4 font-medium">{log.actorName}</td>
                    <td className="py-3 px-4"><Badge>{log.action}</Badge></td>
                    <td className="py-3 px-4 text-gray-600">{log.entityType}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-gray-500">{total} total entries</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(p => p - 1); void loadLogs(page - 1); }}>
                  Previous
                </Button>
                <span className="text-sm text-gray-500 self-center">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); void loadLogs(page + 1); }}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Add route and sidebar link in App.tsx**

Add import:
```typescript
import { AuditLogsScreen } from './screens/AuditLogsScreen';
import { History } from 'lucide-react'; // if not already imported
```

Add to admin menuItems:
```typescript
{ icon: History, label: 'Audit Logs', path: '/admin/audit-logs' },
```

Add route inside SUPERADMIN routes block:
```tsx
<Route path="/admin/audit-logs" element={<AuditLogsScreen />} />
```

- [ ] **Step 3: Run TypeScript lint check**

Run: `npx tsc --noEmit`
Expected: exit code 0

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add audit log viewer with filters and pagination"
```

---

## Feature 5: Charts/Visualizations

### Task 5.1: Add Recharts and create chart components

**Files:**
- Modify: `package.json`
- Create: `src/components/Charts.tsx`
- Modify: `src/screens/AdminScreens.tsx`

- [ ] **Step 1: Install Recharts**

Run: `npm install recharts`

- [ ] **Step 2: Create Charts component**

Create `src/components/Charts.tsx`:
```tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card } from './UI';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface DataItem { name: string; value: number; }

export const BarChartCard: React.FC<{ title: string; data: DataItem[]; hint?: string }> = ({ title, data, hint }) => (
  <Card className="p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
    {hint ? <p className="text-sm text-gray-500 mb-4">{hint}</p> : null}
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
        <Tooltip />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </Card>
);

export const PieChartCard: React.FC<{ title: string; data: DataItem[]; hint?: string }> = ({ title, data, hint }) => (
  <Card className="p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
    {hint ? <p className="text-sm text-gray-500 mb-4">{hint}</p> : null}
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
          {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </Card>
);

export const DonutChartCard: React.FC<{ title: string; data: DataItem[]; centerText?: string; hint?: string }> = ({ title, data, centerText, hint }) => (
  <Card className="p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
    {hint ? <p className="text-sm text-gray-500 mb-4">{hint}</p> : null}
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
            {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      {centerText ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-900">{centerText}</span>
        </div>
      ) : null}
    </div>
  </Card>
);
```

- [ ] **Step 3: Update AdminReportsScreen to use charts**

Replace the three report data sections in `AdminReportsScreen` with:

```tsx
import { BarChartCard, PieChartCard, DonutChartCard } from '../components/Charts';

// Inside the return, replace the xl:grid-cols-3 grid:
<div className="grid gap-6 xl:grid-cols-3">
  <PieChartCard
    title="Users by role"
    data={[
      { name: 'Customers', value: userCounts.customers },
      { name: 'Pharmacists', value: userCounts.pharmacists },
      { name: 'SuperAdmins', value: userCounts.superAdmins },
    ]}
  />
  <DonutChartCard
    title="Medicine stock health"
    data={[
      { name: 'Active', value: medicineCounts.active },
      { name: 'Low stock', value: medicineCounts.lowStock },
      { name: 'Out of stock', value: medicineCounts.outOfStock },
      { name: 'Inactive', value: medicineCounts.inactive },
    ]}
    centerText={String(medicineCounts.active)}
    hint="Active / total medicines"
  />
  <BarChartCard
    title="Orders by status"
    data={Object.values(OrderStatus).map(status => ({
      name: status,
      value: orders.filter(order => order.orderStatus === status).length,
    }))}
  />
</div>
```

Remove the old three `<Card>` blocks that previously showed text-only data.

- [ ] **Step 4: Run TypeScript lint check**

Run: `npx tsc --noEmit`
Expected: exit code 0

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Recharts visualizations to admin reports"
```

---

## Feature 6: SignalR Real-time Notifications

### Task 6.1: Add SignalR hub on backend

**Files:**
- Create: `backend/src/Saxovat.API/Hubs/OrderHub.cs`
- Modify: `backend/src/Saxovat.API/Program.cs`
- Modify: `backend/src/Saxovat.Infrastructure/Services/OrderService.cs`
- Modify: `backend/src/Saxovat.Infrastructure/Services/NotificationService.cs`

- [ ] **Step 1: Create OrderHub**

Create `backend/src/Saxovat.API/Hubs/OrderHub.cs`:
```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Saxovat.API.Hubs;

[Authorize]
public sealed class OrderHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var role = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        var userId = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

        if (role == "SuperAdmin" || role == "Pharmacist")
            await Groups.AddToGroupAsync(Context.ConnectionId, "pharmacists");
        else if (!string.IsNullOrWhiteSpace(userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, userId);

        await base.OnConnectedAsync();
    }
}
```

- [ ] **Step 2: Register SignalR in Program.cs**

Add before `builder.Services.AddControllers()`:
```csharp
builder.Services.AddSignalR();
```

Add before `app.Run()` (after `app.MapControllers()`):
```csharp
app.MapHub<Saxovat.API.Hubs.OrderHub>("/hubs/orders");
```

- [ ] **Step 3: Inject IHubContext into OrderService**

In `OrderService.cs`, add constructor parameter:
```csharp
private readonly IHubContext<OrderHub> _hubContext;

// Add to existing constructor
```

After successful status update in `UpdateOrderStatusAsync` (after `_auditLogWriter.WriteAsync` and before `return`):
```csharp
try
{
    var payload = new { orderId = id, orderNumber = order.OrderNumber, newStatus = request.Status.ToString(), customerId = order.CustomerId.ToString(), timestamp = DateTime.UtcNow };
    await _hubContext.Clients.Group(order.CustomerId.ToString()).SendAsync("OrderStatusChanged", payload, cancellationToken);
    await _hubContext.Clients.Group("pharmacists").SendAsync("OrderStatusChanged", payload, cancellationToken);
}
catch
{
    // Don't fail the order update if push fails
}
```

- [ ] **Step 4: Add GetUnreadCountAsync to NotificationService**

In `NotificationService.cs`:
```csharp
public async Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default)
{
    return await _dbContext.Notifications.CountAsync(x => x.UserId == userId && !x.IsRead, cancellationToken);
}
```

Add to `INotificationService`:
```csharp
Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);
```

- [ ] **Step 5: Verify solution builds**

Run: `dotnet build backend/Saxovat.slnx`
Expected: exit code 0

### Task 6.2: Add frontend SignalR connection and notifications

**Files:**
- Modify: `package.json`
- Create: `src/context/NotificationContext.tsx`
- Create: `src/components/NotificationToast.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Navigation.tsx`

- [ ] **Step 1: Install @microsoft/signalr**

Run: `npm install @microsoft/signalr`

- [ ] **Step 2: Create NotificationContext**

Create `src/context/NotificationContext.tsx`:
```tsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';

interface OrderStatusNotification {
  orderId: string;
  orderNumber: string;
  newStatus: string;
  customerId: string;
  timestamp: string;
}

interface NotificationContextType {
  lastNotification: OrderStatusNotification | null;
  clearNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accessToken, isAuthenticated } = useAuth();
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [lastNotification, setLastNotification] = useState<OrderStatusNotification | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5062/hubs/orders', {
        accessTokenFactory: () => accessToken,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    connection.on('OrderStatusChanged', (data: OrderStatusNotification) => {
      setLastNotification(data);
    });

    connection.start().catch(() => { /* silent fail */ });
    connectionRef.current = connection;

    return () => {
      connection.stop().catch(() => { /* noop */ });
      connectionRef.current = null;
    };
  }, [isAuthenticated, accessToken]);

  const clearNotification = useCallback(() => setLastNotification(null), []);

  return (
    <NotificationContext.Provider value={{ lastNotification, clearNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
```

- [ ] **Step 3: Create NotificationToast component**

Create `src/components/NotificationToast.tsx`:
```tsx
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationToast: React.FC = () => {
  const { lastNotification, clearNotification } = useNotifications();

  useEffect(() => {
    if (lastNotification) {
      const timer = setTimeout(clearNotification, 6000);
      return () => clearTimeout(timer);
    }
  }, [lastNotification, clearNotification]);

  return (
    <AnimatePresence>
      {lastNotification ? (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50, x: '-50%' }}
          className="fixed bottom-20 md:bottom-4 left-1/2 z-50 w-[90vw] max-w-md"
        >
          <div className="bg-white rounded-2xl border border-blue-100 shadow-lg p-4 flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Order Updated</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Order {lastNotification.orderNumber} is now <span className="font-medium text-blue-600">{lastNotification.newStatus}</span>
              </p>
              <Link to={`/orders/${lastNotification.orderId}`} className="text-xs text-blue-600 font-medium hover:underline mt-1 inline-block">
                View Details
              </Link>
            </div>
            <button onClick={clearNotification} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
```

- [ ] **Step 4: Add NotificationProvider and Toast to App**

In `App.tsx`, add imports:
```typescript
import { NotificationProvider } from './context/NotificationContext';
import { NotificationToast } from './components/NotificationToast';
```

Wrap the app content:
```tsx
export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <AppContent />
          <NotificationToast />
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Run TypeScript lint check**

Run: `npx tsc --noEmit`
Expected: exit code 0

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add SignalR real-time order notifications"
```

---

## Verification

### Task V.1: Run full verification suite

- [ ] **Step 1: Build backend**

Run: `dotnet build backend/Saxovat.slnx`
Expected: exit code 0

- [ ] **Step 2: Run backend tests**

Run: `dotnet test backend/tests/Saxovat.Infrastructure.Tests/Saxovat.Infrastructure.Tests.csproj`
Expected: all tests pass

- [ ] **Step 3: TypeScript lint check**

Run: `npx tsc --noEmit`
Expected: exit code 0

- [ ] **Step 4: Frontend build**

Run: `npm run build`
Expected: exit code 0, produces dist/
