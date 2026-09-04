# Setup Capacitor for Android

Write-Host "Installing Capacitor packages..." -ForegroundColor Green
npm install @capacitor/core @capacitor/cli @capacitor/android --save

Write-Host "`nInitializing Capacitor project..." -ForegroundColor Green
npx cap init --web-dir dist

Write-Host "`nBuilding web app for production..." -ForegroundColor Green
npm run web:build

Write-Host "`nAdding Android platform..." -ForegroundColor Green
npx cap add android

Write-Host "`nOpening Android Studio..." -ForegroundColor Green
Write-Host "Navigate to: android/ folder in Android Studio"
Write-Host "Build and run from Android Studio"

Write-Host "`nSetup complete! Next steps:" -ForegroundColor Cyan
Write-Host "1. Open Android Studio"
Write-Host "2. File -> Open -> Select the 'android' folder"
Write-Host "3. Wait for Gradle to sync"
Write-Host "4. Connect Android device or use emulator"
Write-Host "5. Click 'Run' or press Shift+F10"
