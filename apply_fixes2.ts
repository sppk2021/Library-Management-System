import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");
content = content.replace(/res\[0\]\.insertId/g, '(res[0] as any).insertId');

// Fix config
content = content.replace(
  `      const [config] = await db.update(schema.systemConfig)
        .set({ value: req.body.value, updatedAt: Date.now() as any })
        .where(eq(schema.systemConfig.key, req.params.key))
        ;`,
  `      await db.update(schema.systemConfig)
        .set({ value: req.body.value, updatedAt: Date.now() as any })
        .where(eq(schema.systemConfig.key, req.params.key));
      const config = { key: req.params.key, value: req.body.value };`
);


// category insertion
content = content.replace(
  `    const [cat] = await db.insert(schema.categories).values(req.body);`,
  `    await db.insert(schema.categories).values(req.body);`
);

// Borrow record insertion
content = content.replace(
  `      const [record] = await db.insert(schema.borrowRecords).values({
        userId: req.user.id,
        bookId: Number(bookId),
        dueDate: Date.now() + (14 * 24 * 60 * 60 * 1000) as any, // Default 14 days initially
        status: 'requested',
      });`,
  `      await db.insert(schema.borrowRecords).values({
        userId: req.user.id as any,
        bookId: Number(bookId),
        dueDate: (Date.now() + (14 * 24 * 60 * 60 * 1000)) as any,
        status: 'requested',
      });`
);

// In book insert: "book.title does not exist on type ResultSetHeader"
// That means my previous replace on book insert didn't work fully? Let's check how book is used.
content = content.replace(
  `      const book = { ...req.body, id: insertRes[0].insertId };`,
  `      const book = { ...req.body, id: insertRes[0].insertId } as any;`
);
content = content.replace(
  `      const user = { id: userId, role: role || 'student', email };`,
  `      const user = { id: userId, role: role || 'student', email } as any;`
);


fs.writeFileSync("server.ts", content);
