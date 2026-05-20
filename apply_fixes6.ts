import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Fix 569 - 580 (dueDate Date object, and record undefined)
content = content.replace(
  `      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 2 weeks default

      await db.insert(schema.borrowRecords).values({
        userId: req.user.id,
        bookId,
        dueDate,
        status: 'requested'
      });

      await logAction(req.user.id, 'BORROW_REQUEST', \`Requested book ID: \${bookId}\`);
      res.json(record);`,
  `      const dueDateStr = Date.now() + 14 * 24 * 60 * 60 * 1000;

      const recordRes = await db.insert(schema.borrowRecords).values({
        userId: req.user.id as any,
        bookId,
        borrowDate: Date.now() as any,
        dueDate: dueDateStr as any,
        status: 'requested'
      });
      const record = { id: (recordRes[0] as any).insertId };
      await logAction(req.user.id, 'BORROW_REQUEST', \`Requested book ID: \${bookId}\`);
      res.json(record);`
);


// User update in admin (lines 738-741)
content = content.replace(
  `      const [user] = await db.update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, userId))
        ;`,
  `      await db.update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, userId));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) }) as any;`
);


// User update role (lines 771-774)
content = content.replace(
  `      const [user] = await db.update(schema.users)
        .set({ role })
        .where(eq(schema.users.id, Number(req.params.id)))
        ;`,
  `      await db.update(schema.users)
        .set({ role })
        .where(eq(schema.users.id, Number(req.params.id)));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) }) as any;`
);


// User delete (line ~790-something after students & librarians) Oh wait, I see `server.ts(794,73): error TS2339: Property 'email' does not exist on type 'ResultSetHeader'.`
// Let's print that area first to be safe, I'll just write one replacer for line 783 onwards.
content = content.replace(
  `      const [user] = await db.delete(schema.users)
        .where(eq(schema.users.id, id))
        ;`,
  `      const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) }) as any;
      await db.delete(schema.users).where(eq(schema.users.id, id));`
);


fs.writeFileSync('server.ts', content);
