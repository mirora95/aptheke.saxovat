using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Saxovat.API.Hubs;
using Saxovat.API.Middleware;
using Saxovat.API.Services;
using Saxovat.Application.Interfaces;
using Saxovat.Application.Common;
using Saxovat.Infrastructure;
using Saxovat.Infrastructure.Persistence;
using Saxovat.Infrastructure.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var fieldErrors = context.ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .SelectMany(x => x.Value!.Errors.Select(error => new ApiFieldError(x.Key, error.ErrorMessage)))
                .ToArray();

            return new BadRequestObjectResult(
                new ApiErrorResponse("VALIDATION", "One or more validation errors occurred.", fieldErrors, context.HttpContext.TraceIdentifier));
        };
    });

builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Saxovat Pharmacy API",
        Version = "v1",
        Description = "Backend foundation aligned to the Saxovat frontend contracts.",
    });

    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Reference = new OpenApiReference
        {
            Type = ReferenceType.SecurityScheme,
            Id = JwtBearerDefaults.AuthenticationScheme,
        }
    };

    options.AddSecurityDefinition(JwtBearerDefaults.AuthenticationScheme, securityScheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [securityScheme] = []
    });
});

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = signingKey,
            NameClaimType = ClaimTypes.NameIdentifier,
            RoleClaimType = ClaimTypes.Role,
        };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var subject = context.Principal?.FindFirst("sub")?.Value;
                if (!string.IsNullOrWhiteSpace(subject) && context.Principal?.Identity is ClaimsIdentity identity)
                {
                    identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, subject));
                }

                return Task.CompletedTask;
            },
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(
                new ApiErrorResponse("UNAUTHORIZED", "Authentication is required", TraceId: context.HttpContext.TraceIdentifier));
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(
                    new ApiErrorResponse("FORBIDDEN", "You do not have access to this resource", TraceId: context.HttpContext.TraceIdentifier));
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSingleton<IOrderPushNotificationService, SignalRNotificationPushService>();

var app = builder.Build();

app.UseMiddleware<ApiExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<OrderHub>("/hubs/orders");

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<SaxovatDbContext>();
    var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasherService>();
    await DatabaseSeeder.SeedAsync(dbContext, passwordHasher);
}

app.Run();
