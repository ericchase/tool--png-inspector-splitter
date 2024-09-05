// const path = Bun.argv[2];
// const max_height_per_file = Bun.argv[3] === undefined ? 4096 : Number.parseInt(Bun.argv[3]);
// const buffer = await Bun.file(path).bytes();

import { ArraySplit } from './ericchase/Algorithm/Array/Array.js';
import { U8Concat, U8Split, U8Take, U8ToASCII, U8ToHex } from './ericchase/Algorithm/Array/Uint8Array.js';
import { Chunk, compressImageData, createIDATchunk, createIHDRchunk, decompressImageData, extractChunks, getScanlineSize, parseIHDRChunk } from './png.js';

export async function split(buffer: Uint8Array, height_per_file = 4096): Promise<Uint8Array[]> {
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

  console.log('Extract IHDR and Parse');
  const IHDR = topChunks.find((chunk) => U8ToASCII(chunk.type) === 'IHDR');
  if (!IHDR) throw 'error: IHDR';
  const { bitDepth, colorType, compressionMethod, filterMethod, height, interlaceMethod, width } = parseIHDRChunk(IHDR);

  // Combine IDATs, Decompress, Split Decompressed Data into Scanlines, Group Scanlines, Compress Groups, Create New Pngs
  const compressed_bytes = U8Concat(dataChunks.map((chunk) => chunk.data));
  console.log('Compressed Data Size:', compressed_bytes.byteLength);

  console.log('Decompressing Data');
  const decompressed_bytes = decompressImageData(compressed_bytes);
  if (!decompressed_bytes) throw 'error: decompressed_bytes';
  console.log('Decompressed Data Size:', decompressed_bytes.byteLength);

  // Get top chunks without IHDR
  const topChunksWithoutIHDR = topChunks.filter((chunk) => U8ToASCII(chunk.type) !== 'IHDR');

  console.log('Extracting Scanlines');
  const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
  const scanlines = U8Split(decompressed_bytes, scanlineSize);
  console.log(scanlines.length, 'Scanlines Extracted');

  // const recompressed_bytes = compressIDATdata(decompressed_bytes);
  // if (!recompressed_bytes) throw 'error: recompressed_bytes';
  // const newIDAT = createIDAT(recompressed_bytes);
  // const outpath = path + '__split00.png';
  // console.log('Writing', outpath);
  // await Bun.write(outpath, U8Concat([signatureBytes, ...topChunks.map((_) => _.bytes), newIDAT, ...botChunks.map((_) => _.bytes)]));

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

  // // Splitting scanlines based on max decompressed data size
  // const scanline_groups: Uint8Array[] = [];
  // let group: Uint8Array[] = [];
  // let groupsize = 0;
  // for (const scanline of scanlines) {
  //   validateScanline(scanline);
  //   if (groupsize + scanline.byteLength < max_height_per_file) {
  //     group.push(scanline);
  //     groupsize += scanline.byteLength;
  //   } else {
  //     scanline_groups.push(U8Concat(group));
  //     group = [];
  //     groupsize = 0;
  //   }
  // }
  // console.log('Group Count:', scanline_groups.length);

  console.log('Validating Scanlines');
  for (const scanline of scanlines) {
    validateScanline(scanline);
  }

  console.log('Creating New PNGs');
  // let test: Uint8Array[] = [];
  const scanline_groups = ArraySplit(scanlines, height_per_file);
  const png_out_buffers: Uint8Array[] = [];
  for (let index = 0; index < scanline_groups.length; index++) {
    console.log('PNG', index);
    const group = scanline_groups[index];
    const decompressed_data = U8Concat(group);
    checkScanlineFilterBytes(decompressed_data, scanlineSize);
    // test.push(decompressed_data);
    const compressed_data = compressImageData(decompressed_data);
    if (!compressed_data) throw 'error: compressed_data';
    console.log('compressed length:', compressed_data.byteLength);
    // Create the new IDAT
    const newIDAT = createIDATchunk(compressed_data);
    // Create the new IHDR
    const newIHDR = createIHDRchunk({ width, height: group.length, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod });
    console.log('new IHDR:', ...U8ToHex(newIHDR));
    png_out_buffers.push(U8Concat([signatureBytes, newIHDR, ...topChunksWithoutIHDR.map((_) => _.bytes), newIDAT, ...botChunks.map((_) => _.bytes)]));
    // const outpath = path + '__split' + index.toString(10).padStart(2, '0') + '.png';
    // console.log('Writing', outpath);
    // await Bun.write(outpath, U8Concat([signatureBytes, newIHDR, ...topChunksWithoutIHDR.map((_) => _.bytes), newIDAT, ...botChunks.map((_) => _.bytes)]));
  }

  // // this new single file is perfect

  // const decompressed_total = U8Concat(test);
  // console.log('Equal:', ArrayEquals(decompressed_total, decompressed_bytes));
  // const compressed_total = compressImageData(decompressed_total);
  // if (!compressed_total) throw 'error: compressed_total';
  // const newIDAT = createIDATchunk(compressed_total);
  // await Bun.write(path + '__split-test.png', U8Concat([signatureBytes, IHDR.bytes, ...topChunksWithoutIHDR.map((_) => _.bytes), newIDAT, ...botChunks.map((_) => _.bytes)]));

  return png_out_buffers;
}
