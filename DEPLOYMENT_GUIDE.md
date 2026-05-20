# Production Deployment Guide: centralLMS on Vercel with Direct Vercel-Turso Integration

**Candidate Name:** Saw Pyae Phyo Kyaw  
**Candidate ID:** 200309  
**Module:** Information Systems Project (Unit: NCC Global Assignment)  
**Academic Center:** KBTC College (KBT001)  
**Date Reference:** Spring 2026

---

## 1. Why a Direct Vercel-Turso Integration is Perfect for Your Project
To comply with your approved **Relational Database** proposal, your **Physical Entity-Relationship Diagram (ERD)**, and your **Interim Report**'s core technical challenge (ACID transaction locks and concurrency), maintaining SQL architecture is essential.

Using the official **Vercel-Turso Integration** lets you provision, manage, and connect your relational database **entirely from the Vercel dashboard**. You do not need to download command-line tools or copy-paste keys manually. Vercel automatically configures the database and injects the credentials (`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`) directly into your project's Environment Variables.

### Academic Highlights:
1.  **Direct ERD Matching:** Turso uses the **LibSQL** database engine (an enterprise SQLite dialect). This maintains 100% consistency with the schemas (`users`, `students`, `librarians`, `books`, `borrow_records`) defined in your `/src/db/librarydb.ts` and shown on your physical ERD.
2.  **Zero-Touch Provisioning:** The database is created directly from Vercel's interface, avoiding manual database connection management.
3.  **Automatic Seeding:** Upon the first API call to the Vercel-deployed server, the system automatically detects the empty database, runs table creation scripts, and seeds your **Candidate Profile (Student Code: 200309)** along with 150+ academic catalog records.

---

## 2. Step-by-Step Vercel & Turso Dashboard Setup

### Step 2.1: Publish Code to GitHub
1. Initialize Git in your project folder locally:
   ```bash
   git init
   git add .
   git commit -m "feat: enable dual-mode database with support for Vercel Turso Integration"
   ```
2. Create a private repository on [GitHub](https://github.com/) named `central-lms`.
3. Connect your local folder and push:
   ```bash
   git remote add origin https://github.com/your-username/central-lms.git
   git branch -M main
   git push -u origin main
   ```

### Step 2.2: Import Your Project into Vercel
1. Go to [https://vercel.com/](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** -> **"Project"**.
3. Import your `central-lms` repository from the list.
4. Set the Framework Preset to **"Vite"** or keep it as **"Other"**.
5. Set the Root Directory as `/`.
6. Click the **"Deploy"** button to trigger the initial compilation. (Note: The first build will succeed, but database queries won't execute until we connect Turso in the next step).

---

## 3. Creating & Linking Your Database via Vercel (No Manual Step)

Once your project is compiled on Vercel, link your Turso relational database using Vercel’s native dashboard system:

```
[ Vercel Dashboard ] ──( 1. Add Integration )──> [ Search: Turso ]
                                                            │
[ Vercel Project Environment ] <──( 3. Auto-Injects Keys )── [ 2. Create Database ]
  • TURSO_DATABASE_URL
  • TURSO_AUTH_TOKEN
```

### Step 3.1: Connect the Turso Integration
1. In your project page on the **Vercel Dashboard**, go to the **"Integrations"** tab (or **"Storage"** tab).
2. Click on **"Browse Marketplace"** or search directly for **"Turso"**.
3. Click on the **"Turso"** integration icon, then click **"Add Integration"**.
4. Select your Vercel account/scope and choose your `central-lms` project to link.
5. Click **"Install"**.

### Step 3.2: Create the Database inside Vercel
1. A secure popup authorize window will open, prompting you to log in to Turso (you can sign in in one click via your same GitHub account).
2. Once authorized, Vercel will ask you:
   * **Select Database:** Click **"Create New Database"**.
   * **Database Name:** Name it something appropriate, e.g., `central-lms-db`.
   * **Location:** Choose your preferred hosting location (e.g., Singapore `sin` or Tokyo `nrt` for low latency).
3. Click **"Create & Connect"**.

🚀 **And that's it!** Vercel's backend securely provisions the database on Turso's serverless edge and automatically injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` into your project's Environment Variables under Production, Preview, and Development scopes.

---

## 4. How to Restore/Upload Your Local SQLite Database (library.db) to Turso

If you have already accumulated transaction records, custom academic books, or student profiles in your local `library.db` during development, you can **migrate and restore the whole file directly to your Turso Cloud Database** in minutes. 

Because Turso is natively built on SQLite/LibSQL, it can consume your SQLite `.db` binaries directly with zero schema conversion.

Choose one of the two straightforward restoration methods below:

### Method A: Zero-Downtime CLI Re-Creation (Recommended & Easiest)
This is the cleanest approach. It destroys the empty placeholder database and recreates a new cloud instance pre-populated with your exact local data file. Because you use the **same database name**, the Vercel connection keys remain 100% valid.

1. **Install the Turso CLI** on your local machine:
   * **macOS / Linux:**
     ```bash
     curl -sSfL https://get.turso.tech/install.sh | sh
     ```
   * **Windows (PowerShell):**
     ```powershell
     irm https://get.turso.tech/install.ps1 | iex
     ```
2. **Authenticate your CLI:**
   ```bash
   turso auth login
   ```
3. **Destroy the blank placeholder database** (created by the Vercel integration):
   ```bash
   turso db destroy central-lms-db
   ```
4. **Re-create it initialized directly from your local `library.db` file:**
   Navigate to the directory containing your local `library.db` and run:
   ```bash
   turso db create central-lms-db --from-file library.db
   ```
   *(Turso will read your entire database structure, indexes, keys, and row records, uploading them to the cloud in one atomic step!)*

---

### Method B: SQL Restore Dump (For Existing/Active Databases)
If you prefer not to delete your database client instance, you can export your local database state as a raw SQL script and pipe it directly to your live Turso shell.

1. **Generate a clean SQL script dump** from your local `library.db`:
   ```bash
   sqlite3 library.db .dump > restore_db.sql
   ```
2. **Execute the dump script directly over the Turso Cloud shell:**
   ```bash
   turso db shell central-lms-db < restore_db.sql
   ```
3. Your Turso instance will execute the standard schema instructions, inserting your exact local tables and historical transaction values directly into the cloud.

---

## 5. Finalizing Environment Variables & Deploying

To complete the setup, configure your other secure parameters (like JWT encryption keys):

### Step 5.1: Add JWT Secret to Vercel
1. Go to your **Vercel Project Settings** -> **"Environment Variables"** tab.
2. Add the following key-value pairs:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enforces production routing and static UI serving |
| `JWT_SECRET` | `your_custom_secure_secret_string_here` | Enforces strong stateless JWT validation for Student profiles |

3. Click **"Save"**.

### Step 5.2: Redeploy!
1. Go to the **"Deployments"** tab at the top of your Vercel project panel.
2. Click on your latest deployment's triple-dot menu (`...`) and click **"Redeploy"** (or trigger a new git push).
3. Once compiled, your system is fully live with dynamic edge SQL storage!

---

## 6. First-Load Auto-Initialization & Verification

Open your live Vercel URL (e.g. `https://central-lms.vercel.app`) and verify the setup:

1. **Auto-seeding check:** When the first page request hits your server, the backend detects that the Turso DB tables are vacant. It automatically run SQL scripts to construct the tables and seed your **Candidate Profile (Student Code: 200309)** and 150+ academic books.
2. **Log In:** Use your default student credentials:
   * **Email:** `saw@student.edu`
   * **Password:** `password123`
3. **Verify Candidate Code:** Click on your profile avatar in the navigation bar to review the student data retrieved from the database:
   * **Department:** Cybersecurity  
   * **Candidate Code:** `200309`  
   * **Academic Year:** 3  
4. **Acquire/Borrow a physical copy:** Select any book in the list and request to borrow it. The system locks down the request and decrements shelf stock under an ACID-compliant database transaction!
