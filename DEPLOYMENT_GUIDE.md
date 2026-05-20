# production Deployment Guide: centralLMS on Vercel with Turso Relational SQL Persistence

**Candidate Name:** Saw Pyae Phyo Kyaw  
**Candidate ID:** 200309  
**Module:** Information Systems Project (Unit: NCC Global Assignment)  
**Academic Center:** KBTC College (KBT001)  
**Date Reference:** Spring 2026  

---

## 1. Why Turso Relational SQL is the Perfect Choice for Your Grade
To conform to your approved **Relational Database** proposal, your **Physical Entity-Relationship Diagram (ERD)**, and your **Interim Report** core challenge (ACID transaction locks and concurrency), migrating to NoSQL like Firebase would jeopardize your marks. 

Instead, this project has been fully refactored to support a **dual-mode engine** connecting dynamically to **Turso Serverless SQLite (LibSQL)**.

### Academic Advantages of This Deployment:
1.  **100% Schema & ERD Consistency:** Turso uses the **LibSQL** relational engine (an enterprise-grade SQLite fork). It uses the exact same table schemas, constraints, column types (`sqliteTable`), auto-increment rules, foreign key references, and indexes defined in your `/src/db/librarydb.ts` file, keeping your physical implementation 100% aligned with your ERD.
2.  **Stateless Proofing:** Serverless functions (like Vercel) are transient and delete local files constantly. Turso moves your SQLite relational database permanently into the cloud, ensuring high-speed global read-writes with zero data loss.
3.  **Gold-Standard Concurrency Locks:** The system uses standard **ACID transactions** (`db.transaction()`) to resolve physical book "double-lending" hazards in multi-user library environments. Turso respects these locks perfectly, satisfying your project's main technical mitigation challenge!

---

## 2. Step-by-Step database setup on Turso

### Step 2.1: Create a Free Turso Account
1. Go to [https://turso.tech/](https://turso.tech) and sign up using your GitHub or Google account.
2. Complete the onboarding steps. The free tier ("Starter") provides up to **500 databases and 9GB of storage**, which is more than enough for your graduation defense.

### Step 2.2: Provision Your LMS Relational Database
1. Inside your Turso Dashboard, click on **"Create Database"**.
2. Name your database (e.g., `central-lms`).
3. Select your closest hosting region (e.g., `Singapore` or `Tokyo` for KBTC College).
4. Click **"Create Database"**.

### Step 2.3: Retrieve Connection Credentials
1. Once your database is provisioned, navigate to your database details page.
2. Look for the **"Connection URL"**. It will look like this:
   `libsql://central-lms-your-username.turso.io`
   *(Copy this URL - you will set this as `TURSO_CONNECTION_URL`).*
3. Click on the **"Generate Token"** button to create a secure Authorization Token.
   *(Copy this long alphanumeric string - you will set this as `TURSO_AUTH_TOKEN`).*

---

## 3. Step-by-Step deploying to Vercel

### Step 3.1: Push Your Code to GitHub (Recommended)
1. Initialize a git repository locally:
   ```bash
   git init
   git add .
   git commit -m "feat: implement dual-mode database engine with Turso SQL"
   ```
2. Create a new **private** or **public** repository on [GitHub](https://github.com/).
3. Connect your local folder and push:
   ```bash
   git remote add origin https://github.com/your-username/central-lms.git
   git branch -M main
   git push -u origin main
   ```

### Step 3.2: Configure the Project on Vercel
1. Go to [https://vercel.com/](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** -> **"Project"**.
3. Import your `central-lms` repository from the list.
4. Keep the framework preset as **"Vite"** or **"Other"**.
5. Set the root directory as `/` (the project root).

### Step 3.3: Set Environment Variables (CRITICAL)
In the **"Environment Variables"** accordion section of the Vercel setup interface, add the following secure variables:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables compiled router serving |
| `TURSO_CONNECTION_URL` | `libsql://central-lms-your-username.turso.io` | *Obtained from Turso dashboard* |
| `TURSO_AUTH_TOKEN` | `your_actual_turso_authentication_token_here` | *Obtained from Turso dashboard* |
| `JWT_SECRET` | `your_own_custom_secure_secret_string` | *Set a strong key to encrypt student tokens securely* |

### Step 3.4: Deploy!
1. Click the blue **"Deploy"** button.
2. Vercel will run `npm run build` which bundles your front-end components and compiles the back-end Express API routes.
3. Once completed, Vercel will present you with a live, production-ready HTTPS domain (e.g. `https://central-lms.vercel.app`).
4. **First-Load Initialization:** On the very first request to your Vercel deployment, the backend's `initDatabase()` method will run asynchronously, creating all relational tables (`users`, `students`, `librarians`, `books`, `borrow_records`, etc.), establishing foreign key paths, and seeding the database with **your Candidate Profile** (Student Code: `200309`) and 150+ academic books automatically!

---

## 4. Testing Your Vercel Deployment

Once deployed, you can verify your production system:
1. Open your Vercel domain in your browser.
2. Select **"Log In"** and sign in using the default seeded profile:
   * **Role:** Student (You!)
   * **Email:** `saw@student.edu`
   * **Password:** `password123`
3. Click your name avatar at the top right to double check your normalized student portfolio details retrieved from the relational `students` table:
   * **Department:** Cybersecurity
   * **Candidate Code:** `200309`
   * **Academic Year:** 3
4. Request to borrow a volume! Your checkout action is fully isolation-locked under a database transaction!
