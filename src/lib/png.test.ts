import { describe, expect, test } from 'bun:test';
import { Uint32ToHex } from './ericchase/Algorithm/Array/Uint32Array.js';
import { U8, U8Concat, U8Take, U8ToASCII, U8ToHex } from './ericchase/Algorithm/Array/Uint8Array.js';
import { analyzeChunk, Chunk, compressImageData, createIDATchunk, createIHDRchunk, decompressImageData, extractChunk, extractChunks, getChunkCRC, getScanlineSize, parseIHDRChunk } from './png.js';

const good_normal_one_black_pixel = await Bun.file(__dirname + '/good_normal_one_black_pixel.png').bytes();
const tall_1kx3k_red_green_blue = await Bun.file(__dirname + '/tall_1kx3k_red_green_blue.png').bytes();

describe('good_normal_one_black_pixel.png', () => {
  const [signature, chunk_bytes] = U8Take(good_normal_one_black_pixel, 8);
  const chunks = extractChunks(chunk_bytes);
  const [IHDR_bytes, rest0] = extractChunk(chunk_bytes);
  const [IDAT_bytes, rest1] = extractChunk(rest0);
  const [IEND_bytes] = extractChunk(rest1);
  const IHDR = new Chunk(IHDR_bytes);
  const IDAT = new Chunk(IDAT_bytes);
  const IEND = new Chunk(IEND_bytes);
  const { width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod } = parseIHDRChunk(IHDR);

  test('signature', () => {
    expect(U8ToHex(signature).join(' ')).toBe('89 50 4e 47 0d 0a 1a 0a');
  });

  describe('analyzeChunk', () => {
    test('IHDR', () => {
      const { crc, data, size, type } = analyzeChunk(IHDR_bytes);
      expect(size).toBe(13);
      expect(U8ToHex(type).join(' ')).toBe('49 48 44 52');
      expect(U8ToHex(data).join(' ')).toBe('00 00 00 01 00 00 00 01 08 00 00 00 00');
      expect(U8ToHex(crc).join(' ')).toBe('3a 7e 9b 55');
    });
    test('IDAT', () => {
      const { crc, data, size, type } = analyzeChunk(IDAT_bytes);
      expect(size).toBe(13);
      expect(U8ToHex(type).join(' ')).toBe('49 44 41 54');
      expect(U8ToHex(data).join(' ')).toBe('08 1d 01 02 00 fd ff 00 00 00 02 00 01');
      expect(U8ToHex(crc).join(' ')).toBe('cd e3 d1 2b');
    });
    test('IEND', () => {
      const { crc, data, size, type } = analyzeChunk(IEND_bytes);
      expect(size).toBe(0);
      expect(U8ToHex(type).join(' ')).toBe('49 45 4e 44');
      expect(U8ToHex(data).join(' ')).toBe('');
      expect(U8ToHex(crc).join(' ')).toBe('ae 42 60 82');
    });
  });

  test('compressIDATdata', () => {
    const decompressed_data = decompressImageData(IDAT.data);
    expect(decompressed_data).toBeDefined();
    if (decompressed_data) {
      const compressed_1 = compressImageData(decompressed_data);
      const compressed_2 = compressImageData(decompressed_data);
      expect(compressed_1).toBeDefined();
      expect(compressed_2).toBeDefined();
      if (compressed_1 && compressed_2) {
        expect(compressed_1).toEqual(compressed_2);
      }
    }
  });

  test('decompressIDATdata', () => {
    const decompressed_data = decompressImageData(IDAT.data);
    expect(decompressed_data).toBeDefined();
    expect(decompressed_data).toEqual(U8([0, 0]));
  });

  test('createIDATchunk', () => {
    const IDAT_new = createIDATchunk(IDAT.data);
    expect(IDAT.bytes).toEqual(IDAT_new);
  });

  test('createIHDRchunk', () => {
    const IHDR_new = createIHDRchunk({ width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod });
    expect(IHDR.bytes).toEqual(IHDR_new);
  });

  describe('extractChunk', () => {
    test('IHDR', () => {
      expect(U8ToHex(IHDR_bytes).join(' ')).toBe('00 00 00 0d 49 48 44 52 00 00 00 01 00 00 00 01 08 00 00 00 00 3a 7e 9b 55');
    });
    test('IDAT', () => {
      expect(U8ToHex(IDAT_bytes).join(' ')).toBe('00 00 00 0d 49 44 41 54 08 1d 01 02 00 fd ff 00 00 00 02 00 01 cd e3 d1 2b');
    });
    test('IEND', () => {
      expect(U8ToHex(IEND_bytes).join(' ')).toBe('00 00 00 00 49 45 4e 44 ae 42 60 82');
    });
  });

  describe('extractChunks', () => {
    test('IHDR+', () => {
      expect(U8ToHex(chunks[0]).join(' ')).toBe('00 00 00 0d 49 48 44 52 00 00 00 01 00 00 00 01 08 00 00 00 00 3a 7e 9b 55');
    });
    test('IDAT+', () => {
      expect(U8ToHex(chunks[1]).join(' ')).toBe('00 00 00 0d 49 44 41 54 08 1d 01 02 00 fd ff 00 00 00 02 00 01 cd e3 d1 2b');
    });
    test('IEND+', () => {
      expect(U8ToHex(chunks[2]).join(' ')).toBe('00 00 00 00 49 45 4e 44 ae 42 60 82');
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

  test('scanlineSize', () => {
    const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
    expect(scanlineSize).toBe(2);
  });
});

describe('tall_1kx3k_red_green_blue.png', () => {
  const [signature, chunk_bytes] = U8Take(tall_1kx3k_red_green_blue, 8);
  const chunks = extractChunks(chunk_bytes);
  const IHDR = new Chunk(chunks[0]);
  const IDATs = [new Chunk(chunks[1]), new Chunk(chunks[2])];
  const IEND = new Chunk(chunks[3]);
  const { width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod } = parseIHDRChunk(IHDR);
  const decompressed_data = decompressImageData(U8Concat(IDATs.map((_) => _.data)));

  test('signature', () => {
    expect(U8ToHex(signature).join(' ')).toBe('89 50 4e 47 0d 0a 1a 0a');
  });

  describe('analyzeChunk', () => {
    test('IHDR', () => {
      const { crc, data, size, type } = analyzeChunk(IHDR.bytes);
      expect(size).toBe(13);
      expect(U8ToASCII(type)).toBe('IHDR');
      expect(U8ToHex(data).join(' ')).toBe('00 00 03 e8 00 00 0b b8 08 02 00 00 00');
      expect(U8ToHex(crc).join(' ')).toBe('fd a0 05 23');
    });
    test('IDAT0', () => {
      const { crc, data, size, type } = analyzeChunk(IDATs[0].bytes);
      expect(size).toBe(8192);
      expect(U8ToASCII(type)).toBe('IDAT');
      // expect(U8ToHex(data).join(' ')).toBe('08 1d 01 02 00 fd ff 00 00 00 02 00 01');
      expect(U8ToHex(crc).join(' ')).toBe('5b 4b 5c 00');
    });
    test('IDAT1', () => {
      const { crc, data, size, type } = analyzeChunk(IDATs[1].bytes);
      expect(size).toBe(4716);
      expect(U8ToASCII(type)).toBe('IDAT');
      // expect(U8ToHex(data).join(' ')).toBe('08 1d 01 02 00 fd ff 00 00 00 02 00 01');
      expect(U8ToHex(crc).join(' ')).toBe('eb 16 f2 2c');
    });
    test('IEND', () => {
      const { crc, data, size, type } = analyzeChunk(IEND.bytes);
      expect(size).toBe(0);
      expect(U8ToASCII(type)).toBe('IEND');
      expect(U8ToHex(data).join(' ')).toBe('');
      expect(U8ToHex(crc).join(' ')).toBe('ae 42 60 82');
    });
  });

  test('compressIDAT0data', () => {
    if (decompressed_data) {
      const compressed_1 = compressImageData(decompressed_data);
      const compressed_2 = compressImageData(decompressed_data);
      expect(compressed_1).toBeDefined();
      expect(compressed_2).toBeDefined();
      if (compressed_1 && compressed_2) {
        expect(compressed_1).toEqual(compressed_2);
      }
    }
  });

  test('decompressIDATdata', () => {
    expect(decompressed_data).toBeDefined();
    expect(decompressed_data?.byteLength ?? 0).toBe(9003000);
  });

  test('createIDA0chunk', () => {
    const new_IDAT_bytes = createIDATchunk(IDATs[0].data);
    expect(new_IDAT_bytes).toEqual(IDATs[0].bytes);
  });
  test('createIDAT1chunk', () => {
    const new_IDAT_bytes = createIDATchunk(IDATs[1].data);
    expect(new_IDAT_bytes).toEqual(IDATs[1].bytes);
  });

  test('createIHDRchunk', () => {
    const IHDR_new = createIHDRchunk({ width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod });
    expect(IHDR.bytes).toEqual(IHDR_new);
  });

  describe('getChunkCRC', () => {
    test('IHDR', () => {
      expect(Uint32ToHex(getChunkCRC(IHDR.type, IHDR.data)).join(' ')).toBe('fd a0 05 23');
    });
    test('IDAT', () => {
      expect(Uint32ToHex(getChunkCRC(IDATs[0].type, IDATs[0].data)).join(' ')).toBe('5b 4b 5c 00');
      expect(Uint32ToHex(getChunkCRC(IDATs[1].type, IDATs[1].data)).join(' ')).toBe('eb 16 f2 2c');
    });
    test('IEND', () => {
      expect(Uint32ToHex(getChunkCRC(IEND.type, IEND.data)).join(' ')).toBe('ae 42 60 82');
    });
  });

  test('parseIHDRChunk', () => {
    expect(width).toBe(1000);
    expect(height).toBe(3000);
    expect(bitDepth).toBe(8);
    expect(colorType).toBe(2);
    expect(compressionMethod).toBe(0);
    expect(filterMethod).toBe(0);
    expect(interlaceMethod).toBe(0);
  });

  test('scanlineSize', () => {
    const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
    expect(scanlineSize).toBe(3001);
  });
});
