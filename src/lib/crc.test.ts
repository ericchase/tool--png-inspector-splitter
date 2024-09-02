import { describe, expect, test } from 'bun:test';

import { initCRC } from './crc.js';

const encoder = new TextEncoder();

describe(initCRC.name, () => {
  const cases = [
    // Trivial one.
    ['', 0x00000000], //
    // Source: https://rosettacode.org/wiki/CRC-32
    ['The quick brown fox jumps over the lazy dog', 0x414fa339],
    // Source: http://cryptomanager.com/tv.html
    ['various CRC algorithms input data', 0x9bd366ae],
    // Source: http://www.febooti.com/products/filetweak/members/hash-and-crc/test-vectors/
    ['Test vector from febooti.com', 0x0c877f61],
  ] as const;
  for (const [input, expected] of cases) {
    test(input, () => {
      expect(initCRC(encoder.encode(input))).toEqual(expected);
    });
  }
});
