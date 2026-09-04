# GTW Sender Android App

Native Kotlin + Jetpack Compose sender application.

## Local setup

1. Install Android Studio and JDK 17.
2. Add a Firebase Android app with package ID `com.gtw.sender`.
3. Put the downloaded `google-services.json` in `app/` locally. Do not commit it.
4. Set `API_BASE_URL` in `app/build.gradle.kts` for your emulator or staging API.
5. Open this directory in Android Studio and run `app`.

The initial shell uses Firebase identity tokens through Retrofit/OkHttp. Replace the development sign-in placeholder with the Firebase email/Google UI before release.
