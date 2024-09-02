import { ArrayEquals, ArraySplit, U8SConcat, U8SSplit, U8STake, U8SToASCII, U8SToHex } from './lib/array.js';
import { Chunk, compressIDATdata, createIDATchunk, createIHDRchunk, decompressIDATdata, extractChunks, getScanlineSize, parseIHDRChunk } from './lib/png.js';

const [, , path] = Bun.argv;

const buffer = await Bun.file(path).bytes();

// Extract the Signature
const [signatureBytes, rest] = U8STake(buffer, 8);
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

console.log('Extract IHDR and Parse');
const IHDR = topChunks.find((chunk) => U8SToASCII(chunk.type) === 'IHDR');
if (!IHDR) throw 'error: IHDR';
const { bitDepth, colorType, compressionMethod, filterMethod, height, interlaceMethod, width } = parseIHDRChunk(IHDR);

// Combine IDATs, Decompress, Split Decompressed Data into Scanlines, Group Scanlines, Compress Groups, Create New Pngs
const compressed_bytes = U8SConcat(dataChunks.map((chunk) => chunk.data));
console.log('Compressed Data Size:', compressed_bytes.byteLength);

console.log('Decompressing Data');
const decompressed_bytes = decompressIDATdata(compressed_bytes);
if (!decompressed_bytes) throw 'error: decompressed_bytes';
console.log('Decompressed Data Size:', decompressed_bytes.byteLength);

// Get top chunks without IHDR
const topChunksWithoutIHDR = topChunks.filter((chunk) => U8SToASCII(chunk.type) !== 'IHDR');

console.log('Extracting Scanlines');
const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
const scanlines = U8SSplit(decompressed_bytes, scanlineSize);
console.log(scanlines.length, 'Scanlines Extracted');

// const recompressed_bytes = compressIDATdata(decompressed_bytes);
// if (!recompressed_bytes) throw 'error: recompressed_bytes';
// const newIDAT = createIDAT(recompressed_bytes);
// const outpath = path + '__split00.png';
// console.log('Writing', outpath);
// await Bun.write(outpath, U8Concat([signatureBytes, ...topChunks.map((_) => _.bytes), newIDAT, ...botChunks.map((_) => _.bytes)]));

let test: Uint8Array[] = [];

// the individual files produced from this loop have issues

function checkScanlineFilterBytes(decompressedData: Uint8Array, scanlineSize: number) {
  // Iterate through each scanline
  for (let i = 0; i < decompressedData.length; i += scanlineSize) {
    const filterByte = decompressedData[i];

    // Check if the filter byte is within the valid range [0, 4]
    if (filterByte < 0 || filterByte > 4) {
      console.error(`Invalid filter byte at scanline ${i / scanlineSize}: ${filterByte}`);
      return false;
    }
  }

  return true;
}

function validateScanline(scanline: Uint8Array) {
  // Calculate bytes per pixel based on color type and bit depth
  let samplesPerPixel: number;
  switch (colorType) {
    case 0: // Grayscale
      samplesPerPixel = 1;
      break;
    case 2: // Truecolor (RGB)
      samplesPerPixel = 3;
      break;
    case 3: // Indexed-color (palette)
      samplesPerPixel = 1; // Uses a palette, so only 1 byte per pixel index
      break;
    case 4: // Grayscale with alpha
      samplesPerPixel = 2;
      break;
    case 6: // Truecolor with alpha (RGBA)
      samplesPerPixel = 4;
      break;
    default:
      throw new Error('Unknown color type.');
  }

  // Calculate bytes per pixel
  const bytesPerPixel = (bitDepth * samplesPerPixel) / 8;
  const scanlineSize = 1 + width * bytesPerPixel;

  // The scanline should start with a filter byte
  const filterByte = scanline[0];

  // Validate the filter byte (must be between 0 and 4)
  if (filterByte < 0 || filterByte > 4) {
    console.error(`Invalid filter byte: ${filterByte}`);
    return false;
  }

  // Validate the length of the scanline data (excluding the filter byte)
  const expectedDataLength = width * bytesPerPixel;
  const scanlineDataLength = scanline.length - 1; // Excluding the filter byte

  if (scanlineDataLength !== expectedDataLength) {
    console.error(`Incorrect scanline data length: expected ${expectedDataLength}, got ${scanlineDataLength}`);
    return false;
  }

  return true;
}

for (const scanline of scanlines) {
  validateScanline(scanline);
}

console.log('Group Scanlines and Create New PNGs');
const scanline_group_max_size = 500;
const scanline_groups = ArraySplit(scanlines, scanline_group_max_size);
for (let index = 0; index < scanline_groups.length; index++) {
  console.log('Group', index);
  const group = scanline_groups[index];
  const decompressed_data = U8SConcat(group);
  checkScanlineFilterBytes(decompressed_data, scanlineSize);
  test.push(decompressed_data);
  const compressed_data = compressIDATdata(decompressed_data);
  if (!compressed_data) throw 'error: compressed_data';
  console.log('compressed length:', compressed_data.byteLength);
  // Create the new IDAT
  const newIDAT = createIDATchunk(compressed_data);
  // Create the new IHDR
  const newIHDR = createIHDRchunk(width, group.length, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod);
  console.log(...U8SToHex(newIHDR));
  const outpath = path + '__split' + index.toString(10).padStart(2, '0') + '.png';
  console.log('Writing', outpath);
  await Bun.write(outpath, U8SConcat([signatureBytes, newIHDR, ...topChunksWithoutIHDR.map((_) => _.bytes), newIDAT, ...botChunks.map((_) => _.bytes)]));
}

// this new single file is perfect

const decompressed_total = U8SConcat(test);
console.log('Equal:', ArrayEquals(decompressed_total, decompressed_bytes));
const compressed_total = compressIDATdata(decompressed_total);
if (!compressed_total) throw 'error: compressed_total';
const newIDAT = createIDATchunk(compressed_total);
await Bun.write(path + '__split-test.png', U8SConcat([signatureBytes, IHDR.bytes, ...topChunksWithoutIHDR.map((_) => _.bytes), newIDAT, ...botChunks.map((_) => _.bytes)]));
