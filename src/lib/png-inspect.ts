import { U8SConcat, U8SFromUint32, U8SSplit, U8STake, U8SToASCII, U8SToHex } from './array.js';
import { initCRC } from './crc.js';
import { Chunk, analyzeChunk, decompressImageData, extractChunks, getScanlineSize, parseIHDRChunk } from './png.js';

// const [, , path] = Bun.argv;
// const buffer = await Bun.file(path).bytes();

export function inspect(png_buffer: Uint8Array) {
  const [chunkSignature, rest] = U8STake(png_buffer, 8);
  const chunks = extractChunks(rest);

  console.log('Signature');
  console.log(...U8SToHex(chunkSignature));
  console.log();

  let idat_datas: Uint8Array[] = [];
  let total_idat_size = 0;
  let IHDR: Chunk | undefined = undefined;

  for (const chunk of chunks) {
    const { data, size, type, crc } = analyzeChunk(chunk);
    if (U8SToASCII(type) === 'IDAT') {
      idat_datas.push(data);
      total_idat_size += size;
    }
    console.log('Chunk');
    if (U8SToASCII(type) === 'IHDR') {
      IHDR = new Chunk(chunk);
      console.log(...U8SToHex(chunk));
    }
    console.log('size:', size);
    console.log('type:', U8SToASCII(type));
    // console.log('data:', ...toHex(data));
    console.log('crc:', ...U8SToHex(crc));
    console.log('computed crc:', ...U8SToHex(U8SFromUint32(initCRC(U8SConcat([type, data])))));
    console.log();
  }

  console.log('Total IDAT Chunks:', idat_datas.length);
  console.log('Total IDAT Compressed Size:', total_idat_size);

  // Combine IDATs, Decompress, Split Decompressed Data into Scanlines, Group Scanlines, Compress Groups, Create New Pngs
  const compressed_bytes = U8SConcat(idat_datas);
  console.log('Compressed Data Size:', compressed_bytes.byteLength);

  console.log('Decompressing Data');
  const decompressed_bytes = decompressImageData(compressed_bytes);
  if (!decompressed_bytes) throw 'error: decompressed_bytes';
  console.log('Decompressed Data Size:', decompressed_bytes.byteLength);
  // console.log('Decompressed Bytes:', decompressed_bytes);
  console.log();

  if (!IHDR) throw 'error: IHDR';
  const { bitDepth, colorType, compressionMethod, filterMethod, height, interlaceMethod, width } = parseIHDRChunk(IHDR);

  console.log('Width:', width);
  console.log('Height:', height);
  console.log('BitDepth:', bitDepth);
  console.log('ColorType:', colorType);
  console.log('CompressionMethod:', compressionMethod);
  console.log('FilterMethod:', filterMethod);
  console.log('InterlaceMethod:', interlaceMethod);
  console.log();

  console.log('Extracting Scanlines');
  const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
  console.log('Scanline Size:', scanlineSize);
  const scanlines = U8SSplit(decompressed_bytes, scanlineSize);
  console.log(scanlines.length, 'Scanlines Extracted');
}
