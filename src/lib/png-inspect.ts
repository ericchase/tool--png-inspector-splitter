import { U8Concat, U8FromUint32, U8Split, U8Take, U8ToASCII, U8ToHex } from './ericchase/Algorithm/Array/Uint8Array.js';
import { CRC } from './ericchase/Algorithm/Math/CRC.js';
import { Chunk, analyzeChunk, decompressImageData, extractChunks, getScanlineSize, parseIHDRChunk } from './png.js';

// const [, , path] = Bun.argv;
// const buffer = await Bun.file(path).bytes();

export function PNGInspect(png_buffer: Uint8Array, output: (data?: any[]) => void) {
  const [chunkSignature, rest] = U8Take(png_buffer, 8);
  const chunks = extractChunks(rest);

  output(['Signature']);
  output([...U8ToHex(chunkSignature)]);
  output();

  let idat_datas: Uint8Array[] = [];
  let total_idat_size = 0;
  let IHDR: Chunk | undefined = undefined;

  for (const chunk of chunks) {
    const { data, size, type, crc } = analyzeChunk(chunk);
    if (U8ToASCII(type) === 'IDAT') {
      idat_datas.push(data);
      total_idat_size += size;
    }
    output(['Chunk']);
    if (U8ToASCII(type) === 'IHDR') {
      IHDR = new Chunk(chunk);
      output([...U8ToHex(chunk)]);
    }
    output(['size:', size]);
    output(['type:', U8ToASCII(type)]);
    // output(['data:', ...toHex(data)]);
    output(['crc:', ...U8ToHex(crc)]);
    output(['computed crc:', ...U8ToHex(U8FromUint32(CRC.Init(U8Concat([type, data]))))]);
    output();
  }

  output(['Total IDAT Chunks:', idat_datas.length]);
  output(['Total IDAT Compressed Size:', total_idat_size]);

  // Combine IDATs, Decompress, Split Decompressed Data into Scanlines, Group Scanlines, Compress Groups, Create New Pngs
  const compressed_bytes = U8Concat(idat_datas);
  output(['Compressed Data Size:', compressed_bytes.byteLength]);

  output(['Decompressing Data']);
  const decompressed_bytes = decompressImageData(compressed_bytes);
  if (!decompressed_bytes) throw 'error: decompressed_bytes';
  output(['Decompressed Data Size:', decompressed_bytes.byteLength]);
  // output(['Decompressed Bytes:', decompressed_bytes]);
  output();

  if (!IHDR) throw 'error: IHDR';
  const { bitDepth, colorType, compressionMethod, filterMethod, height, interlaceMethod, width } = parseIHDRChunk(IHDR);

  output(['Width:', width]);
  output(['Height:', height]);
  output(['BitDepth:', bitDepth]);
  output(['ColorType:', colorType]);
  output(['CompressionMethod:', compressionMethod]);
  output(['FilterMethod:', filterMethod]);
  output(['InterlaceMethod:', interlaceMethod]);
  output();

  output(['Extracting Scanlines']);
  const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
  output(['Scanline Size:', scanlineSize]);
  const scanlines = U8Split(decompressed_bytes, scanlineSize);
  output([scanlines.length, 'Scanlines Extracted']);
}
