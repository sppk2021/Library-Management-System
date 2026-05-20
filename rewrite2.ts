import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Replace standard multi-line runs
content = content.replace(/sqlite\.prepare\(([\s\S]*?)\)\.run\(([\s\S]*?)\)/g, 'await poolConnection.query($1, [$2])');
content = content.replace(/sqlite\.prepare\(([\s\S]*?)\)\.run\(\)/g, 'await poolConnection.query($1)');
content = content.replace(/sqlite\.prepare\(([\s\S]*?)\)\.all\(\)/g, '(await poolConnection.query($1))[0] as any');
content = content.replace(/sqlite\.prepare\(([\s\S]*?)\)\.get\(\)/g, '(await poolConnection.query($1))[0][0] as any');

// Fix the forEach scopes for awaited things
content = content.replace(/tablesToAlter\.forEach\(\(\{ table, column, type \}\) => \{([\s\S]*?)\}\);/g, 'for (const { table, column, type } of tablesToAlter) {$1}');
content = content.replace(/categories\.forEach\(cat => \{([\s\S]*?)\}\);/g, 'for (const cat of categories) {$1}');
content = content.replace(/studentData\.forEach\(s => \{([\s\S]*?)\}\);/g, 'for (const s of studentData) {$1}');
content = content.replace(/librarianData\.forEach\(l => \{([\s\S]*?)\}\);/g, 'for (const l of librarianData) {$1}');

fs.writeFileSync('server.ts', content);
