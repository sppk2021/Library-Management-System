import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");
content = content.replace(/const \[book\] = await db\.insert/g, 'const insertBookRes = await db.insert');
content = content.replace(/const \[user\] = await db\.update/g, 'const updateUserRes = await db.update');
content = content.replace(/const \[book\] = await db\.update/g, 'const updateBookRes = await db.update');
content = content.replace(/const \[user\] = await db\.delete/g, 'const deleteUserRes = await db.delete');
content = content.replace(/const \[record\] = await db\.insert/g, 'const insertRecordRes = await db.insert');

// The dueDate TS Date error is on line 571 where the code is:
// const [record] = await db.insert(schema.borrowRecords).values({
//   userId: req.user.id,
//   bookId: Number(bookId),
//   dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 
content = content.replace(/dueDate:\s*new Date\([^)]+\)/g, 'dueDate: (Date.now() + 14 * 24 * 60 * 60 * 1000) as any');
content = content.replace(/dueDate:\s*Date\.now\([^)]+\)/g, 'dueDate: (Date.now() + 14 * 24 * 60 * 60 * 1000) as any');

fs.writeFileSync("server.ts", content);
