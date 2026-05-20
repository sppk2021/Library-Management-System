import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// fix lines 514-522
content = content.replace(
  `      const [book] = await db.update(schema.books)
        .set({
          ...data,
          categoryId: data.categoryId ? Number(data.categoryId) : null,
          availableQuantity: newAvailable
        })
        .where(eq(schema.books.id, Number(req.params.id)))
        ;`,
  `      await db.update(schema.books)
        .set({
          ...data,
          categoryId: data.categoryId ? Number(data.categoryId) : null,
          availableQuantity: newAvailable
        })
        .where(eq(schema.books.id, Number(req.params.id)));
      const book = await db.query.books.findFirst({ where: eq(schema.books.id, Number(req.params.id)) }) as any;`
);

// fix line 547
content = content.replace(
  `    res.json(cat);`,
  `    res.json(req.body);`
);

// fix line 572
// Find the borrow request inserting
content = content.replace(
  `      await db.insert(schema.borrowRecords).values({
        userId: req.user.id as any,
        bookId: Number(bookId),
        dueDate: (Date.now() + 14 * 24 * 60 * 60 * 1000) as any,
        status: 'requested',
      });
      
      await logAction(req.user.id, 'BORROW_REQUEST', \`Requested book ID: \${bookId}\`);
      res.json(record);`,
  `      const insertRecordRes = await db.insert(schema.borrowRecords).values({
        userId: req.user.id as any,
        bookId: Number(bookId),
        borrowDate: Date.now() as any, // fix date!
        dueDate: (Date.now() + 14 * 24 * 60 * 60 * 1000) as any,
        status: 'requested',
      });
      const record = { id: (insertRecordRes[0] as any).insertId, bookId: Number(bookId), status: 'requested' };
      await logAction(req.user.id, 'BORROW_REQUEST', \`Requested book ID: \${bookId}\`);
      res.json(record);`
);

// check user profile changes for admin
content = content.replace(
  `      const [user] = await db.update(schema.users)
        .set({ fullName, phone, email, role: role || 'student' })
        .where(eq(schema.users.id, Number(req.params.id)))
        ;`,
  `      await db.update(schema.users)
        .set({ fullName, phone, email, role: role || 'student' })
        .where(eq(schema.users.id, Number(req.params.id)));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) }) as any;`
);

fs.writeFileSync('server.ts', content);
