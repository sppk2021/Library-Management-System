# System Architecture: Centralized Library Management System

## 1. Overview
A web-based library management system using a **three-tier architecture**:

```
 ┌──────────── Presentation tier (browser) ────────────┐
 │ React 19 single-page app, built with Vite            │
 │ Tailwind CSS, Recharts (charts), Motion (animations) │
 │ Saves the JWT login token in localStorage and sends  │
 │ "Authorization: Bearer <token>" with every request   │
 └──────────────────────────┬───────────────────────────┘
                            │ HTTPS, JSON (REST API under /api)
 ┌──────────────────────────▼───────────────────────────┐
 │ Application tier: Node.js + Express (server.ts)      │
 │ helmet → rate limit → JWT check → role check → route │
 │ Drizzle ORM builds type-safe SQL queries             │
 └──────────────────────────┬───────────────────────────┘
                            │ SQL (mysql2 connection pool, TLS in the cloud)
 ┌──────────────────────────▼───────────────────────────┐
 │ Data tier: MySQL (InnoDB)                            │
 │ Local: XAMPP · Cloud: Aiven for MySQL 8              │
 └──────────────────────────────────────────────────────┘
```

**Deployment:** Vercel serves the React files from its CDN and runs the Express API as a serverless function (`api/index.ts`). The database is Aiven for MySQL. Locally, `npm run dev` runs everything on one port (3000) with XAMPP's MySQL. See `DEPLOYMENT_GUIDE.md`.

## 2. Technology stack
| Layer | Technology |
|---|---|
| Front end | React 19, Vite 6, TypeScript, Tailwind CSS 4, React Router, Recharts, Motion, Lucide icons, Axios |
| Back end | Node.js 20+, Express 4, TypeScript, Drizzle ORM, mysql2 |
| Database | MySQL 8 / MariaDB 10.4+ (InnoDB engine, utf8mb4) |
| Security | bcryptjs (password hashing), jsonwebtoken (JWT), helmet (HTTP headers), express-rate-limit |
| Hosting | Vercel (web + API), Aiven (MySQL) |

## 3. Database design (9 tables, matches the ERD)
| Table | Purpose | Key relationships |
|---|---|---|
| `users` | Everyone who can log in; `role` = student / librarian / admin | parent of students, librarians, borrow_records, logs |
| `students` | Student profile (student code, department, year) | `user_id` → users (1:1, cascade delete) |
| `librarians` | Staff profile (employee code) | `user_id` → users (1:1, cascade delete) |
| `categories` | Subject areas | parent of books |
| `books` | Catalogue; `quantity` owned, `available_quantity` on shelf | `category_id` → categories (set null on delete) |
| `borrow_records` | Loan ledger: status, dates, fine | `user_id` → users, `book_id` → books |
| `logs` | Audit trail of every important action | `user_id` → users (set null on delete) |
| `system_config` | Library rules: loan days, fine rate, max loans (edited on Admin → Settings) | – |
| `serial_issues` | Issues of magazines/journals | `book_id` → books |

The table definitions are in `server/database.ts` (SQL) and `src/db/librarydb.ts` (Drizzle ORM).
Foreign keys are enforced by InnoDB, so the database itself rejects records that point to rows that don't exist (referential integrity).

## 4. Key processes

### 4.1 Loan lifecycle (state diagram)
```
requested ──approve──> borrowed ──due date passes──> overdue
    │                      │                            │
  reject                   └──────student returns───────┤
    ▼                                                   ▼
cancelled                                       return_requested ──confirm──> returned ──(fine paid)
```

### 4.2 Concurrency control (no double lending)
Loan approval and return confirmation each run in a single **MySQL transaction** and lock the loan row and the book row with `SELECT … FOR UPDATE`. If two librarians approve requests for the last copy at the same moment, the second transaction waits, then sees `available_quantity = 0` and is rolled back. Automated test **T5** demonstrates this.

### 4.3 Fines
`fine = ceil(days late) × DAILY_FINE_RATE`, worked out with one SQL `UPDATE` each time loans or reports are viewed. The fine stops growing when the student requests a return, and can be settled once the book has been returned.

### 4.4 Security
* Passwords are stored only as **bcrypt hashes** and are never sent to the browser.
* **JWT** login tokens (8 hours) carry the user id and role. The server checks them on every protected route.
* **Role-based access control** on the server (`authorize([...])`). The React page guard only hides pages.
* Public sign-up can only create **students**. Staff accounts are created by an admin.
* **helmet** security headers. **Rate limiting**: 1000 requests per 15 minutes per IP, and 3 failed logins lock that IP for 5 minutes.
* Parameterised queries (Drizzle / mysql2) prevent SQL injection.
* Cloud database connections use **TLS**, with CA certificate verification.

### 4.5 Backup and recovery
Admins can download a full `.sql` backup (`server/backup.ts`) containing DROP/CREATE TABLE and INSERT statements. It can be restored on any MySQL/MariaDB server (phpMyAdmin Import or the `mysql` command line).

## 5. Module overview
| Module | Screens | API routes |
|---|---|---|
| Authentication | Login / Sign-up, Profile | `/api/auth/*` |
| Catalogue | Catalogue (students), Manage Books (staff) | `/api/books`, `/api/categories`, `/api/serials/issues` |
| Circulation | Borrow History | `/api/borrow/*` |
| Administration | Admin (members, backup, settings) | `/api/admin/*`, `/api/config/*` |
| Reporting | Dashboard / Analytics | `/api/dashboard/stats`, `/api/reports/detailed` |
