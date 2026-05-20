import * as fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(
  "const [user] = await db.delete(schema.users).where(eq(schema.users.id, id));",
  "const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) }) as any; await db.delete(schema.users).where(eq(schema.users.id, id));"
);
fs.writeFileSync('server.ts', content);
