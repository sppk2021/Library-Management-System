import * as fs from 'fs';
const lines = fs.readFileSync('server.ts', 'utf-8').split('\n');
const errors = [522, 547, 572, 580, 743, 751, 761, 776, 794];
errors.forEach(e => console.log(`${e}: ${lines[e-1]}`));
