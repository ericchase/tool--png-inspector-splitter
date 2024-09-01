import { bytesToString, Chunk, compressIDAT, createIDAT, decompressIDAT, extractChunks, getScanlineSize, U8Concat, U8Take } from './lib/lib.js';

const [, , path] = Bun.argv;

const buffer = await Bun.file(path).bytes();

// Extract the Signature
const [signatureBytes, rest] = U8Take(buffer, 8);
const chunks = extractChunks(rest).map((bytes) => new Chunk(bytes));

// Extract All the Chunks
const chunkTop: Chunk[] = [];
const chunkData: Chunk[] = [];
const chunkBot: Chunk[] = [];
let index = 0;
while (index < chunks.length) {
  const chunk = chunks[index];
  // const { type } = analyzeChunk(chunks[index]);
  if (String.fromCharCode(...chunk.type) === 'IDAT') {
    break;
  }
  chunkTop.push(chunk);
  index++;
}
while (index < chunks.length) {
  const chunk = chunks[index];
  if (String.fromCharCode(...chunk.type) !== 'IDAT') {
    break;
  }
  chunkData.push(chunk);
  index++;
}
while (index < chunks.length) {
  const chunk = chunks[index];
  chunkBot.push(chunk);
  index++;
}

function splitDecompressedData(IHDR: Chunk, decompressed_IDAT_bytes: Uint8Array) {
  const { scanlineSize } = getScanlineSize(IHDR);
  const scanlines: Uint8Array[] = [];
  for (let i = 0; i < decompressed_IDAT_bytes.length; i += scanlineSize) {
    const scanline = decompressed_IDAT_bytes.slice(i, i + scanlineSize);
    scanlines.push(scanline);
  }
  return scanlines;
}

// Combine IDATs, Decompress, Split Decompressed Data into Scanlines, Group Scanlines, Compress Groups, Create New Pngs
const IHDR = chunkTop.find((chunk) => bytesToString(chunk.type) === 'IHDR');
if (IHDR) {
  const IDAT = chunkData[0];
  const decompressed_bytes = decompressIDAT(IDAT.data);
  if (decompressed_bytes) {
    const scanlines = splitDecompressedData(IHDR, decompressed_bytes);
    const size = 50;
    for (let i = 0; i * size < scanlines.length; i++) {
      const compressed_data = compressIDAT(U8Concat(scanlines.slice(i * size, i * size + size)));
      if (compressed_data) {
        const newIDAT = createIDAT(compressed_data);
        await Bun.write(path + '__split' + i + '.png', U8Concat([signatureBytes, ...chunkTop.map((_) => _.bytes), newIDAT, ...chunkBot.map((_) => _.bytes)]));
      }
    }
  }
}
