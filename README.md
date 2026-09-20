# St. Mary's Anglican Church, Ondo

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`.
4. Start the server with `npm start`.
5. Open `http://localhost:3000`.

The SQLite database is created at `data/stmarys.sqlite`. Uploaded event flyers are stored in `uploads/`.

The first owner admin is `emmyjstunt@gmail.com`. Create a member account with that email first; the server then grants it owner admin access. Other people must create member accounts before the owner can add their emails under Admin access.

## Deployment requirements

Deploy this as a Node.js service, not as a static-only site. Set `NODE_ENV=production`, a strong `JWT_SECRET`, and a persistent disk or hosted SQL/file storage for `data/` and `uploads/`. Use HTTPS so authentication cookies and the installable app work correctly.

The current SQLite setup is suitable for one small deployment. For multiple server instances, move the database to PostgreSQL or a managed SQLite provider and move uploads to object storage.

## Chosen hosting setup

The first production target is Render with a persistent disk mounted at `/var/data`. Render should set:

```text
STMARY_DATA_DIR=/var/data/data
STMARY_UPLOAD_DIR=/var/data/uploads
```

This keeps the SQLite database and flyers after redeploys. Keep the service on one instance while using SQLite. A later growth upgrade can move SQL to PostgreSQL and flyers to object storage.