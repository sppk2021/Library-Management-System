import * as fs from 'fs';
const lines = fs.readFileSync('server.ts', 'utf-8').split('\n');
const errors = [57, 97, 115, 175, 179, 329, 348, 388, 403, 404, 405, 448, 472, 495, 519, 530, 576, 622, 638, 658, 681, 694, 758, 773, 791, 826, 827, 880, 881, 887, 898, 903, 935];
errors.forEach(e => console.log(`${e}: ${lines[e-1]}`));
