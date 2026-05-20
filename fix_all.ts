import * as fs from 'fs';

let text = fs.readFileSync("server.ts", "utf-8");

text = text.replace(/const \[book\] = await db\.insert\(schema\.books\)\.values\(\{([\s\S]*?)createdAt:([\s\S]*?)\}\);/, "await db.insert(schema.books).values({$1createdAt:$2});\n      const book = req.body as any;");

text = text.replace(/const \[book\] = await db\.update\(schema\.books\)[\s\S]*?\.set\(req\.body\)[\s\S]*?\.where\(eq\(schema\.books\.id, Number\(req\.params\.id\)\)\);/, "await db.update(schema.books).set(req.body).where(eq(schema.books.id, Number(req.params.id)));\n      const book = { ...req.body, title: req.body.title || 'Unknown' } as any;");

text = text.replace(/const \[record\] = await db\.insert\(schema\.borrowRecords\)\.values\(\{([\s\S]*?)\}\);/, "await db.insert(schema.borrowRecords).values({$1});");

text = text.replace(/dueDate:\s*Date\.now\(\)\s*\+\s*\([^\)]*\)/g, "dueDate: (Date.now() + 14 * 24 * 60 * 60 * 1000) as any");
text = text.replace(/dueDate:\s*new Date\([^\)]*\)/g, "dueDate: (Date.now() + 14 * 24 * 60 * 60 * 1000) as any");

// Also there was one `dueDate:` with `Date.now() + 14...` without parens 
text = text.replace(/dueDate:\s*\(Date\.now\(\) \+ \([^\)]*\)\) as any/g, "dueDate: (Date.now() + 14 * 24 * 60 * 60 * 1000) as any");

text = text.replace(/const \[user\] = await db\.update\(schema\.users\)\.set\(\{ fullName, phone \}\)\.where\(eq\(schema\.users\.id, Number\(req\.params\.id\)\)\);/, "await db.update(schema.users).set({ fullName, phone }).where(eq(schema.users.id, Number(req.params.id)));\n        const user = (await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) })) as any;");

text = text.replace(/const \[user\] = await db\.update\(schema\.users\)\.set\(\{ role \}\)\.where\(eq\(schema\.users\.id, Number\(req\.params\.id\)\)\);/, "await db.update(schema.users).set({ role }).where(eq(schema.users.id, Number(req.params.id)));\n      const user = (await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) })) as any;");

text = text.replace(/const \[user\] = await db\.delete\(schema\.users\)\.where\(eq\(schema\.users\.id, Number\(req\.params\.id\)\)\);/, "const user = (await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) })) as any;\n      await db.delete(schema.users).where(eq(schema.users.id, Number(req.params.id)));");

fs.writeFileSync("server.ts", text);
