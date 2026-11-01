# Centralized Library Management System

A web-based library management system for small and medium-sized libraries.
Students search the catalogue and request books. Librarians manage books and approve loans and returns. Admins manage members and settings, and download backups.
Built by **Saw Pyae Phyo Kyaw (200309)** for the Information Systems Project, KBTC College / NCC Education.

**Technology:** React 19 + Vite + Tailwind CSS (front end) · Node.js + Express + TypeScript (back end) · **MySQL** with Drizzle ORM (database) · JWT + bcrypt (security).

---

## 1. Minimum system requirements

| Item | Minimum |
|---|---|
| Operating system | Windows 10/11, macOS 12+, or Linux (64-bit) |
| Processor / memory | Dual-core CPU, 4 GB RAM |
| Free disk space | 1 GB (for dependencies) |
| Node.js | **Version 20 LTS or newer** ([nodejs.org](https://nodejs.org)) |
| Database | **XAMPP 8.x** (includes MySQL/MariaDB and phpMyAdmin) ([apachefriends.org](https://www.apachefriends.org)), or any MySQL 8 server |
| Browser | Latest Chrome, Edge, Firefox or Safari |

---

## 2. Install and run (local, with XAMPP)

1. **Start MySQL:** open the XAMPP Control Panel and click **Start** next to **MySQL**.
   (Apache is not needed. phpMyAdmin is optional, for looking at the data.)
2. **Open a terminal in this project folder** and install the dependencies (one time only):
   ```bash
   npm install
   ```
3. **(Optional) Create a settings file.** Copy `.env.example` to `.env`.
   The defaults already match a fresh XAMPP install (user `root`, no password), so you can skip this step.
4. **Start the app:**
   ```bash
   npm run dev
   ```
   On first start the app **creates the `library_db` database and all tables automatically**, then fills them with demo data. You should see:
   ```
   DATABASE: ready.
   Server running on http://localhost:3000
   ```
5. Open **http://localhost:3000** in the browser.

> **Alternative:** to load the demo data manually instead, create a database called `library_db` in phpMyAdmin, then **Import** the file `restore_database.sql`.

### Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | `admin@library.edu` | `admin123` |
| Librarian | `sarah@library.edu` | `password123` |
| Student | `saw@student.edu` | `password123` |

### Live demo

Hosted on Vercel with an Aiven cloud MySQL database: **(add your Vercel URL here)**.
See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for how it is deployed.

---

## 3. Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app for development on http://localhost:3000 |
| `npm run build` | Builds the production version into `/dist` |
| `npm start` | Runs the production build (after `npm run build`) |
| `npm run lint` | Type-checks all TypeScript code |
| `npm run test:api` | Runs the automated API tests (start `npm run dev` first; see `tests/api-test.mjs`) |

---

## 4. Project structure

```
├── server.ts              Back end: Express REST API (security, all /api routes)
├── server/
│   ├── database.ts        MySQL connection, CREATE TABLE statements, demo data
│   └── backup.ts          Builds the .sql backup file for the admin download
├── api/index.ts           Vercel entry point (runs server.ts as a serverless function)
├── src/                   Front end (React)
│   ├── App.tsx            Login state + page routing + role-based page guard
│   ├── lib/api.ts         HTTP helper that attaches the login token to every request
│   ├── db/librarydb.ts    Database schema for Drizzle ORM (matches the ERD)
│   ├── pages/             One file per screen (Login, Catalogue, History, Books, Admin...)
│   └── components/        Navbar, analytics charts, library settings tab
├── tests/api-test.mjs     Automated API tests (Chapter 6 evidence)
├── restore_database.sql   Ready-to-import MySQL database with demo data
├── ARCHITECTURE.md        System architecture and design notes
└── DEPLOYMENT_GUIDE.md    How to deploy to Vercel + Aiven MySQL
```

---

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running. Start it in the XAMPP Control Panel. |
| `Access denied for user 'root'` | Your MySQL root user has a password. Put it in `.env`: `DATABASE_URL="mysql://root:YOURPASSWORD@localhost:3306/library_db"` |
| Port 3306 already in use | Another MySQL is running. Stop it, or change the port in XAMPP and in `DATABASE_URL`. |
| Port 3000 already in use | Close the other program, or start with a different port: `PORT=3001 npm run dev` (Windows PowerShell: `$env:PORT=3001; npm run dev`) |
| "Too many failed login attempts" | Three wrong passwords lock logins from your computer for 5 minutes (a security feature). Wait, or restart the app. |
| Want to start again with fresh demo data | In phpMyAdmin, drop the `library_db` database, then restart `npm run dev`. |
