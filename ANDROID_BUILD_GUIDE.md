# Android App Build Guide

## Project Setup
- **Package Name**: com.gtw.irgadgets
- **Backend URL**: https://going-that-way--annasuarez2.replit.app/app/browse
- **Framework**: React + Capacitor

## Step 1: Build the Web App
```bash
npm run web:build
```
This creates an optimized production build in `web/dist/`

## Step 2: Install Capacitor
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android --save
```

## Step 3: Initialize Capacitor
```bash
npx cap init --web-dir dist
```
When prompted:
- App name: GTW Mobile
- Package ID: com.gtw.irgadgets
- Web dir: dist

## Step 4: Add Android Platform
```bash
npx cap add android
```
This creates an `android/` folder with a complete Android Studio project.

## Step 5: Configure Backend URL
Edit `web/src/main.tsx` or your API configuration file to use:
```
https://going-that-way--annasuarez2.replit.app/app/browse
```

## Step 6: Open in Android Studio
1. Launch Android Studio
2. Click **File → Open**
3. Navigate to the `android/` folder in this project
4. Wait for Gradle sync to complete

## Step 7: Run on Device or Emulator
1. Connect an Android device (USB debugging enabled) OR open an emulator
2. In Android Studio, click **Run** (green play button) or press **Shift+F10**
3. Select your device/emulator
4. The app will build and deploy

## Building APK for Distribution
Once the app runs successfully:
1. In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**
2. Sign the APK with your keystore
3. APK will be in `android/app/release/app-release.apk`

## Troubleshooting

### Issue: "Web dir dist not found"
- Run `npm run web:build` first to create the dist folder

### Issue: Gradle sync fails
- File → Invalidate Caches → Invalidate and Restart
- Check that you have JDK 11+ installed

### Issue: Backend not accessible
- Ensure the backend URL is correct in your API calls
- Check CORS settings on the backend
- Use your machine's IP (e.g., http://192.168.x.x:5000) for local testing

### Issue: App crashes on startup
- Check Android Studio Logcat for errors
- Ensure environment variables are set correctly
- Verify API endpoints are accessible

## Next Steps
1. Run `npm run web:build` to build the web app
2. Install Capacitor with `npm install @capacitor/core @capacitor/cli @capacitor/android --save`
3. Initialize Capacitor with `npx cap init --web-dir dist`
4. Add Android: `npx cap add android`
5. Open the `android/` folder in Android Studio
6. Build and run!
