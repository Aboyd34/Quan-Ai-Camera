
# Rome Cam Pro - Android Build Setup Script
# Run this in PowerShell to prepare your APK environment

Write-Host "--- Rome Cam Pro: Android Setup Initiated ---" -ForegroundColor Cyan

# 1. Check for Java (JDK)
$javaPath = Get-Command java -ErrorAction SilentlyContinue
if ($null -eq $javaPath) {
    Write-Error "Java JDK not found. Please install JDK 17 or 21 and add it to your PATH."
    Write-Host "Download: https://adoptium.net/temurin/releases/" -ForegroundColor Yellow
    exit
} else {
    Write-Host "Check: Java found at $($javaPath.Source)" -ForegroundColor Green
}

# 2. Check for Android SDK
if ($null -eq $env:ANDROID_HOME) {
    $potentialPath = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $potentialPath) {
        $env:ANDROID_HOME = $potentialPath
        Write-Host "Check: Android SDK auto-detected at $potentialPath" -ForegroundColor Green
    } else {
        Write-Warning "ANDROID_HOME environment variable not set. Manual configuration may be required in Android Studio."
    }
}

# 3. Install Capacitor Dependencies
Write-Host "Step: Installing native bridge dependencies..." -ForegroundColor Cyan
npm install

# 4. Build Web Assets
Write-Host "Step: Compiling web assets for native wrapper..." -ForegroundColor Cyan
# For this environment, we assume the build generates a 'dist' folder
if (!(Test-Path "dist")) { New-Item -ItemType Directory -Path "dist" }

# 5. Initialize/Sync Android Project
if (!(Test-Path "android")) {
    Write-Host "Step: Initializing Android project..." -ForegroundColor Cyan
    npx cap add android
}

Write-Host "Step: Syncing assets to Android folder..." -ForegroundColor Cyan
npx cap sync android

Write-Host "--- Setup Complete ---" -ForegroundColor Green
Write-Host "To generate your APK:" -ForegroundColor White
Write-Host "1. Run 'npx cap open android' to open Android Studio."
Write-Host "2. Go to Build > Build Bundle(s) / APK(s) > Build APK(s)."
