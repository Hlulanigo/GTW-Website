# Android App Build - Quick Start

## Your Configuration
- **App Package**: com.gtw.irgadgets
- **Backend**: https://going-that-way--annasuarez2.replit.app/app/browse
- **Framework**: React + Capacitor

## Commands to Run (Copy & Paste)

### Step 1: Open Terminal/Command Prompt
Navigate to your project folder:
```
cd "C:\Users\Irgadgets\Desktop\New folder\GTW-mobile-completezipzip"
```

### Step 2: Build Web App
```
npm run web:build
```
**Wait for this to complete** - Creates optimized production build in `web/dist/`

### Step 3: Install Capacitor
```
npm install @capacitor/core @capacitor/cli @capacitor/android --save
```

### Step 4: Initialize Capacitor
```
npx cap init
```
When prompted, enter:
- App name: **GTW Mobile**
- Package ID: **com.gtw.irgadgets**
- Web dir: **dist**

### Step 5: Add Android Platform
```
npx cap add android
```
This creates an `android/` folder ready for Android Studio.

### Step 6: Sync Web Files to Android
```
npx cap sync
```

### Step 7: Open in Android Studio
1. Open Android Studio
2. **File → Open**
3. Browse to: `C:\Users\Irgadgets\Desktop\New folder\GTW-mobile-completezipzip\android`
4. Click **Open**
5. Wait for Gradle to sync (bottom right corner)

### Step 8: Run the App
1. Connect Android phone (USB Debugging enabled) OR open an Emulator
2. Top toolbar: Select your device
3. Click **Run** button (green play icon) or press **Shift+F10**
4. App will build and deploy!

## Important Notes

### For Local Backend Testing
If testing with local backend (`localhost:5000`), use your machine's IP instead:
- Find IP: Open Command Prompt and run `ipconfig` → look for IPv4 Address
- Use: `http://192.168.x.x:5000` in your API calls

### Environment Variables
If your app needs `.env` variables:
1. Copy `.env.example` to `.env`
2. Update API URLs to point to the backend
3. After changes, run: `npm run web:build` then `npx cap sync`

### API Configuration
Your app will need to know the backend URL. Check these files:
- `web/src/main.tsx`
- `web/src/services/api.ts` (if exists)
- Update any hardcoded localhost URLs to your backend

## Troubleshooting

### "web/dist folder not found"
→ Run `npm run web:build` first

### "Gradle sync failed" in Android Studio
→ File → Invalidate Caches → Invalidate and Restart

### App crashes on startup
→ Check Android Studio Logcat tab for error messages

### Can't reach backend
→ Verify URL in your API configuration
→ Check backend is running
→ Ensure your device/emulator can access the network

## Building Release APK
Once app works in Android Studio:
1. **Build → Build Bundle(s)/APK(s) → Build APK(s)**
2. Select Release mode
3. Sign APK when prompted
4. APK will be created in `android/app/release/`

## What Capacitor Does
- Wraps your React web app in Android native shell
- Allows access to native Android features
- Uses WebView to display your React app
- No need to rewrite your app!

## Support
If you need to access native Android features later (camera, GPS, etc.):
- Install: `npm install @capacitor/camera @capacitor/geolocation`
- Use in your React code with Capacitor plugins

---

**Next: Copy the commands above and run them step by step in your terminal!**
