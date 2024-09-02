import { bytesToString, Chunk, compressIDATdata, createIDAT, createIHDR, decompressIDATdata, extractChunks, getScanlineSize, parseIHDRChunk, U8Concat, U8Take } from './lib/lib.js';

const [, , path] = Bun.argv;

const buffer = await Bun.file(path).bytes();

// Extract the Signature
const [signatureBytes, rest] = U8Take(buffer, 8);
const chunks = extractChunks(rest).map((bytes) => new Chunk(bytes));

// Extract All the Chunks
const topChunks: Chunk[] = [];
const dataChunks: Chunk[] = [];
const botChunks: Chunk[] = [];
let index = 0;
while (index < chunks.length) {
  const chunk = chunks[index];
  // const { type } = analyzeChunk(chunks[index]);
  if (String.fromCharCode(...chunk.type) === 'IDAT') {
    break;
  }
  topChunks.push(chunk);
  index++;
}
while (index < chunks.length) {
  const chunk = chunks[index];
  if (String.fromCharCode(...chunk.type) !== 'IDAT') {
    break;
  }
  dataChunks.push(chunk);
  index++;
}
while (index < chunks.length) {
  const chunk = chunks[index];
  botChunks.push(chunk);
  index++;
}

// Combine IDATs, Decompress, Split Decompressed Data into Scanlines, Group Scanlines, Compress Groups, Create New Pngs
const IHDR = topChunks.find((chunk) => bytesToString(chunk.type) === 'IHDR');
const IDAT = dataChunks.at(0);
const topChunksWithoutIHDR = topChunks.filter((chunk) => bytesToString(chunk.type) !== 'IHDR');

if (!IHDR) throw 'error: IHDR';
if (!IDAT) throw 'error: IDAT';

const decompressed_bytes = decompressIDATdata(IDAT.data);
if (!decompressed_bytes) throw 'error: decompressed_bytes';

const { width, bitDepth, colorType } = parseIHDRChunk(IHDR);
// Get the scanlines
const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
const scanlines: Uint8Array[] = [];
for (let i = 0; i < decompressed_bytes.length; i += scanlineSize) {
  const scanline = decompressed_bytes.slice(i, i + scanlineSize);
  scanlines.push(scanline);
}
// Combine scanlines into groups of 50
const scanline_group_size = 50;
for (let i = 0; i * scanline_group_size < scanlines.length; i++) {
  // Compress the scanline group and
  const compressed_data = compressIDATdata(U8Concat(scanlines.slice(i * scanline_group_size, i * scanline_group_size + scanline_group_size)));
  if (!compressed_data) throw 'error: compressed_data';
  // Create the new IDAT
  const newIDAT = createIDAT(compressed_data);
  // Create the new IHDR
  const newIHDR = createIHDR(width, scanline_group_size, bitDepth, colorType);
  await Bun.write(path + '__split' + i + '.png', U8Concat([signatureBytes, newIHDR, ...topChunksWithoutIHDR.map((_) => _.bytes), newIDAT, ...botChunks.map((_) => _.bytes)]));
}
