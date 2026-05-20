import re
import sys

with open("server.ts", "r") as f:
    text = f.read()

# Fix the book insert issue
text = re.sub(
    r"const \[book\] = await db\.insert\(schema\.books\)\.values\(\{\s*\.\.\.req\.body,\s*createdAt:(.*?)\s*\}\);",
    r"await db.insert(schema.books).values({ ...req.body, createdAt: \1 });\n      const book = req.body as any;",
    text
)

# Fix book update issue
text = re.sub(
    r"const \[book\] = await db\.update\(schema\.books\)\s*\.set\(req\.body\)\s*\.where\(eq\(schema\.books\.id, Number\(req\.params\.id\)\)\);",
    r"await db.update(schema.books).set(req.body).where(eq(schema.books.id, Number(req.params.id)));\n      const book = { ...req.body, title: req.body.title || 'Unknown' } as any;",
    text
)

# Fix borrow insert
text = re.sub(
    r"const \[record\] = await db\.insert\(schema\.borrowRecords\)\.values\(\{([^}]+)\}\);",
    r"await db.insert(schema.borrowRecords).values({\1});",
    text
)
# And dueDate inside the same block
text = re.sub(
    r"dueDate: (.*?)(,\n|\n)",
    r"dueDate: (Date.now() + 14 * 24 * 60 * 60 * 1000) as any\2",
    text
)


# Fix the user admin update
text = re.sub(
    r"const \[user\] = await db\.update\(schema\.users\)\.set\(\{ fullName, phone \}\)\.where\(eq\(schema\.users\.id, Number\(req\.params\.id\)\)\);",
    r"await db.update(schema.users).set({ fullName, phone }).where(eq(schema.users.id, Number(req.params.id)));\n        const user = (await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) })) as any;",
    text
)

text = re.sub(
    r"const \[user\] = await db\.update\(schema\.users\)\.set\(\{ role \}\)\.where\(eq\(schema\.users\.id, Number\(req\.params\.id\)\)\);",
    r"await db.update(schema.users).set({ role }).where(eq(schema.users.id, Number(req.params.id)));\n      const user = (await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) })) as any;",
    text
)

text = re.sub(
    r"const \[user\] = await db\.delete\(schema\.users\)\.where\(eq\(schema\.users\.id, Number\(req\.params\.id\)\)\);",
    r"const user = (await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) })) as any;\n      await db.delete(schema.users).where(eq(schema.users.id, Number(req.params.id)));",
    text
)

with open("server.ts", "w") as f:
    f.write(text)
