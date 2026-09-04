# Manual Setup Steps - Run Each Command in Order

If the batch script doesn't work, follow these steps manually in Command Prompt (cmd) or PowerShell.

## Open Command Prompt
Press `Win + R`, type `cmd`, press Enter

## Navigate to Project
```
cd "C:\Users\Irgadgets\Desktop\New folder\GTW-mobile-completezipzip"
```

## Step 1: Build Web App
```
cd web
npm run build
cd ..
```
**Wait for completion** - Look for "Built at" message

## Step 2: Install Capacitor
```
npm install @capacitor/core @capacitor/cli @capacitor/android --save
```
**Wait for completion** - Look for "added X packages" message

## Step 3: Initialize Capacitor
```
npx cap init
```

When prompted, answer:
- **App name**: `GTW Mobile`
- **Package ID**: `com.gtw.irgadgets`  
- **Web dir**: `dist`

## Step 4: Add Android Platform
```
npx cap add android
```
**Wait for completion** - Should create `android/` folder

## Step 5: Sync to Android
```
npx cap sync
```

## Done! Now Open in Android Studio
1. Launch Android Studio
2. **File → Open**
3. Select the `android` folder from this project
4. Wait for Gradle sync (bottom right corner)
5. Connect phone or start emulator
6. Click **Run** button

---

## If Commands Fail

Try these troubleshooting steps:

### "npm: command not found"
- Node.js not installed
- Restart Command Prompt after installing Node.js

### "Module not found"
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again

### "Gradle sync failed"
- In Android Studio: **File → Invalidate Caches → Invalidate and Restart**
- Delete `.gradle` folder in android directory

### For help
See the guide files created in your project:
- `ANDROID_QUICK_START.md`
- `ENV_SETUP.md`
- `API_CONFIG.md`
