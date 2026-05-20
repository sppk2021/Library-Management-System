import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Replace new Date() with Date.now() in db payloads
content = content.replace(/:\s*new Date\(\)/g, ': Date.now()');
content = content.replace(/dueDate:\s*new Date\(/g, 'dueDate: Date.now() + (');
// Removing .returning() chaining loosely by just stripping it
content = content.replace(/\.returning\(\)/g, '');

fs.writeFileSync('server.ts', content);
