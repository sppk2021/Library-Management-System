import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const lines = content.split('\n');
const output = [];
const seedLines = [];
let inSeed = false;

for (const line of lines) {
    if (line.startsWith('// Initialize database')) {
        inSeed = true;
    }
    
    if (inSeed) {
        if (line.startsWith('async function startServer()')) {
            inSeed = false;
            output.push(line);
            output.push(...seedLines);
            continue;
        } else {
            seedLines.push(line);
            continue;
        }
    }
    output.push(line);
}

content = output.join('\n');

content = content.replace("import { drizzle } from 'drizzle-orm/better-sqlite3';", "import { drizzle } from 'drizzle-orm/mysql2';\nimport mysql from 'mysql2/promise';");
content = content.replace("import Database from 'better-sqlite3';", "");
content = content.replace("const dbPath = process.env.VERCEL ? '/tmp/library.db' : 'library.db';", "");
content = content.replace("const sqlite = new Database(dbPath);", "const poolConnection = mysql.createPool(process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/library');\nconst db = drizzle(poolConnection, { schema, mode: 'default' });");
content = content.replace("const db = drizzle(sqlite, { schema });", "");

// sqlite.exec handling
content = content.replace(/sqlite\.exec\(`[\s\S]*?`\);/g, '/* sqlite.exec disabled */');


content = content.replace(/sqlite\.prepare\((.*?)\)\.run\((.*?)\)/g, 'await poolConnection.query($1, [$2])');
content = content.replace(/sqlite\.prepare\((.*?)\)\.run\(\)/g, 'await poolConnection.query($1)');
content = content.replace(/sqlite\.prepare\((.*?)\)\.all\(\)/g, '(await poolConnection.query($1))[0] as any');
content = content.replace(/sqlite\.prepare\((.*?)\)\.get\(\)/g, '(await poolConnection.query($1))[0][0] as any');

content = content.replace(/strftime\('%Y-%m', datetime\(borrow_date\/1000, 'unixepoch'\)\)/g, "DATE_FORMAT(FROM_UNIXTIME(borrow_date/1000), '%Y-%m')");
content = content.replace(/date\('now', 'start of month', '-5 months'\)/g, "DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 5 MONTH)");
content = content.replace(/date\('now', 'start of month'\)/g, "DATE_FORMAT(NOW(), '%Y-%m-01')");
content = content.replace(/date\(m, '\+1 month'\)/g, "DATE_ADD(m, INTERVAL 1 MONTH)");
content = content.replace(/res\.lastInsertRowid/g, 'res[0].insertId');

fs.writeFileSync('server.ts', content);
