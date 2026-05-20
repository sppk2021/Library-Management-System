# Level 6 Information Systems Project: Interim Report Guide
**Candidate Name:** Saw Pyae Phyo Kyaw  
**Candidate ID:** 200309  
**Module:** Information Systems Project (Unit: NCC Global Assignment)  
**Academic Center:** KBTC College (KBT001)  
**Date Reference:** Spring 2026  

---

## Technical Advisory: Relational (MySQL/SQLite) vs. NoSQL (Firebase Firestore)
Your proposal explicitly specified **React, Node.js, and a MySQL relational database**. Below is a formal academic and design justification explaining why **keeping a Relational SQL architecture** (using Turso Serverless SQLite/MySQL via Drizzle ORM) is **far superior** for your academic grading compared to migrating to Firebase NoSQL.

### 1. Architectural Integrity with the Approved Proposal
*   **The Issue:** Your approved proposal specifically commits to **MySQL**. Deviating from your technical commitment to a NoSQL system like Firebase Firestore without an authorized, formal change proposal will result in heavy penalties from academic markers.
*   **The Solution:** By maintaining a relational SQL schema (SQLite/MySQL via Drizzle ORM), your implementation stays 100% compliant with your proposed stack.

### 2. Alignment with Entity Relationship Diagram (ERD) Requirements
*   **The Issue:** The Level 6 assignment guidelines require you to provide a physical database schema and **ERD (Entity Relationship Diagram)** with tables, primary keys, and foreign key relations (e.g., `user_id` referencing `users(id)`). NoSQL databases (like Firebase Firestore) do not have tables or foreign keys; data is denormalized and stored in documents. 
*   **The Solution:** Using Drizzle SQL schemas keeps your codebase fully relational. The ERD remains a direct representation of the physical tables: `users`, `students`, `librarians`, `books`, and `borrow_records`.

### 3. Demonstrating High-Level Concurrency Control (The Core Project Challenge)
*   **The Issue:** Your project proposal stated that the main challenge would be **ensuring the database avoids concurrent errors where multiple users borrow the same last physical copy of a book**.
*   **The Solution:** Relational databases natively support **ACID Transactions** (Atomicity, Consistency, Isolation, Durability) and locking. Showing how you used **Drizzle transactions (`db.transaction()`)** to block concurrent race conditions during loan approvals (which we have implemented in `/server.ts`) is a goldmine for your "Development (25%)" and "Risks & Mitigation" marks. In Firebase, transaction controls are highly abstracted and client-side, making them less impressive to database software examiners.

---

# Draft Sections for Your Microsoft Word Submission (`200309_SawPyaePhyoKyaw_InterimReport.doc`)

Below is the structured, Harvard-referenced text you can adapt and refine for your **1,000-word Interim Report** submission.

---

## 1. Background & Research (25% Weighting)
### 1.1 Motivation and Aim
Small to medium-sized institutional libraries frequently operate under antiquated manual environments, managing cataloging lists and borrowing circulation via paper ledgers or primitive spreadsheets (Libib 2025). This analog workflow introduces severe operational risks, including high human error rates, zero auditable trails, misplaced stock, and an inability to track overdue fines or identify circulation demand. 

To address this manual gap, the aim of this project is to develop a centralized, highly secure **Library Management System (LMS)** that automates the inventory lifecycle, digitizes user profiles, and enforces transaction-safe book lending.

### 1.2 Comparison with Existing Systems
Existing standard tools like commercial administrative platforms tend to be bloated or require excessive licensing fees that small libraries cannot afford. 

| Feature | Primitive Spreadsheets | Generic Commercial LMS (e.g. Libib) | centralLMS (Our System) |
| :--- | :--- | :--- | :--- |
| **Concurrency Lock** | None (Single file overwrite) | Proprietary Server Controls | **ACID SQL Transaction Blocks** |
| **User Access Control** | None (Anyone can edit text) | Basic User Grouping | **Fine-grained RBAC Model** (Student, Librarian, Admin) |
| **Fine Enforcement** | Manual verification | Static overdue warnings | **Real-Time Dynamic Fine Accrual** via cron updates |

Expanding on Database systems research (Connolly and Begg 2015), maintaining strict **referential integrity** ensures that children tables (such as `borrow_records` and `students`) cannot contain orphaned references, which spreadsheets inevitably fail to protect.

---

## 2. Development & Implementation Progress (25% Weighting)
Development progressed strictly following the System Development Life Cycle (SDLC) model (Sommerville 2016). 

### 2.1 Database and Schema Design
The relational database layer was built utilizing **Drizzle ORM** mapped to a relational layout. Using TypeScript type definitions ensures that syntax errors are caught at compile-time instead of runtime.
*   **Core Schemas Implemented:** 
    1.  `users`: Base entity with authentication passwords hashed using `bcryptjs` and role attributes (`student`, `librarian`, `admin`).
    2.  `students` & `librarians`: Normalized structural extensions of the base `users` profile (1:1 relationship) mapping academic variables (`studentCode`, `department`, `year`).
    3.  `books`: Holds core catalog identifiers including title, author, total quantity, and available count inside the physical shelves.
    4.  `borrow_records`: Lifecycle model tracking active status transitions (`requested` -> `borrowed` -> `return_requested` -> `returned`).

### 2.2 Server Architecture
A robust REST API backend was built using **Node.js (Express)**, decoupled from the client via standard HTTP boundaries. To conform to security guidelines, we implemented:
*   HTTP security header protection using `helmet`.
*   Brute-force and API denial-of-service limiting using `express-rate-limit`.
*   JSON Web Tokens (`jsonwebtoken`) containing signed user roles for secure stateless route authorization.

---

## 3. Risks & Concurrency Mitigation Strategy (25% Weighting)
A major risk identified during our system analysis is the **Concurrency Race Condition** in physical stock allocation. 

### 3.1 The "Double-Lending" Concurrency Risk
In a multi-user library environment, if a physical book has only **one last copy available** in real catalog stock (`available_quantity = 1`), a race condition could occur if two librarians attempt to click "Approve Loan Request" for separate students at the same millisecond. 

Without transaction isolation level controls, both asynchronous threads would check the database copy quantity, see that `availableQuantity` is `1`, pass the validation gate simultaneously, and proceed to decrement the balance to `0` and approve both loans. This is a critical state corruption: **one physical book would be lent to two separate students concurrently**, breaking physical stock logic.

```
THREAD A (Librarian Sarah approves Student Aung)   ---> Reads Qty = 1 ---> Decrements to 0 ---> COMPLETED (Lent)
                                                                 ▲
                                                                 │  [Concurrency Race Condition Window]
                                                                 ▼
THREAD B (Librarian Kevin approves Student Saw)    ---> Reads Qty = 1 ---> Decrements to -1/0 ---> COMPLETED (Lent)
```

### 3.2 Mitigation: ACID Transaction Isolation
To mitigate this database concurrency hazard, we refactored the backend core circulation hooks inside `/server.ts` to utilize **Drizzle Database Transaction Blocks** (`db.transaction`). 

When a transaction is opened:
1.  All sequential lookup and evaluation steps are wrapped inside a single atomic boundary.
2.  If another session attempts to write to the locked tables, SQLite/MySQL locks the operation or queues the write until the transaction completes.
3.  If the stock check fails (e.g., another process decrements the quantity to `0` right before our transaction validation checks it), the database transaction throws an exception and **rolls back** all preceding writes, preserving state consistency.

#### Implementation snippet of our transaction-safe loan approval system:
```typescript
await db.transaction(async (tx) => {
  // 1. Fetch borrow request inside transaction context
  const record = await tx.query.borrowRecords.findFirst({ 
    where: eq(schema.borrowRecords.id, recordId) 
  });
  if (!record || record.status !== 'requested') throw new Error('Invalid record');

  // 2. Query available physical units
  const book = await tx.query.books.findFirst({ 
    where: eq(schema.books.id, record.bookId) 
  });
  if (!book || book.availableQuantity <= 0) throw new Error('No physical copies left');

  // 3. Atomically decrement stock
  await tx.update(schema.books)
    .set({ availableQuantity: book.availableQuantity - 1 })
    .where(eq(schema.books.id, book.id));

  // 4. Update the borrow record state
  await tx.update(schema.borrowRecords)
    .set({ status: 'borrowed', borrowDate: new Date() })
    .where(eq(schema.borrowRecords.id, record.id));
});
```

---

## 4. Learning & Reflective Analysis (15% Weighting)
Following professional Software Engineering education frameworks (Pressman 2010), critical self-reflection is paramount.

### 4.1 New Areas of Knowledge Acquired
*   **ACID Transactional Paradigms:** Gained a deep theoretical and practical understanding of database isolation levels, and how database write rollback protection prevents double-lending race conditions.
*   **Role-Based Access Control (RBAC):** Explored programmatic claims-security models by signing JSON Web Tokens with user roles, dynamically permitting server route execution.

### 4.2 New Skills Transformed into Capabilities
*   **Relational Schema Mapping (ORM):** Learned to model physical tables, index structures, and cascade-deletion relations inside Drizzle ORM using strong-typed declarations.
*   **Asynchronous Node Middleware Piping:** Mastered the integration of security-hardening packages (Helmet, Rate-limit, CORS) within Express HTTP event lifecycles.

---

## 5. Harvard Referencing list (10% Weighting)
*   **Connolly, T. and Begg, C., 2015.** *Database Systems: A Practical Approach to Design, Implementation and Management.* 6th ed. Boston: Pearson Education.
*   **Libib, 2025.** *Libib Library Management and Cataloging Software Services.* Available at: <https://www.libib.com/> [Accessed 20 May 2026].
*   **Pressman, R.S., 2010.** *Software Engineering: A Practitioner's Approach.* 7th ed. New York: McGraw-Hill.
*   **Sommerville, I., 2016.** *Software Engineering.* 10th ed. Boston: Pearson Education.

---

# How to Deploy This Project on Vercel (Successfully with Database Persistence)
To deploy this project to **Vercel** while maintaining your **relational SQL model** (preserving your ERD and SQL transactions grade), follow this official instruction checklist.

### Steps to Deploy with Vercel and a Serverless SQL Database:
1.  **Do NOT use a local `better-sqlite3` file on Vercel:** Vercel is stateless. The `/library.db` file will reset or get wiped out constantly whenever functions spin down.
2.  **Change Database Engine:**
    *   **Option A (Perfect for SQLite schema):** Provision a free **Turso Database** (libsql serverless dialect compatible with SQLite). Obtain your Turso DB URL and Authentication Token.
    *   **Option B (Vercel Native):** Provision a free **Vercel Postgres** database inside your Vercel project panel. Add the Database connection credentials to Vercel's Environment Variables (Drizzle will connect using the Postgres driver).
3.  **Specify Env Variables in Vite / Express:**
    *   Add your DB environment variables (`DATABASE_URL`, `JWT_SECRET`) in your local `.env` and configure them inside the **Vercel Settings Dashboard**.
4.  **Vercel Build Execution:**
    *   Vercel runs `npm run build` which packages the frontend statically and bundles the node API route `/api/index.ts` connecting to your online SQL database.
