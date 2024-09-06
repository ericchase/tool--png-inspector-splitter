import { PNGSplit } from '../lib/png-split.js';

const path = Bun.argv[2];
const max_height_per_file = Bun.argv[3] === undefined ? 4096 : Number.parseInt(Bun.argv[3]);
const buffer = await Bun.file(path).bytes();

PNGSplit(buffer, max_height_per_file);
