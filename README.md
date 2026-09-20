# St. Mary's Anglican Church, Ondo

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`.
4. Start the server with `npm start`.
5. Open `http://localhost:3000`.

The SQLite database is created at `data/stmarys.sqlite`.

The first owner admin is `emmyjstunt@gmail.com`. Create a member account with that email first; the server then grants it owner admin access. Other people must create member accounts before the owner can add their emails under Admin access.

## Deployment requirements

Deploy this as a Node.js service, not as a static-only site. Set `NODE_ENV=production`, a strong `JWT_SECRET`, and a persistent disk or hosted SQL/file storage for `data/` and `uploads/`. Use HTTPS so authentication cookies and the installable app work correctly.

The current SQLite setup is suitable for one small deployment. For multiple server instances, move the database to PostgreSQL or a managed SQLite provider and move uploads to object storage.

## Chosen hosting setup

The no-card testing target is Render's free web service. Render should set:

```text
STMARY_DATA_DIR=/tmp/stmarys-data
STMARY_UPLOAD_DIR=/tmp/stmarys-uploads
```

The free service can sleep and its local SQLite database may reset after a restart, so it is for testing only. Events automatically disappear from the public site 24 hours after their scheduled date and time. Upgrade to persistent SQL storage when the church needs reliable accounts.

## Android app

The Capacitor Android project is in `android/` and loads the live website at `https://stmarys-ondo.onrender.com`. Install Android Studio with the Android SDK and a Java JDK, then run:

```text
npm run android:build
```

The debug APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on an Android phone for testing. A Play Store release needs a signed release keystore and Google Play Developer account.