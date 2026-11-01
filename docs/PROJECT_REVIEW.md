# Project Review – Centralized Library Management System

**Student:** Saw Pyae Phyo Kyaw (200309) · **Module:** Information Systems Project (NCC / Lancashire, Level 6)
**Reviewed:** 1 November 2026 · **Updated:** 1 November 2026 (after the MySQL migration and bug fixes)
**Final deadline:** **30 November 2026, 9am UK time**

> **Status update.** The app now uses **MySQL**, as promised in the proposal and interim report: XAMPP on a PC, Aiven in the cloud, Vercel for the website. All six bugs found in the first review are **fixed and retested**, and an **Admin → Settings** tab has been added (interim Fig 21). All code files have beginner-friendly comments. The screens are unchanged, except that the sign-up "Access Role" list now offers only *Academic Student* (security fix B2). 22 automated tests pass (20 of them also run on MariaDB 10.4, the database XAMPP ships).

Sources reviewed: the proposal (28/03/2026), the interim report (26/05/2026), the *ISP Final Report Guidance – Autumn 2026*, and the code in this repository.

---

## 1. What the final submission requires

| # | Deliverable | Key requirements |
|---|---|---|
| 1 | **Final report** (65% of module) | About 6,500 words (±10%), not counting appendices. Fixed chapter structure (see §6). Harvard referencing. Signed "Statement and Confirmation of Own Work" as the cover page. |
| 2 | **Product (zip)** | All source code **plus install and run instructions** and **minimum system specifications**. *"If it does not run then it cannot be marked."* `README.md` now covers this. |
| 3 | **10-minute presentation/demo** | Video, screencast, or PowerPoint with voice-over. Its purpose: *"to demonstrate that you understand what you have built and how it works."* |
| 4 | **Possible viva** | A short online interview, only in special cases. |

**Formatting rules:** A4 portrait, 2.5 cm margins, 11pt sans-serif (Arial), single spacing, 6–12pt between paragraphs, page numbers in the footer, no coloured text outside diagrams, every figure and table labelled "Fig x" / "Table x", heading numbers no deeper than 3 levels. Each chapter starts with a short introduction and ends with a short summary.

---

## 2. What has been done

### Documents
- **Proposal:** problem, objectives, scope (AI recommendations explicitly **excluded**), architecture, ERD, 12-week plan.
- **Interim report:** research (Koha and Libib comparison), technology justification, requirements, use case diagram, ERD, architecture diagram, 25 UI screenshots, learning reflection, Gantt chart, risks.

### The app
| Area | Status |
|---|---|
| Login / sign-up, bcrypt passwords, JWT (8h), three roles (student / librarian / admin) | ✅ Done |
| Book catalogue: add, edit, delete, search, 30 categories, 150 demo books | ✅ Done |
| Borrow workflow: request → approve/reject → return request → confirm return | ✅ Done; **transaction-safe with row locking** |
| Overdue detection and fines (rate, loan length, loan limit read from `system_config`) | ✅ Done |
| Dashboard and reports (top books, top borrowers, categories, overdue, monthly trend, low stock) | ✅ Done |
| Admin: members (any role), database backup download, **settings** (loan days, fine rate, loan limit) | ✅ Done (settings tab added Nov 2026) |
| Security: Helmet, rate limiting, audit log, admin-only staff creation | ✅ Done |
| **MySQL database** (XAMPP locally, Aiven in the cloud) | ✅ Done (Nov 2026) |
| Automated API tests (`npm run test:api`, 22 cases) | ✅ Done (Nov 2026) |
| **Reservations** (listed in the interim requirements; shown in Figs 12, 18, 25) | ❌ Not in the current code |

**Against the proposal's technical objectives:** centralised database ✅ · find/borrow/return with one copy held by one user ✅ (proven by test T5) · backups ✅ (manual download; "automatic backups" was promised, though Aiven also backs up the cloud database automatically) · reports on borrowed and overdue books ✅.

---

## 3. Documents vs code: what still needs care in the report

| Topic | Current situation | What to write / do |
|---|---|---|
| Database | ✅ **Now MySQL**, as stated in the proposal and interim. | Nothing to justify. Describe it as planned. For honesty (and good Ch 5 material), you can say an SQLite/Turso version was tried during development and replaced with MySQL to meet the original design. |
| "JSON Ledger Backup Storage" (interim tech table) | Doesn't exist. | Describe the SQL backup download instead. |
| Reservations | Not built. | State in Ch 7 that it was descoped, and why (time; the "request" step already reserves a copy). Treat it as future work. |
| Settings screen (interim Fig 21) | ✅ Added as **Admin → Settings**: loan duration, daily fine rate, loan limit. The server validates the values and logs every change. | Use a fresh screenshot of it in the report. |
| Interim screenshots | Screens look the same, apart from the student-only role list on sign-up. | Retake screenshots for the final report from the current app. Mention the sign-up change as a security improvement found by testing. |
| AI | Gemini boilerplate removed. The app has no AI features. | Don't claim any AI features. |

### Academic-integrity note (important)
- The code was originally generated with **Google AI Studio**, and was then reviewed, fixed, migrated and commented with an AI assistant (Claude). The cover sheet makes him sign *"this is my own work"*. He should **check KBTC/NCC's policy on AI tools** and, where allowed, **say openly in Ch 5** which tools were used, and what he did himself: requirements, design, ERD, testing, and decisions such as choosing MySQL, Vercel and Aiven.
- **Do not paste** text from `INTERIM_REPORT_GUIDE.md` or this review into the report. Write it in his own words.
- He must **understand the code** for the demo and any viva. The comments in every file, together with §5 below, are written for that.

---

## 4. Bugs from the first review: all fixed and retested

| Bug | What was wrong | Fix | Test |
|---|---|---|---|
| **B1** 🔴 | Approve/return showed an error, and changes were saved *without* a working transaction. | MySQL transaction + `SELECT … FOR UPDATE` row locks on the loan and the book (`server.ts`, approve and return-approve routes). | T4, T5 (two simultaneous approvals for the last copy: exactly one succeeds), T6, T6b |
| **B2** 🔴 | Anyone could register as **admin** by sending `role: "admin"`. | Public sign-up always creates a student. A new admin-only `POST /api/admin/users` route creates staff, and the Admin "Enroll" screen uses it. | T7, T8b, T8c |
| **B3** 🟠 | The backup button always gave 401 (no login token was sent). | Download through the `api` helper, which sends the token, then save the file. | T9, plus browser test |
| **B4** 🟠 | Monthly trend was always 0, and seeded dates came out as the year 58,804. | Proper MySQL `DATETIME` columns. The trend is grouped with `DATE_FORMAT(…, '%Y-%m')`, and empty months are filled in. | T10, plus chart checked in the browser |
| **B5** 🟡 | Fine rate, loan days and max loans were hard-coded. | Read from `system_config` (`getConfigNumber`). The due date now starts when the loan is approved. | T11, T17 |
| **B6** 🟡 | A paid fine reappeared. | A fine can be settled only once the book is returned, and the fine stops growing when a return is requested. | T15, T16 |

**Extra security fixes found during the migration:**
- Password hashes were being sent to the browser (in `/auth/me`, the member list and the loan history). They're now removed.
- Deleting a member or book with active loans is now refused, because MySQL enforces foreign keys.
- The old backup script was publicly downloadable at `/restore_database.sql` and included password hashes. That file has been removed from `public/`.

---

## 5. Plain-language explanation: structure, tools, hosting

He should be able to say this section **out loud** in the demo. It can be adapted into Ch 4 and Ch 5. More detail is in `ARCHITECTURE.md`.

### 5.1 Architecture: three tiers
```
 ┌──────────────── Browser (presentation tier) ───────────┐
 │ React 19 single-page app (Vite build, Tailwind CSS)    │
 │ Pages: Login, Catalogue, History, Dashboard,           │
 │        Manage Books, Admin, Profile                    │
 │ Saves the JWT and sends it as "Authorization: Bearer"  │
 └───────────────────────────┬────────────────────────────┘
                             │ HTTPS + JSON (REST, /api/...)
 ┌───────────────────────────▼────────────────────────────┐
 │ Node.js + Express API (application tier) – server.ts   │
 │  Helmet → rate limiter → JWT check → role check → route│
 │  Drizzle ORM turns TypeScript calls into SQL           │
 └───────────────────────────┬────────────────────────────┘
                             │ SQL (connection pool; TLS to the cloud)
 ┌───────────────────────────▼────────────────────────────┐
 │ MySQL database (data tier) – InnoDB, 9 tables          │
 │  On a PC: XAMPP   ·   Online: Aiven for MySQL 8        │
 └────────────────────────────────────────────────────────┘
```

### 5.2 Folder structure
| Path | Purpose |
|---|---|
| `src/pages/*.tsx` | One file per screen |
| `src/components/` | Navbar, analytics charts |
| `src/App.tsx` | Page routing and the login state; `PrivateRoute` hides pages from the wrong roles |
| `src/lib/api.ts` | Attaches the JWT to every request |
| `src/db/librarydb.ts` | **Database schema** for Drizzle (the ERD in code) |
| `server.ts` | The back end: security middleware and all API routes |
| `server/database.ts` | MySQL connection, `CREATE TABLE` statements, demo data |
| `server/backup.ts` | Builds the `.sql` backup |
| `api/index.ts` + `vercel.json` | Run the back end as a Vercel serverless function |
| `tests/api-test.mjs` | 20 automated tests |
| `restore_database.sql` | Ready-to-import MySQL database (for phpMyAdmin) |

### 5.3 Tools and why each one is used
| Tool | Role | One-line justification |
|---|---|---|
| React 19 + Vite | Front end | Reusable components; fast builds |
| Tailwind CSS | Styling | Responsive layout without writing custom CSS |
| Recharts | Charts | Ready-made React charts for the reports |
| Node.js + Express | REST API | Same language (TypeScript) at both ends; lightweight |
| TypeScript | Language | Catches errors before the code runs |
| **MySQL (InnoDB)** | Database | Relational with foreign keys, **ACID transactions and row locking** for safe concurrent loans |
| Drizzle ORM + mysql2 | Database access | Type-safe, parameterised queries (prevent SQL injection); connection pooling |
| XAMPP / phpMyAdmin | Local database | Free, one installer, a GUI to inspect data |
| Aiven for MySQL | Cloud database | Managed MySQL 8 with a free plan, encrypted connections, automatic backups |
| Vercel | Web hosting | Free, deploys automatically from GitHub, global CDN |
| bcryptjs, JWT, helmet, express-rate-limit | Security | Password hashing, stateless login, secure headers, brute-force protection |
| Git + GitHub | Version control | Change history; Vercel deploys from it |
| Google AI Studio, Claude | AI development assistants | Disclose as tools (see §3) |

### 5.4 Where it's hosted
* **Website and API:** **Vercel**. The React files are served from Vercel's CDN, and `/api/*` runs `server.ts` as a serverless function.
* **Database:** **Aiven for MySQL** in the cloud (choose the same region as Vercel, e.g. Singapore).
* **Development and marking:** **XAMPP** MySQL on the PC. The app creates the database and tables by itself.
* Step-by-step instructions: `DEPLOYMENT_GUIDE.md`. The settings needed in Vercel are `DATABASE_URL`, `DB_SSL_CA`, `JWT_SECRET` and `NODE_ENV`.

### 5.5 Key flow to explain in the demo: borrowing a book
1. Student clicks **Reserve** → `POST /api/borrow/request`. The server checks the token and role, stock, duplicates and the loan limit, then creates a `borrow_records` row with status `requested`.
2. Librarian clicks **Pass** → `POST /api/borrow/approve/:id`. **One MySQL transaction:** lock the loan row and the book row (`SELECT … FOR UPDATE`) → check that a copy is free → `available_quantity − 1` → status `borrowed`, due date = today + loan days → audit log. If anything fails, everything is rolled back. Two librarians can never lend the last copy twice.
3. Student clicks **Drop** (return request) → librarian clicks **Accept** → stock goes back up by 1, status `returned`.
4. Late loans become `overdue` automatically, with fine = days late × daily rate. The librarian settles the fine after the return.

---

## 6. Final report plan

| Chapter | ~Words | Reuse from interim | Still needed |
|---|---|---|---|
| Abstract | 100 | – | Write last |
| 1 Introduction, Aims & Objectives | 500 | Background, motivation, objectives (copied **exactly**) | One-paragraph summary of each chapter |
| 2 Research | 1,000 | Koha/Libib comparison, technology research | **Evaluate the research methods** (what worked, and what didn't) |
| 3 Analysis | 700 | Requirements, use case diagram | Use case descriptions (in an appendix); activity diagram of the borrow flow |
| 4 Design | 1,100 | ERD, architecture diagram | Justify design decisions (MySQL/InnoDB for transactions, JWT, RBAC); state diagram (§5.5 / `ARCHITECTURE.md` 4.1); deployment diagram (`DEPLOYMENT_GUIDE.md`); GUI design; security design |
| 5 Implementation | 1,300 | Screenshots (retake them) | Folder structure (§5.2), key code snippets (approve transaction, auth middleware), deployment, demo data, **problems encountered** (B1–B6, the MySQL migration, the MariaDB `LATERAL` join issue), tools used, including AI |
| 6 Testing & Results | 900 | – | Test table (§8), output of `npm run test:api`, browser tests, ideally a small user test (2–3 classmates + questionnaire in an appendix) |
| 7 Conclusions & Future Work | 900 | – | **Most important for the grade.** Go through each objective (achieved / partly / not, and why). Learning. Future work: reservations, email reminders, barcodes, scheduled automatic backups |
| References / Appendices | – | Remove duplicate references | Use case descriptions, test cases, install guide, questionnaire |

---

## 7. Product zip checklist
- [x] `README.md` with minimum specs, XAMPP install steps and demo logins
- [x] `restore_database.sql` for a manual phpMyAdmin import
- [ ] Add the live Vercel URL to `README.md`
- [ ] Zip **without** `node_modules`, `.env` or `dist`
- [ ] Test the zip **on a different PC**: install Node + XAMPP, run `npm install`, then `npm run dev`

---

## 8. Test results (1 November 2026, after fixes)

Run with `npm run test:api`. **22/22 passed on MySQL 8.0**; the original 20 also passed on **MariaDB 10.4** (XAMPP). A real browser was also used to check sign-up, reserve, approve, enroll a librarian, the backup download, the dashboard charts and the Settings tab.

| ID | Test | Before fixes | After |
|---|---|---|---|
| T1 | Student logs in with valid credentials | ✅ | ✅ |
| T2 | 4th wrong password in a row is blocked | not run | ✅ (HTTP 429) |
| T3 | Student requests an available book | ✅ | ✅ |
| T4 | Librarian approval: success, stock −1 | ❌ error shown | ✅ |
| T5 | Two simultaneous approvals for the last copy | ❌ | ✅ exactly one succeeds, stock = 0 |
| T6 / T6b | Return + approval puts the copy back; a double return is refused | ❌ | ✅ |
| T7 | Sign-up with role=admin | ❌ admin created | ✅ created as student |
| T8 / T8b / T8c | Student blocked from admin API; librarian can't create accounts; admin can create a librarian | not run | ✅ |
| T9 | Admin backup download (and refused without login) | ❌ 401 | ✅ |
| T10 | Monthly trend counts this month | ❌ 0 | ✅ |
| T11 | Fine uses the configured rate (3 days × 2.00 = 6.00) | ❌ ignored | ✅ |
| T12 | Late loan marked overdue | not run | ✅ |
| T13 | Passwords stored as bcrypt hashes and never sent to the browser | partly (hashes were sent) | ✅ |
| T15 / T16 | Fine can't be settled before the return; a paid fine stays paid | ❌ fine came back | ✅ |
| T17 | Loan limit enforced | ❌ | ✅ |
| T18 | Member with active loans can't be deleted | not run | ✅ |
| T19 | Settings reject invalid values (negative fine, 0 days, fractional limit) | – (no screen) | ✅ |
| T20 | Only an admin can change settings | – | ✅ |
| – | Backup from MySQL 8 restores into MariaDB 10.4 | – | ✅ |

---

## 9. Suggested plan for the remaining weeks

| Week | Tasks |
|---|---|
| **1 (2–8 Nov)** | Create the Aiven database, set the Vercel variables, redeploy, and add the URL to the README (`DEPLOYMENT_GUIDE.md`). Install XAMPP and run the app locally. Read through the commented code. |
| **2 (9–15 Nov)** | Run `npm run test:api` and take screenshots for Ch 6. Short user test with 2–3 people. Retake UI screenshots. Start Ch 4 and Ch 5. |
| **3 (16–22 Nov)** | Write Ch 1–3 (mostly from the interim), Ch 6 and Ch 7. Draw the new diagrams (deployment, state, activity). |
| **4 (23–29 Nov)** | Abstract, references, formatting check, signed declaration. Record the 10-minute demo (problem → architecture → live borrow flow → reports → security → future work). Test the zip on another PC. **Submit before 30 Nov, 9am UK.** |

**Don't add new features** unless they're small and clearly needed. Explaining and testing what exists earns more marks with less risk.
