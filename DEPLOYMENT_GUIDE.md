# Deployment Guide: Vercel + Aiven MySQL

**Candidate:** Saw Pyae Phyo Kyaw (200309) · **Module:** Information Systems Project

The live demo uses two free cloud services:

```
 Browser ──HTTPS──> Vercel
                     ├── Static files (React app, served from Vercel's global CDN)
                     └── /api/*  → Serverless function (api/index.ts → server.ts, Node.js + Express)
                                        │
                                        │  MySQL protocol over TLS (encrypted)
                                        ▼
                                   Aiven for MySQL (MySQL 8, managed cloud database)
```

* **Vercel** hosts the website and runs the Express API as a *serverless function*: it starts when a request arrives and is not a server that runs all the time.
* **Aiven** hosts the MySQL 8 database. The app connects with an encrypted connection.
* Both should be in the **same region** (e.g. Singapore) so each database query is fast.

> Free plans and their limits change over time. Check the current terms on both sites before relying on them for the demo.

---

## 1. Create the MySQL database on Aiven

1. Sign up at **https://console.aiven.io** (you can use your GitHub account).
2. Click **Create service** → choose **MySQL** → choose the **Free** plan.
3. Pick a cloud region close to your users (e.g. *Asia-Pacific / Singapore*) and click **Create service**.
4. Wait until the status shows **Running** (a few minutes).
5. On the service's **Overview** page, note:
   * **Service URI**, which looks like:
     `mysql://avnadmin:PASSWORD@mysql-xxxx.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED`
   * **CA certificate**: click **Download** (file `ca.pem`).

You don't need to create any tables. The app creates them, plus the demo data, the first time it connects.

---

## 2. Connect Vercel to the database

1. Go to **https://vercel.com** → your project → **Settings → Environment Variables**.
2. **Delete the old Turso variables** if they exist (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `TURSO_CONNECTION_URL`), and remove the Turso integration under **Integrations**. They are no longer used.
3. Add these variables (for **Production**, **Preview** and **Development**):

| Name | Value |
|---|---|
| `DATABASE_URL` | The Aiven **Service URI** from step 1 |
| `DB_SSL_CA` | Open `ca.pem` in a text editor and paste its **entire** content (including the `-----BEGIN CERTIFICATE-----` lines) |
| `JWT_SECRET` | A long random text. Generate one with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | `production` |

4. Go to **Deployments** → on the latest deployment click **⋯ → Redeploy** (or just push a new commit to GitHub).

**Why `DB_SSL_CA`?** With the certificate, the app checks that it's really talking to *your* Aiven server, which protects against man-in-the-middle attacks. Without it, the connection is still encrypted, but the server's identity isn't verified, and the app logs a warning.

---

## 3. Check that it works

1. Open your Vercel URL. The first page load can take a few seconds while the database is created and filled.
2. Log in as `admin@library.edu` / `admin123`. The dashboard should show 150 books.
3. Optional: in Vercel → **Logs**, you should see `DATABASE: ready.`
4. Optional: connect to Aiven with **MySQL Workbench** (or the `mysql` command line) using the same host, port, user and password to look at the tables.

---

## 4. Back up and restore

* **Backup:** log in as admin → **Admin → Database Dump → Download**. This saves `library_backup_YYYY-MM-DD.sql`.
* **Restore into XAMPP:** phpMyAdmin → select `library_db` → **Import** → choose the file.
* **Restore into Aiven:**
  ```bash
  mysql --host=HOST --port=PORT --user=avnadmin --password --ssl-mode=REQUIRED defaultdb < library_backup.sql
  ```
* Aiven also takes its own automatic backups of the service. See the **Backups** tab in the Aiven console for what your plan includes.

---

## 5. Common problems

| Symptom (in Vercel logs) | Cause / fix |
|---|---|
| `ECONNREFUSED` or `ETIMEDOUT` | `DATABASE_URL` is wrong, or the Aiven service is powered off. Check that its status is **Running**. |
| `Access denied for user 'avnadmin'` | The password in `DATABASE_URL` is wrong. Copy the Service URI again. |
| `self-signed certificate in certificate chain` | `DB_SSL_CA` is incomplete. Paste the whole `ca.pem` again. |
| Logins stop working after a redeploy | `JWT_SECRET` changed, which invalidates old tokens. Log in again. |
