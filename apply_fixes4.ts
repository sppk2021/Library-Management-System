import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

// Book add (around 450)
content = content.replace(
  /const insertBookRes = await db\.insert\(schema\.books\)\.values\(\{([^}]+)\}\);/g,
  'const insertBookRes = await db.insert(schema.books).values({$1}); const book = req.body as any;'
);

// Admin update user (around 737)
content = content.replace(
  /const updateUserRes = await db\.update\(schema\.users\)([\s\S]*?)where\(eq\(schema\.users\.id, Number\(req\.params\.id\)\)\);/g,
  'await db.update(schema.users)$1where(eq(schema.users.id, Number(req.params.id))); const user = (await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) })) as any;'
);

// Admin change role
content = content.replace(
  /const updateUserRes = await db\.update\(schema\.users\)\.set\(\{ role \}\)\.where\(eq\(schema\.users\.id, Number\(req\.params\.id\)\)\);/g,
  'await db.update(schema.users).set({ role }).where(eq(schema.users.id, Number(req.params.id))); const user = (await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) })) as any;'
);

// Delete user
content = content.replace(
  /const deleteUserRes = await db\.delete\(schema\.users\)\.where\(eq\(schema\.users\.id, Number\(req\.params\.id\)\)\);/g,
  'const user = (await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) })) as any; await db.delete(schema.users).where(eq(schema.users.id, Number(req.params.id)));'
);


fs.writeFileSync("server.ts", content);
