# Android Development Environment Setup

## Prerequisites Check

Before building the Android app, ensure you have:

### ✅ Required Tools
- [ ] **Node.js & npm** - `node --version` (need v16+)
- [ ] **Java Development Kit** - `java -version` (need 11+)
- [ ] **Android Studio** - Already installed
- [ ] **Android SDK** - Installed with Android Studio

### ✅ Android Studio Configuration
1. Open Android Studio
2. Go to **File → Settings** (or **Android Studio → Preferences** on Mac)
3. Navigate to **Appearance & Behavior → System Settings → Android SDK**
4. Install these if missing:
   - Android API 34 (Latest)
   - Android API 30 (for compatibility)
   - Android SDK Build-tools 34.0.0
   - Google Play Services

### ✅ Android Device/Emulator
Choose one:
- **Physical Device**: 
  - Connect via USB
  - Enable USB Debugging (Settings → Developer Options)
  - Run `adb devices` to verify connection
- **Emulator**:
  - In Android Studio: Tools → Device Manager → Create Device
  - Select API Level 30+
  - Start emulator before building

### ✅ Environment Variables (Optional but Recommended)
Add to system PATH (Windows):
1. Search "Edit environment variables"
2. Add paths:
   - `C:\Program Files\Android\sdk\tools`
   - `C:\Program Files\Android\sdk\platform-tools`
   - `C:\Program Files\Android\sdk\emulator`

## Backend Configuration

Your app communicates with:
- **Production**: https://going-that-way--annasuarez2.replit.app/app/browse

### For Local Testing
If running backend locally on another port:
1. Find your machine IP: 
   ```
   ipconfig
   ```
   Look for IPv4 Address (usually `192.168.x.x`)

2. Update API calls to use: `http://192.168.x.x:PORT`

3. Rebuild: 
   ```
   npm run web:build
   npx cap sync
   ```

## Verify Everything is Ready

Run these commands:

```bash
# Check Node.js
node --version

# Check npm
npm --version

# Check Java (for gradle)
java -version

# Check Android SDK
adb version

# Try to list connected devices
adb devices
```

All should return version numbers (no errors).

## Ready to Build!
Once all prerequisites are met, follow the steps in **ANDROID_QUICK_START.md**

---

## Troubleshooting Setup

### Issue: `npm: command not found`
- Node.js not installed or not in PATH
- Restart terminal after installing Node.js

### Issue: `java: command not found`
- JDK not installed or not in PATH
- Install JDK from oracle.com
- Or download Android Studio Bundle which includes JDK

### Issue: `adb: command not found`
- Android SDK not properly configured
- In Android Studio: Settings → SDK Manager → check installation paths

### Issue: Device not detected
```bash
adb kill-server
adb start-server
adb devices
```

### Issue: USB Debugging not available
- Phone must be connected via USB
- Go to Settings → About Phone → tap Build Number 7 times
- Back to Settings → Developer Options → Enable USB Debugging
- Allow computer in USB Debug prompt on phone
