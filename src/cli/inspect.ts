import { PNGInspect } from '../lib/png-inspect.js';

const path = Bun.argv[2];
const buffer = await Bun.file(path).bytes();

PNGInspect(buffer);
