# build-android-release.ps1
# Full local pipeline: web build → Capacitor sync → signed Android AAB
#
# Prerequisites:
#   - Node.js 20+, npm
#   - JDK 21+ on PATH
#   - Android SDK (ANDROID_HOME set)
#   - android/app/keystore.properties filled in (copy from keystore.properties.example)
#   - saxovat-release.jks present at the path in keystore.properties
#
# Usage:
#   .\scripts\build-android-release.ps1
#   .\scripts\build-android-release.ps1 -VersionCode 2 -VersionName "1.0.1"

param(
    [int]$VersionCode = 0,
    [string]$VersionName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$KeystoreProps = Join-Path $Root "android\app\keystore.properties"

Write-Host "==> Checking prerequisites..." -ForegroundColor Cyan

if (-not (Test-Path $KeystoreProps)) {
    Write-Error "android/app/keystore.properties not found.`nCopy android/keystore.properties.example to android/app/keystore.properties and fill in values."
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found on PATH."
    exit 1
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Error "Java not found on PATH. Install JDK 21+."
    exit 1
}

# ── Step 1: Install dependencies ──────────────────────────────────────────────
Write-Host "`n==> Installing npm dependencies..." -ForegroundColor Cyan
Push-Location $Root
npm ci
if ($LASTEXITCODE -ne 0) { Write-Error "npm ci failed"; exit 1 }

# ── Step 2: Build web app ──────────────────────────────────────────────────────
Write-Host "`n==> Building web app (Vite)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Vite build failed"; exit 1 }

# ── Step 3: Sync Capacitor ────────────────────────────────────────────────────
Write-Host "`n==> Syncing Capacitor to Android project..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Error "Capacitor sync failed"; exit 1 }

# ── Step 4: Optionally patch version numbers ──────────────────────────────────
$BuildGradle = Join-Path $Root "android\app\build.gradle"
if ($VersionCode -gt 0) {
    Write-Host "`n==> Patching versionCode → $VersionCode" -ForegroundColor Cyan
    (Get-Content $BuildGradle) -replace 'versionCode \d+', "versionCode $VersionCode" |
        Set-Content $BuildGradle
}
if ($VersionName -ne "") {
    Write-Host "==> Patching versionName → $VersionName" -ForegroundColor Cyan
    (Get-Content $BuildGradle) -replace 'versionName "[^"]*"', "versionName `"$VersionName`"" |
        Set-Content $BuildGradle
}

# ── Step 5: Build release AAB ─────────────────────────────────────────────────
Write-Host "`n==> Building Android release AAB..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "android")
.\gradlew.bat bundleRelease
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Gradle build failed"; exit 1 }
Pop-Location

$AabPath = Join-Path $Root "android\app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $AabPath) {
    $Size = [math]::Round((Get-Item $AabPath).Length / 1MB, 2)
    Write-Host "`n==> Build successful!" -ForegroundColor Green
    Write-Host "    AAB: $AabPath ($Size MB)" -ForegroundColor Green
    Write-Host "`nUpload this AAB to Google Play Console → Production track." -ForegroundColor Yellow
} else {
    Write-Error "AAB not found at expected path: $AabPath"
    exit 1
}

Pop-Location
