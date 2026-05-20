import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

// Fix register insert
content = content.replace(
  `      const [user] = await db.insert(schema.users).values({
        fullName,
        email,
        password: hashedPassword,
        role: role || 'student',
        phone,
        createdAt: Date.now()
      });`,
  `      const insertRes = await db.insert(schema.users).values({
        fullName,
        email,
        password: hashedPassword,
        role: role || 'student',
        phone,
        createdAt: Date.now() as any
      });
      const userId = insertRes[0].insertId;
      const user = { id: userId, role: role || 'student', email };`
);

// Fix TS Date error in borrow records
content = content.replace(/borrowDate:\s*Date\.now\(\)/g, "borrowDate: Date.now() as any");
content = content.replace(/dueDate:\s*Date\.now\(\)\s*\+\s*\(([^)]+)\)/g, "dueDate: (Date.now() + ($1)) as any");
content = content.replace(/returnDate:\s*Date\.now\(\)/g, "returnDate: Date.now() as any");

// Fix book insert
content = content.replace(
  `      const [book] = await db.insert(schema.books).values({
        ...req.body,
        createdAt: Date.now()
      });`,
  `      const insertRes = await db.insert(schema.books).values({
        ...req.body,
        createdAt: Date.now() as any
      });
      const book = { ...req.body, id: insertRes[0].insertId };`
);

content = content.replace(
  `      const [user] = await db.update(schema.users)
        .set({ fullName, phone })
        .where(eq(schema.users.id, req.user.id))
        ;`,
  `      await db.update(schema.users)
        .set({ fullName, phone })
        .where(eq(schema.users.id, req.user.id));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, req.user.id) }) as any;`
);

// Other updates that do `const [var] = await db.update...`
// There is book update
content = content.replace(
  `      const [book] = await db.update(schema.books)
        .set(req.body)
        .where(eq(schema.books.id, Number(req.params.id)))
        ;`,
  `      await db.update(schema.books)
        .set(req.body)
        .where(eq(schema.books.id, Number(req.params.id)));
      const book = await db.query.books.findFirst({ where: eq(schema.books.id, Number(req.params.id)) }) as any;`
);


// User update in admin
content = content.replace(
  `        const [user] = await db.update(schema.users).set({ fullName, phone }).where(eq(schema.users.id, Number(req.params.id)));`,
  `        await db.update(schema.users).set({ fullName, phone }).where(eq(schema.users.id, Number(req.params.id)));
        const user = await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) }) as any;`
);


// User delete in admin
content = content.replace(
  `      const [user] = await db.delete(schema.users).where(eq(schema.users.id, Number(req.params.id)));`,
  `      const user = await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) }) as any;
      await db.delete(schema.users).where(eq(schema.users.id, Number(req.params.id)));`
);

// Serial Issue add
content = content.replace(
  `      const [issue] = await db.insert(schema.serialIssues).values({
        bookId: Number(req.params.id),
        ...req.body
      });`,
  `      await db.insert(schema.serialIssues).values({
        bookId: Number(req.params.id),
        ...req.body
      });`
);

// User role change
content = content.replace(
  `      const [user] = await db.update(schema.users).set({ role }).where(eq(schema.users.id, Number(req.params.id)));`,
  `      await db.update(schema.users).set({ role }).where(eq(schema.users.id, Number(req.params.id)));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) }) as any;`
);

fs.writeFileSync("server.ts", content);
