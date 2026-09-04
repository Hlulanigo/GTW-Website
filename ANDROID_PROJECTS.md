# GTW Android Projects

This repository contains two independent native Android applications:

- `android-sender/` - GTW Sender (`com.gtw.sender`)
- `android-provider/` - GTW Provider (`com.gtw.provider`)

Both projects use Kotlin, Jetpack Compose, Retrofit, OkHttp, and Firebase Authentication tokens. They target Android API 35, support Android 8.0 and newer, and default to the local emulator backend at `http://10.0.2.2:5000/`.

## Open and run

1. Install Android Studio, Android SDK 35, and JDK 17.
2. Open either project directory as a standalone Android Studio project.
3. Create a matching Firebase Android app and place its local `google-services.json` in that app's `app/` directory. This file is ignored by Git.
4. Set `API_BASE_URL` in `app/build.gradle.kts` for staging or a physical device LAN address.
5. Run the `app` configuration on an emulator or connected device.

## Current scope

The sender app has the authenticated API shell and sender parcel list. The provider app has the authenticated API shell and available delivery-job list. The next implementation slices are production Firebase sign-in UI, navigation, parcel creation, route management, camera proof uploads, foreground location, payments, messaging, and push notifications.

Never commit Firebase service accounts, `google-services.json`, signing keys, local environment files, uploads, logs, or Gradle output.
