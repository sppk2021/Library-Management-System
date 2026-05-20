import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(/Date\.now\(\]/g, 'Date.now()');
fs.writeFileSync('server.ts', content);
