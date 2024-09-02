import { describe, expect, test } from 'bun:test';
import { U8STake, U8SToHex, Uint32ToHex } from './array.js';
import { analyzeChunk, Chunk, extractChunk, extractChunks, getChunkCRC, getScanlineSize, parseIHDRChunk } from './png.js';

const png1pixel = await Bun.file(__dirname + '/good_normal_one-black-pixel.png').bytes();

describe('good_normal_one-black-pixel.png', () => {
  const [signature, chunk_bytes] = U8STake(png1pixel, 8);
  const chunks = extractChunks(chunk_bytes);
  const [IHDR_bytes, rest0] = extractChunk(chunk_bytes);
  const [IDAT_bytes, rest1] = extractChunk(rest0);
  const [IEND_bytes] = extractChunk(rest1);
  const IHDR = new Chunk(IHDR_bytes);
  const IDAT = new Chunk(IDAT_bytes);
  const IEND = new Chunk(IEND_bytes);
  const { width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod } = parseIHDRChunk(IHDR);

  test('signature', () => {
    expect(U8SToHex(signature).join(' ')).toBe('89 50 4e 47 0d 0a 1a 0a');
  });

  describe('analyzeChunk', () => {
    test('IHDR', () => {
      const { crc, data, size, type } = analyzeChunk(IHDR_bytes);
      expect(size).toBe(13);
      expect(U8SToHex(type).join(' ')).toBe('49 48 44 52');
      expect(U8SToHex(data).join(' ')).toBe('00 00 00 01 00 00 00 01 08 00 00 00 00');
      expect(U8SToHex(crc).join(' ')).toBe('3a 7e 9b 55');
    });
    test('IDAT', () => {
      const { crc, data, size, type } = analyzeChunk(IDAT_bytes);
      expect(size).toBe(13);
      expect(U8SToHex(type).join(' ')).toBe('49 44 41 54');
      expect(U8SToHex(data).join(' ')).toBe('08 1d 01 02 00 fd ff 00 00 00 02 00 01');
      expect(U8SToHex(crc).join(' ')).toBe('cd e3 d1 2b');
    });
    test('IEND', () => {
      const { crc, data, size, type } = analyzeChunk(IEND_bytes);
      expect(size).toBe(0);
      expect(U8SToHex(type).join(' ')).toBe('49 45 4e 44');
      expect(U8SToHex(data).join(' ')).toBe('');
      expect(U8SToHex(crc).join(' ')).toBe('ae 42 60 82');
    });
  });

  describe('extractChunk', () => {
    test('IHDR', () => {
      expect(U8SToHex(IHDR_bytes).join(' ')).toBe('00 00 00 0d 49 48 44 52 00 00 00 01 00 00 00 01 08 00 00 00 00 3a 7e 9b 55');
    });
    test('IDAT', () => {
      expect(U8SToHex(IDAT_bytes).join(' ')).toBe('00 00 00 0d 49 44 41 54 08 1d 01 02 00 fd ff 00 00 00 02 00 01 cd e3 d1 2b');
    });
    test('IEND', () => {
      expect(U8SToHex(IEND_bytes).join(' ')).toBe('00 00 00 00 49 45 4e 44 ae 42 60 82');
    });
  });

  describe('extractChunks', () => {
    test('IHDR+', () => {
      expect(U8SToHex(chunks[0]).join(' ')).toBe('00 00 00 0d 49 48 44 52 00 00 00 01 00 00 00 01 08 00 00 00 00 3a 7e 9b 55');
    });
    test('IDAT+', () => {
      expect(U8SToHex(chunks[1]).join(' ')).toBe('00 00 00 0d 49 44 41 54 08 1d 01 02 00 fd ff 00 00 00 02 00 01 cd e3 d1 2b');
    });
    test('IEND+', () => {
      expect(U8SToHex(chunks[2]).join(' ')).toBe('00 00 00 00 49 45 4e 44 ae 42 60 82');
    });
  });

  describe('getChunkCRC', () => {
    test('IHDR', () => {
      expect(Uint32ToHex(getChunkCRC(IHDR.type, IHDR.data)).join(' ')).toBe('3a 7e 9b 55');
    });
    test('IDAT', () => {
      expect(Uint32ToHex(getChunkCRC(IDAT.type, IDAT.data)).join(' ')).toBe('cd e3 d1 2b');
    });
    test('IEND', () => {
      expect(Uint32ToHex(getChunkCRC(IEND.type, IEND.data)).join(' ')).toBe('ae 42 60 82');
    });
  });

  test('parseIHDRChunk', () => {
    expect(width).toBe(1);
    expect(height).toBe(1);
    expect(bitDepth).toBe(8);
    expect(colorType).toBe(0);
    expect(compressionMethod).toBe(0);
    expect(filterMethod).toBe(0);
    expect(interlaceMethod).toBe(0);
  });

  test('parseIHDRChunk', () => {
    const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
    expect(scanlineSize).toBe(2);
  });
});
