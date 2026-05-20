import * as fs from 'fs';
const lines = fs.readFileSync('server.ts', 'utf-8').split('\n');
const errors = [450, 521, 571, 742, 750, 760, 775, 793];
errors.forEach(e => console.log(`${e}: ${lines[e-1]}`));
