import pako from 'pako';
import { crcToBytes, initCRC } from './crc.js';

const encoder = new TextEncoder();

export function U8Concat(arrays: Uint8Array[]): Uint8Array {
  // Calculate the total length of all arrays combined
  let totalLength = 0;
  for (const array of arrays) {
    totalLength += array.length;
  }
  // Create a new Uint8Array with the total length
  const result = new Uint8Array(totalLength);
  // Copy each array into the result array
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

export function U8Take(bytes: Uint8Array, size: number): [Uint8Array, Uint8Array] {
  if (size < bytes.byteLength) {
    const chunkA = bytes.slice(0, size);
    const chunkB = bytes.slice(size);
    return [chunkA, chunkB];
  }
  return [bytes, new Uint8Array()];
}

export function U8TakeEnd(bytes: Uint8Array, size: number): [Uint8Array, Uint8Array] {
  if (size < bytes.byteLength) {
    const chunkA = bytes.slice(bytes.byteLength - size);
    const chunkB = bytes.slice(0, bytes.byteLength - size);
    return [chunkA, chunkB];
  }
  return [bytes, new Uint8Array()];
}

export function U8Split(bytes: Uint8Array, size: number): Uint8Array[] {
  let [part, rest] = U8Take(bytes, size);
  const parts = [part];
  while (rest.byteLength > 0) {
    [part, rest] = U8Take(rest, size);
    parts.push(part);
  }
  return parts;
}

export function U8Equals(bytes1: Uint8Array, bytes2: Uint8Array): boolean {
  console.log(bytes1.byteLength, bytes2.byteLength);
  if (bytes1.byteLength !== bytes2.byteLength) {
    return false;
  }
  for (let i = 0; i < bytes1.byteLength; i++) {
    if (bytes1[i] !== bytes2[i]) {
      console.log('different at:', i, bytes1[i], bytes2[i]);
      return false;
    }
  }
  return true;
}

export function U8FromInt(n: number) {
  const buffer = new Uint8Array(4); // Create a buffer for 4 bytes (32 bits)
  const view = new DataView(buffer.buffer);
  view.setUint32(0, n, false); // Store the number as a 32-bit unsigned integer (big-endian)
  return buffer;
}

export function extractNextChunk(bytes: Uint8Array) {
  const size = new DataView(bytes.buffer).getInt32(0);
  return U8Take(bytes, 8 + size + 4); // size,type,data,crc
}

export function extractChunks(bytes: Uint8Array) {
  const chunks: Uint8Array[] = [];
  let chunk = new Uint8Array();
  let rest = bytes;
  while (rest.byteLength > 0) {
    [chunk, rest] = extractNextChunk(rest);
    chunks.push(chunk);
  }
  return chunks;
}

export function analyzeChunk(bytes: Uint8Array) {
  const size = new DataView(bytes.buffer).getInt32(0);
  const type = bytes.slice(4, 8);
  const [_, rest] = U8Take(bytes, 8);
  const [data, crc] = U8Take(rest, size);
  return { data, size, type, crc };
}

export function getChunkCRC(chunk_type: Uint8Array, chunk_data: Uint8Array) {
  return initCRC(U8Concat([chunk_type, chunk_data]));
}

export function createIDAT(data: Uint8Array) {
  const size = U8FromInt(data.byteLength);
  const type = stringToBytes('IDAT');
  const crc = crcToBytes(getChunkCRC(type, data));
  return U8Concat([size, type, data, crc]);
}

export function createIHDR(width: number, height: number, bitDepth: number, colorType: number) {
  const ihdrData = new Uint8Array(13);

  // Width (4 bytes)
  ihdrData[0] = (width >> 24) & 0xff;
  ihdrData[1] = (width >> 16) & 0xff;
  ihdrData[2] = (width >> 8) & 0xff;
  ihdrData[3] = width & 0xff;

  // Height (4 bytes)
  ihdrData[4] = (height >> 24) & 0xff;
  ihdrData[5] = (height >> 16) & 0xff;
  ihdrData[6] = (height >> 8) & 0xff;
  ihdrData[7] = height & 0xff;

  // Bit Depth (1 byte)
  ihdrData[8] = bitDepth;

  // Color Type (1 byte)
  ihdrData[9] = colorType;

  // Compression Method (1 byte)
  ihdrData[10] = 0; // Standard compression

  // Filter Method (1 byte)
  ihdrData[11] = 0; // Adaptive filtering

  // Interlace Method (1 byte)
  ihdrData[12] = 0; // No interlace

  // Create IHDR chunk
  const ihdrLength = ihdrData.length;
  const ihdrType = new TextEncoder().encode('IHDR');
  const ihdrChunk = new Uint8Array(8 + ihdrLength + 4); // Length, Type, Data, CRC

  // Write length of IHDR data (4 bytes)
  ihdrChunk[0] = (ihdrLength >> 24) & 0xff;
  ihdrChunk[1] = (ihdrLength >> 16) & 0xff;
  ihdrChunk[2] = (ihdrLength >> 8) & 0xff;
  ihdrChunk[3] = ihdrLength & 0xff;

  // Write "IHDR" type
  ihdrChunk.set(ihdrType, 4);

  // Write IHDR data
  ihdrChunk.set(ihdrData, 8);

  // Calculate CRC for IHDR chunk (type + data)
  const crc = getChunkCRC(ihdrType, ihdrData); // Use your CRC calculation function
  ihdrChunk.set(new Uint8Array([(crc >> 24) & 0xff, (crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff]), 8 + ihdrLength);

  return ihdrChunk;
}

export function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0'));
}

export function decompressIDATdata(data: Uint8Array) {
  // Use pako to inflate the compressed data
  try {
    const decompressedData = pako.inflate(data);
    return decompressedData;
  } catch (error) {
    console.error('Error decompressing IDAT data:', error);
    return undefined;
  }
}

export function compressIDATdata(data: Uint8Array) {
  try {
    // Use pako to deflate (compress) the raw image data
    const compressedData = pako.deflate(data);

    // Example: If you just need the compressed data (for further handling)
    return compressedData;
  } catch (error) {
    console.error('Error compressing data:', error);
    return undefined;
  }
}

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

export function bytesToString(bytes: Uint8Array) {
  return String.fromCharCode(...bytes);
}
export function stringToBytes(string: string) {
  return encoder.encode(string);
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
