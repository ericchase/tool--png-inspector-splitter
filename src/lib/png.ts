import pako from 'pako';
import { U8SConcat, U8SFromString, U8SFromUint32, U8STake, Uint32ToHex } from './array.js';
import { initCRC } from './crc.js';

export class Chunk {
  readonly crc: Uint8Array;
  readonly data: Uint8Array;
  readonly size: number;
  readonly type: Uint8Array;
  constructor(public readonly bytes: Uint8Array) {
    const { crc, data, size, type } = analyzeChunk(bytes);
    this.crc = crc;
    this.data = data;
    this.size = size;
    this.type = type;
  }
}

export function analyzeChunk(bytes: Uint8Array) {
  const size = new DataView(bytes.buffer).getInt32(0);
  const type = bytes.slice(4, 8);
  const [_, rest] = U8STake(bytes, 8);
  const [data, crc] = U8STake(rest, size);
  return { data, size, type, crc };
}

export function compressImageData(data: Uint8Array) {
  try {
    return pako.deflate(data);
  } catch (error) {
    console.error('Error compressing IDAT data:', error);
    return undefined;
  }
}

export function createIDATchunk(data: Uint8Array) {
  const size = U8SFromUint32(data.byteLength);
  const type = U8SFromString('IDAT');
  const crc = U8SFromUint32(getChunkCRC(type, data));
  return U8SConcat([size, type, data, crc]);
}

export function createIHDRchunk({ width, height, bitDepth, colorType, compressionMethod = 0, filterMethod = 0, interlaceMethod = 0 }: { width: number; height: number; bitDepth: number; colorType: number; compressionMethod?: number; filterMethod?: number; interlaceMethod?: number }) {
  // Validate input values
  if (bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4 && bitDepth !== 8 && bitDepth !== 16) {
    throw new Error('Invalid bit depth. Must be one of 1, 2, 4, 8, or 16.');
  }
  if (![0, 2, 3, 4, 6].includes(colorType)) {
    throw new Error('Invalid color type. Must be one of 0, 2, 3, 4, or 6.');
  }
  if (compressionMethod !== 0) {
    throw new Error('Invalid compression method. Only method 0 is supported.');
  }
  if (filterMethod !== 0) {
    throw new Error('Invalid filter method. Only method 0 is supported.');
  }
  if (interlaceMethod !== 0 && interlaceMethod !== 1) {
    throw new Error('Invalid interlace method. Must be either 0 (no interlace) or 1 (Adam7).');
  }

  // Create the IHDR data array
  const ihdrData = new Uint8Array(13);

  // Write width (4 bytes, big-endian)
  ihdrData[0] = (width >> 24) & 0xff;
  ihdrData[1] = (width >> 16) & 0xff;
  ihdrData[2] = (width >> 8) & 0xff;
  ihdrData[3] = width & 0xff;

  // Write height (4 bytes, big-endian)
  ihdrData[4] = (height >> 24) & 0xff;
  ihdrData[5] = (height >> 16) & 0xff;
  ihdrData[6] = (height >> 8) & 0xff;
  ihdrData[7] = height & 0xff;

  // Write bit depth (1 byte)
  ihdrData[8] = bitDepth;

  // Write color type (1 byte)
  ihdrData[9] = colorType;

  // Write compression method (1 byte, must be 0)
  ihdrData[10] = compressionMethod;

  // Write filter method (1 byte, must be 0)
  ihdrData[11] = filterMethod;

  // Write interlace method (1 byte, either 0 or 1)
  ihdrData[12] = interlaceMethod;

  // Create the IHDR chunk
  const ihdrLength = ihdrData.length;
  const ihdrType = new TextEncoder().encode('IHDR');
  const ihdrChunk = new Uint8Array(8 + ihdrLength + 4); // Length, Type, Data, CRC

  // Write length of IHDR data (4 bytes, big-endian)
  ihdrChunk[0] = (ihdrLength >> 24) & 0xff;
  ihdrChunk[1] = (ihdrLength >> 16) & 0xff;
  ihdrChunk[2] = (ihdrLength >> 8) & 0xff;
  ihdrChunk[3] = ihdrLength & 0xff;

  // Write "IHDR" type (4 bytes)
  ihdrChunk.set(ihdrType, 4);

  // Write IHDR data (13 bytes)
  ihdrChunk.set(ihdrData, 8);

  // Calculate CRC for IHDR chunk type and data
  const crc = getChunkCRC(ihdrType, ihdrData); // Use your CRC calculation function
  ihdrChunk.set(new Uint8Array([(crc >> 24) & 0xff, (crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff]), 8 + ihdrLength);

  return ihdrChunk;
}

export function decompressImageData(data: Uint8Array) {
  try {
    return pako.inflate(data);
  } catch (error) {
    console.error('Error decompressing IDAT data:', error);
    return undefined;
  }
}

export function extractChunk(bytes: Uint8Array) {
  const size = new DataView(bytes.buffer).getInt32(0);
  return U8STake(bytes, 8 + size + 4); // size,type,data,crc
}

export function extractChunks(bytes: Uint8Array) {
  let [chunk, rest] = extractChunk(bytes);
  const chunks = [chunk];
  while (rest.byteLength > 0) {
    [chunk, rest] = extractChunk(rest);
    chunks.push(chunk);
  }
  return chunks;
}

export function getChunkCRC(type_bytes: Uint8Array, data_bytes: Uint8Array) {
  return initCRC(U8SConcat([type_bytes, data_bytes]));
}

export function getChunkCRCHex(type_bytes: Uint8Array, data_bytes: Uint8Array) {
  return Uint32ToHex(initCRC(U8SConcat([type_bytes, data_bytes])));
}

export function getScanlineSize({ width, bitDepth, colorType }: { width: number; bitDepth: number; colorType: number }) {
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

  return scanlineSize;
}

export function parseIHDRChunk(IHDR: Chunk) {
  const data = IHDR.data;

  if (data.length !== 13) {
    throw new Error('Invalid IHDR chunk length. Expected 13 bytes.');
  }

  // Extract width (4 bytes)
  const width = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];

  // Extract height (4 bytes)
  const height = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];

  // Extract bit depth (1 byte)
  const bitDepth = data[8];

  // Extract color type (1 byte)
  const colorType = data[9];

  // Extract compression method (1 byte)
  const compressionMethod = data[10];

  // Extract filter method (1 byte)
  const filterMethod = data[11];

  // Extract interlace method (1 byte)
  const interlaceMethod = data[12];

  return {
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    height,
    interlaceMethod,
    width,
  };
}
