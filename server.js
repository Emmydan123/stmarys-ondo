const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");

const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const dataDir = process.env.STMARY_DATA_DIR || path.join(rootDir, "data");
const uploadDir = process.env.STMARY_UPLOAD_DIR || path.join(rootDir, "uploads");
const database = path.join(dataDir, "stmarys.sqlite");
const jwtSecret = process.env.JWT_SECRET || "local-development-secret-change-before-deployment";
const ownerEmail = "emmyjstunt@gmail.com";

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
const db = new sqlite3.Database(database);
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (error) { error ? reject(error) : resolve({ id: this.lastID, changes: this.changes }); }));
const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));

async function initializeDatabase() {
  await run("PRAGMA foreign_keys = ON");
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    photo_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS admins (
    user_id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    flyer_url TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, photoUrl: user.photo_url || "", isAdmin: Boolean(user.is_admin) };
}
function issueAuthCookie(response, user) {
  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });
  response.cookie("stmarys_auth", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 });
}
async function findUser(userId) {
  return get(`SELECT users.*, admins.user_id IS NOT NULL AS is_admin FROM users LEFT JOIN admins ON admins.user_id = users.id WHERE users.id = ?`, [userId]);
}
async function requireAuth(request, response, next) {
  try {
    const token = request.cookies.stmarys_auth;
    if (!token) return response.status(401).json({ error: "Please sign in first." });
    const payload = jwt.verify(token, jwtSecret);
    const user = await findUser(payload.userId);
    if (!user) return response.status(401).json({ error: "Your session is no longer valid." });
    request.user = user;
    next();
  } catch (error) { response.status(401).json({ error: "Please sign in first." }); }
}
function requireAdmin(request, response, next) {
  if (!request.user || !request.user.is_admin) return response.status(403).json({ error: "Admin access is required." });
  next();
}
const upload = multer({
  storage: multer.diskStorage({ destination: uploadDir, filename: (request, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (request, file, callback) => callback(null, file.mimetype.startsWith("image/"))
});

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(uploadDir));
app.use((request, response, next) => {
  const blocked = ["/data", "/server.js", "/package.json", "/package-lock.json", "/.env", "/.git"];
  if (blocked.some(prefix => request.path === prefix || request.path.startsWith(`${prefix}/`))) return response.sendStatus(404);
  next();
});
app.use(express.static(rootDir));

app.post("/api/auth/signup", upload.single("photo"), async (request, response) => {
  try {
    const { name, email, password } = request.body;
    if (!name || !email || !password || password.length < 6) return response.status(400).json({ error: "Name, email, and a password of at least 6 characters are required." });
    const normalizedEmail = email.trim().toLowerCase();
    if (await get("SELECT id FROM users WHERE email = ?", [normalizedEmail])) return response.status(409).json({ error: "An account with that email already exists." });
    const result = await run("INSERT INTO users (name, email, password_hash, photo_url) VALUES (?, ?, ?, ?)", [name.trim(), normalizedEmail, await bcrypt.hash(password, 12), request.file ? `/uploads/${request.file.filename}` : ""]);
    const user = await findUser(result.id);
    if (normalizedEmail === ownerEmail) await run("INSERT OR IGNORE INTO admins (user_id, email) VALUES (?, ?)", [user.id, normalizedEmail]);
    const updatedUser = await findUser(result.id);
    issueAuthCookie(response, updatedUser);
    response.status(201).json({ user: publicUser(updatedUser) });
  } catch (error) { response.status(500).json({ error: "Unable to create the account." }); }
});

app.post("/api/auth/login", async (request, response) => {
  try {
    const user = await get("SELECT * FROM users WHERE email = ?", [(request.body.email || "").trim().toLowerCase()]);
    if (!user || !(await bcrypt.compare(request.body.password || "", user.password_hash))) return response.status(401).json({ error: "Email or password is incorrect." });
    const signedInUser = await findUser(user.id);
    issueAuthCookie(response, signedInUser);
    response.json({ user: publicUser(signedInUser) });
  } catch (error) { response.status(500).json({ error: "Unable to sign in." }); }
});
app.post("/api/auth/logout", (request, response) => { response.clearCookie("stmarys_auth"); response.status(204).end(); });
app.get("/api/auth/me", requireAuth, (request, response) => response.json({ user: publicUser(request.user) }));

app.get("/api/events", async (request, response) => { response.json({ events: await all("SELECT id, name, date, time, location, flyer_url AS flyerUrl FROM events ORDER BY date, time") }); });
app.post("/api/events", requireAuth, requireAdmin, upload.single("flyer"), async (request, response) => {
  const { name, date, time, location } = request.body;
  if (!name || !date || !time || !location) return response.status(400).json({ error: "Event name, date, time, and location are required." });
  const result = await run("INSERT INTO events (name, date, time, location, flyer_url, created_by) VALUES (?, ?, ?, ?, ?, ?)", [name.trim(), date, time, location.trim(), request.file ? `/uploads/${request.file.filename}` : "", request.user.id]);
  response.status(201).json({ id: result.id });
});
app.delete("/api/events/:id", requireAuth, requireAdmin, async (request, response) => { await run("DELETE FROM events WHERE id = ?", [request.params.id]); response.status(204).end(); });

app.get("/api/admins", requireAuth, requireAdmin, async (request, response) => response.json({ admins: await all("SELECT email FROM admins ORDER BY email") }));
app.post("/api/admins", requireAuth, requireAdmin, async (request, response) => {
  const email = (request.body.email || "").trim().toLowerCase();
  const user = await get("SELECT id FROM users WHERE email = ?", [email]);
  if (!user) return response.status(404).json({ error: "That person must create a member account first." });
  await run("INSERT OR IGNORE INTO admins (user_id, email) VALUES (?, ?)", [user.id, email]);
  response.status(201).json({ email });
});
app.delete("/api/admins/:email", requireAuth, requireAdmin, async (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  if (email === ownerEmail) return response.status(400).json({ error: "The owner admin cannot be removed." });
  await run("DELETE FROM admins WHERE email = ?", [email]);
  response.status(204).end();
});

initializeDatabase().then(() => app.listen(port, () => console.log(`St. Mary's server running at http://localhost:${port}`))).catch(error => { console.error(error); process.exit(1); });
