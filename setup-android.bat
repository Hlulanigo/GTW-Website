@echo off
REM Android Build Setup Script for GTW Mobile

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   GTW Mobile - Android Build Setup
echo ========================================
echo.

cd /d "C:\Users\Irgadgets\Desktop\New folder\GTW-mobile-completezipzip"

if errorlevel 1 (
    echo ERROR: Could not navigate to project folder
    pause
    exit /b 1
)

echo Step 1: Building web app for production...
echo.
cd web
call npm run build
if errorlevel 1 (
    echo ERROR: Web build failed
    pause
    exit /b 1
)
cd ..

echo.
echo Step 2: Installing Capacitor packages...
echo.
call npm install @capacitor/core @capacitor/cli @capacitor/android --save
if errorlevel 1 (
    echo ERROR: Capacitor installation failed
    pause
    exit /b 1
)

echo.
echo Step 3: Initializing Capacitor...
echo.
call npx cap init
if errorlevel 1 (
    echo ERROR: Capacitor init failed
    pause
    exit /b 1
)

echo.
echo Step 4: Adding Android platform...
echo.
call npx cap add android
if errorlevel 1 (
    echo ERROR: Android platform add failed
    pause
    exit /b 1
)

echo.
echo Step 5: Syncing files to Android...
echo.
call npx cap sync
if errorlevel 1 (
    echo ERROR: Capacitor sync failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Open Android Studio
echo 2. File -^> Open
echo 3. Navigate to: android folder in this project
echo 4. Wait for Gradle to sync
echo 5. Connect Android device or open emulator
echo 6. Click Run button (green play icon)
echo.
pause
