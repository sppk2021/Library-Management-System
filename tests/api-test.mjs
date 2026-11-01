/**
 * ============================================================================
 * AUTOMATED API TESTS (evidence for Chapter 6 – Testing and Results)
 * ============================================================================
 *
 * How to run:
 *   1. Start XAMPP → MySQL, then start the app:   npm run dev
 *   2. In a second terminal:                       npm run test:api
 *
 * The script acts like a browser: it logs in as the demo users and calls the API,
 * then prints PASS / FAIL for every test case. To create an "overdue" loan without
 * waiting 14 days, it connects to MySQL directly and moves a due date into the past.
 *
 * ⚠ It changes data (creates loans, users and settings, then puts settings back),
 *   so run it on a development database, not on the live demo database.
 *   Run it at most once every 5 minutes: test T2 deliberately triggers the
 *   login lock-out (3 wrong passwords → blocked for 5 minutes).
 * ============================================================================
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const BASE = process.env.API_URL || 'http://localhost:3000/api';
const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/library_db';

let passed = 0;
let failed = 0;

/** Prints one test result line. */
function check(id, description, condition, detail = '') {
  if (condition) passed++; else failed++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${id.padEnd(4)} ${description}${detail ? `  (${detail})` : ''}`);
}

/** Calls the API like the React app does and returns { status, body }. */
async function api(method, url, token, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

async function login(email, password) {
  const r = await api('POST', '/auth/login', null, { email, password });
  return r.body.token;
}

async function getBook(id) {
  const r = await api('GET', '/books');
  return r.body.find((b) => b.id === id);
}

async function main() {
  const db = await mysql.createConnection(DATABASE_URL.replace(/\?.*$/, ''));
  const stamp = Date.now();

  // ---------------------------------------------------------------- logins
  const loginRes = await api('POST', '/auth/login', null, { email: 'saw@student.edu', password: 'password123' });
  check('T1', 'Student can log in with valid credentials', loginRes.status === 200 && !!loginRes.body.token);
  const student = loginRes.body.token;
  const student2 = await login('aung@student.edu', 'password123');
  const librarian = await login('sarah@library.edu', 'password123');
  const librarian2 = await login('kevin@library.edu', 'password123');
  const admin = await login('admin@library.edu', 'admin123');

  // Pick two books that currently have a free copy
  const allBooks = (await api('GET', '/books')).body.filter((b) => b.availableQuantity > 0 && b.quantity === 1);
  const bookA = allBooks[0];
  const bookB = allBooks[1];

  // ------------------------------------------------------ borrow workflow
  const request = await api('POST', '/borrow/request', student, { bookId: bookA.id });
  check('T3', 'Student can request an available book', request.status === 200 && request.body.status === 'requested');

  const approve = await api('POST', `/borrow/approve/${request.body.id}`, librarian);
  const afterApprove = await getBook(bookA.id);
  check('T4', 'Librarian approval succeeds and stock goes down by 1',
    approve.status === 200 && afterApprove.availableQuantity === bookA.availableQuantity - 1,
    `HTTP ${approve.status}, stock ${bookA.availableQuantity} -> ${afterApprove.availableQuantity}`);

  // T5: two students request the SAME last copy; two librarians approve at the SAME moment
  const reqX = await api('POST', '/borrow/request', student, { bookId: bookB.id });
  const reqY = await api('POST', '/borrow/request', student2, { bookId: bookB.id });
  const [approveX, approveY] = await Promise.all([
    api('POST', `/borrow/approve/${reqX.body.id}`, librarian),
    api('POST', `/borrow/approve/${reqY.body.id}`, librarian2),
  ]);
  const afterRace = await getBook(bookB.id);
  const successes = [approveX, approveY].filter((r) => r.status === 200).length;
  check('T5', 'Concurrent approvals for the last copy: exactly one succeeds, stock never below 0',
    successes === 1 && afterRace.availableQuantity === 0,
    `successes=${successes}, stock=${afterRace.availableQuantity}`);

  const returnReq = await api('POST', `/borrow/return-request/${request.body.id}`, student);
  const returnOk = await api('POST', `/borrow/return-approve/${request.body.id}`, librarian);
  const afterReturn = await getBook(bookA.id);
  check('T6', 'Return request + approval puts the copy back on the shelf',
    returnReq.status === 200 && returnOk.status === 200 && afterReturn.availableQuantity === bookA.availableQuantity);

  const doubleReturn = await api('POST', `/borrow/return-approve/${request.body.id}`, librarian);
  check('T6b', 'The same return cannot be approved twice', doubleReturn.status === 400);

  // ------------------------------------------------------------ security
  const evilEmail = `attacker${stamp}@test.com`;
  await api('POST', '/auth/register', null, { fullName: 'Attacker', email: evilEmail, password: 'p4ss', role: 'admin' });
  const evilLogin = await api('POST', '/auth/login', null, { email: evilEmail, password: 'p4ss' });
  check('T7', 'Public sign-up with role=admin is created as a student only',
    evilLogin.body.user?.role === 'student', `role=${evilLogin.body.user?.role}`);

  const studentAdmin = await api('GET', '/admin/users', student);
  check('T8', 'Student is refused access to admin-only API (403)', studentAdmin.status === 403);

  const librarianCreate = await api('POST', '/admin/users', librarian, { fullName: 'X', email: `x${stamp}@t.com`, password: 'p', role: 'admin' });
  check('T8b', 'Librarian cannot create accounts (admin only)', librarianCreate.status === 403);

  const adminCreate = await api('POST', '/admin/users', admin, {
    fullName: 'New Librarian', email: `newlib${stamp}@library.edu`, password: 'password123', role: 'librarian', employeeCode: `EMP${stamp}`,
  });
  const newLibLogin = await api('POST', '/auth/login', null, { email: `newlib${stamp}@library.edu`, password: 'password123' });
  check('T8c', 'Admin can create a librarian account', adminCreate.status === 200 && newLibLogin.body.user?.role === 'librarian');

  const users = await api('GET', '/admin/users', admin);
  const [[hashRow]] = await db.query("SELECT password FROM users WHERE email = 'saw@student.edu'");
  check('T13', 'Passwords are stored as bcrypt hashes and never sent to the browser',
    hashRow.password.startsWith('$2') && users.body.every((u) => u.password === undefined));

  // -------------------------------------------------------------- backup
  const noTokenBackup = await api('GET', '/admin/database-dump');
  const backup = await api('GET', '/admin/database-dump', admin);
  check('T9', 'Admin backup download returns a .sql file (and is refused without login)',
    noTokenBackup.status === 401 && backup.status === 200
      && String(backup.body).includes('CREATE TABLE users') && String(backup.body).includes('INSERT INTO `books`'));

  // ------------------------------------------------------------- reports
  const reports = await api('GET', '/reports/detailed', admin);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRow = reports.body.monthlyTrends?.find((m) => m.month === thisMonth);
  check('T10', 'Monthly trend report counts this month\'s loans', monthRow && monthRow.borrow_count >= 1,
    `${thisMonth}: ${monthRow?.borrow_count}`);

  // ------------------------------------------------- settings, fines, limits
  const [[rateRow]] = await db.query("SELECT value FROM system_config WHERE `key` = 'DAILY_FINE_RATE'");
  await api('PUT', '/config/DAILY_FINE_RATE', admin, { value: '2.00' });
  // The loan approved in the race above (bookB) is made 3 days overdue
  const overdueRecordId = approveX.status === 200 ? reqX.body.id : reqY.body.id;
  const overdueOwner = approveX.status === 200 ? student : student2;
  await db.query('UPDATE borrow_records SET due_date = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY) WHERE record_id = ?', [overdueRecordId]);
  const history = await api('GET', '/borrow/history', admin);
  const overdue = history.body.find((h) => h.record.id === overdueRecordId).record;
  check('T11', 'Fine uses the rate stored in system_config (3 days × 2.00 = 6.00)', overdue.fineAmount === 6, `fine=${overdue.fineAmount}`);
  check('T12', 'Late loan is marked overdue automatically', overdue.status === 'overdue');

  const earlyPay = await api('POST', `/borrow/pay-fine/${overdueRecordId}`, librarian);
  check('T15', 'Fine cannot be settled while the book is still out', earlyPay.status === 400);

  await api('POST', `/borrow/return-request/${overdueRecordId}`, overdueOwner);
  await api('POST', `/borrow/return-approve/${overdueRecordId}`, librarian);
  const pay = await api('POST', `/borrow/pay-fine/${overdueRecordId}`, librarian);
  const historyAfterPay = await api('GET', '/borrow/history', admin);
  const paidRecord = historyAfterPay.body.find((h) => h.record.id === overdueRecordId).record;
  check('T16', 'A paid fine stays paid after the page reloads', pay.status === 200 && paidRecord.fineAmount === 0,
    `fine=${paidRecord.fineAmount}`);
  await api('PUT', '/config/DAILY_FINE_RATE', admin, { value: rateRow.value });

  const [[maxRow]] = await db.query("SELECT value FROM system_config WHERE `key` = 'MAX_LOANS_PER_USER'");
  await api('PUT', '/config/MAX_LOANS_PER_USER', admin, { value: '1' });
  const firstLoan = await api('POST', '/borrow/request', student, { bookId: allBooks[2].id });
  const secondLoan = await api('POST', '/borrow/request', student, { bookId: allBooks[3].id });
  check('T17', 'Loan limit from system_config is enforced', firstLoan.status === 200 && secondLoan.status === 400,
    String(secondLoan.body.error || ''));
  await api('PUT', '/config/MAX_LOANS_PER_USER', admin, { value: maxRow.value });

  const [[sawRow]] = await db.query("SELECT user_id FROM users WHERE email = 'saw@student.edu'");
  const deleteActive = await api('DELETE', `/admin/users/${sawRow.user_id}`, admin);
  check('T18', 'A member with an active loan request cannot be deleted', deleteActive.status === 400);
  await api('POST', `/borrow/reject/${firstLoan.body.id}`, librarian); // tidy up

  // ------------------------------------------------- settings validation
  const negativeFine = await api('PUT', '/config/DAILY_FINE_RATE', admin, { value: '-1' });
  const zeroDays = await api('PUT', '/config/LOAN_DURATION_DAYS', admin, { value: '0' });
  const fractionLimit = await api('PUT', '/config/MAX_LOANS_PER_USER', admin, { value: '2.5' });
  check('T19', 'Settings reject invalid values (negative fine, 0 days, fractional limit)',
    negativeFine.status === 400 && zeroDays.status === 400 && fractionLimit.status === 400);
  const librarianSetting = await api('PUT', '/config/DAILY_FINE_RATE', librarian, { value: '1' });
  check('T20', 'Only an admin can change settings', librarianSetting.status === 403);

  // ---------------------------------------------- T2 last: login lock-out
  const attempts = [];
  for (let i = 0; i < 4; i++) {
    attempts.push((await api('POST', '/auth/login', null, { email: 'saw@student.edu', password: 'wrong' })).status);
  }
  check('T2', '4th wrong password in a row is blocked (rate limit)', attempts[3] === 429, `statuses ${attempts.join(',')}`);

  await db.end();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Test run crashed:', error);
  process.exit(1);
});
