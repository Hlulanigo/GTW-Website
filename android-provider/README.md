# GTW Provider Android App

Native Kotlin + Jetpack Compose provider application.

## Local setup

1. Install Android Studio and JDK 17.
2. Add a Firebase Android app with package ID `com.gtw.provider`.
3. Put the downloaded `google-services.json` in `app/` locally. Do not commit it.
4. Set `API_BASE_URL` in `app/build.gradle.kts` for your emulator or staging API.
5. Open this directory in Android Studio and run `app`.

The initial shell uses Firebase identity tokens through Retrofit/OkHttp. The next provider slices are route creation, job acceptance, CameraX proof uploads, foreground location, messaging, and notifications.
