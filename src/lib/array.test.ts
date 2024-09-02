import { describe, expect, test } from 'bun:test';
import { ArrayEquals, ArraySplit, getBytes, U8S, U8SClamped, U8SConcat, U8SCopy, U8SFromString, U8SFromUint32, U8SSplit, U8STake, U8STakeEnd, U8SToASCII, U8SToDecimal, U8SToHex } from './array.js';

// Array Functions

describe(ArrayEquals.name, () => {
  const cases = [
    U8S([]), //
    U8S([1, 2]),
    U8S([1, 2, 3, 4]),
    U8SClamped([]), //
    U8SClamped([1, 2]),
    U8SClamped([1, 2, 3, 4]),
    [],
    [1, 2],
    [1, 2, 3, 4],
    ['a'],
    ['a', 'b'],
    ['a', 'b', 'c'],
  ] as const;
  for (const input of cases) {
    test(input.toString(), () => {
      expect(ArrayEquals(input, input)).toBe(true);
    });
  }
});

describe(ArraySplit.name, () => {
  test('[]', () => {
    expect(ArraySplit([], -1)).toEqual([[]]);
    expect(ArraySplit([], 0)).toEqual([[]]);
    expect(ArraySplit([], 1)).toEqual([[]]);
  });
  test('[1]', () => {
    expect(ArraySplit([1], -1)).toEqual([[1]]);
    expect(ArraySplit([1], 0)).toEqual([[1]]);
    expect(ArraySplit([1], 1)).toEqual([[1]]);
  });
  test('[1, 2]', () => {
    expect(ArraySplit([1, 2], -1)).toEqual([[1, 2]]);
    expect(ArraySplit([1, 2], 0)).toEqual([[1, 2]]);
    expect(ArraySplit([1, 2], 1)).toEqual([[1], [2]]);
  });
  test('[1, 2, 3] split 1', () => {
    expect(ArraySplit([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });
  test('[1, 2] split 2', () => {
    expect(ArraySplit([1, 2], 2)).toEqual([[1, 2]]);
  });
  test('[1, 2, 3, 4] split 2', () => {
    expect(ArraySplit([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
  test('[1, 2, 3, 4, 5, 6] split 2', () => {
    expect(ArraySplit([1, 2, 3, 4, 5, 6], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });
  test('[1, 2, 3, 4] split 6', () => {
    expect(ArraySplit([1, 2, 3, 4], 6)).toEqual([[1, 2, 3, 4]]);
  });
  test('[] split 1', () => {
    expect(ArraySplit([], 1)).toEqual([[]]);
  });
});

// Uint8Array Functions

describe(U8SConcat.name, () => {
  const cases = [
    [[U8S([])], U8S([])],
    [[U8S([1, 2])], U8S([1, 2])],
    [[U8S([1, 2]), U8S([3, 4])], U8S([1, 2, 3, 4])],
  ] as const;
  for (const [input, expected] of cases) {
    test(U8SToHex(expected).join(' '), () => {
      expect(U8SConcat(input)).toEqual(expected);
    });
  }
});

describe(U8SCopy.name, () => {
  function fn(bytes: Uint8Array, size: number, offset: number, expected: Uint8Array) {
    test(`[${U8SToHex(bytes).toString()}] ${size}:${offset}`, () => {
      expect(U8SCopy(bytes, size, offset)).toEqual(expected);
    });
  }
  fn(U8S(), 4, 0, U8S());
  fn(U8S(), 4, 4, U8S());
  fn(U8S([1, 2, 3, 4, 5, 6, 7, 8]), 4, 0, U8S([1, 2, 3, 4]));
  fn(U8S([1, 2, 3, 4, 5, 6, 7, 8]), 4, 4, U8S([5, 6, 7, 8]));
  fn(U8S([1, 2, 3, 4, 5, 6, 7, 8]), 4, 8, U8S());
});

describe(U8SSplit.name, () => {
  test('[]', () => {
    expect(U8SSplit(U8S(), -1)).toEqual([U8S()]);
    expect(U8SSplit(U8S(), 0)).toEqual([U8S()]);
    expect(U8SSplit(U8S(), 1)).toEqual([U8S()]);
  });
  test('[1]', () => {
    expect(U8SSplit(U8S([1]), -1)).toEqual([U8S([1])]);
    expect(U8SSplit(U8S([1]), 0)).toEqual([U8S([1])]);
    expect(U8SSplit(U8S([1]), 1)).toEqual([U8S([1])]);
  });
  test('[1, 2]', () => {
    expect(U8SSplit(U8S([1, 2]), -1)).toEqual([U8S([1, 2])]);
    expect(U8SSplit(U8S([1, 2]), 0)).toEqual([U8S([1, 2])]);
    expect(U8SSplit(U8S([1, 2]), 1)).toEqual([U8S([1]), U8S([2])]);
  });
  test('[1, 2, 3] split 1', () => {
    expect(U8SSplit(U8S([1, 2, 3]), 1)).toEqual([U8S([1]), U8S([2]), U8S([3])]);
  });
  test('[1, 2] split 2', () => {
    expect(U8SSplit(U8S([1, 2]), 2)).toEqual([U8S([1, 2])]);
  });
  test('[1, 2, 3, 4] split 2', () => {
    expect(U8SSplit(U8S([1, 2, 3, 4]), 2)).toEqual([U8S([1, 2]), U8S([3, 4])]);
  });
  test('[1, 2, 3, 4, 5, 6] split 2', () => {
    expect(U8SSplit(U8S([1, 2, 3, 4, 5, 6]), 2)).toEqual([U8S([1, 2]), U8S([3, 4]), U8S([5, 6])]);
  });
  test('[1, 2, 3, 4] split 6', () => {
    expect(U8SSplit(U8S([1, 2, 3, 4]), 6)).toEqual([U8S([1, 2, 3, 4])]);
  });
  test('[] split 1', () => {
    expect(U8SSplit(U8S(), 1)).toEqual([U8S()]);
  });
  test('Underlying Buffers are Different', () => {
    const original = U8S([1, 2, 3, 4, 5, 6]);
    const u8s = U8SSplit(original, 2);
    for (const u8 of u8s) {
      expect(u8.buffer).not.toBe(original.buffer);
    }
  });
});

describe(U8STake.name, () => {
  test('[]', () => {
    expect(U8STake(U8S(), -1)).toEqual([U8S(), U8S()]);
    expect(U8STake(U8S(), 0)).toEqual([U8S(), U8S()]);
    expect(U8STake(U8S(), 1)).toEqual([U8S(), U8S()]);
  });
  test('[1]', () => {
    expect(U8STake(U8S([1]), -1)).toEqual([U8S(), U8S([1])]);
    expect(U8STake(U8S([1]), 0)).toEqual([U8S(), U8S([1])]);
    expect(U8STake(U8S([1]), 1)).toEqual([U8S([1]), U8S()]);
  });
  test('[1, 2]', () => {
    expect(U8STake(U8S([1, 2]), -1)).toEqual([U8S(), U8S([1, 2])]);
    expect(U8STake(U8S([1, 2]), 0)).toEqual([U8S(), U8S([1, 2])]);
    expect(U8STake(U8S([1, 2]), 1)).toEqual([U8S([1]), U8S([2])]);
  });
  test('[1, 2] take 2', () => {
    expect(U8STake(U8S([1, 2]), 2)).toEqual([U8S([1, 2]), U8S()]);
  });
  test('[1, 2, 3, 4] take 2', () => {
    expect(U8STake(U8S([1, 2, 3, 4]), 2)).toEqual([U8S([1, 2]), U8S([3, 4])]);
  });
  test('[1, 2, 3, 4] take 6', () => {
    expect(U8STake(U8S([1, 2, 3, 4]), 6)).toEqual([U8S([1, 2, 3, 4]), U8S()]);
  });
});

describe(U8STakeEnd.name, () => {
  test('[]', () => {
    expect(U8STakeEnd(U8S(), -1)).toEqual([U8S(), U8S()]);
    expect(U8STakeEnd(U8S(), 0)).toEqual([U8S(), U8S()]);
    expect(U8STakeEnd(U8S(), 1)).toEqual([U8S(), U8S()]);
  });
  test('[1]', () => {
    expect(U8STakeEnd(U8S([1]), -1)).toEqual([U8S(), U8S([1])]);
    expect(U8STakeEnd(U8S([1]), 0)).toEqual([U8S(), U8S([1])]);
    expect(U8STakeEnd(U8S([1]), 1)).toEqual([U8S([1]), U8S()]);
  });
  test('[1, 2]', () => {
    expect(U8STakeEnd(U8S([1, 2]), -1)).toEqual([U8S(), U8S([1, 2])]);
    expect(U8STakeEnd(U8S([1, 2]), 0)).toEqual([U8S(), U8S([1, 2])]);
    expect(U8STakeEnd(U8S([1, 2]), 1)).toEqual([U8S([2]), U8S([1])]);
  });
  test('[1, 2] take 2', () => {
    expect(U8STakeEnd(U8S([1, 2]), 2)).toEqual([U8S([1, 2]), U8S()]);
  });
  test('[1, 2, 3, 4] take 2', () => {
    expect(U8STakeEnd(U8S([1, 2, 3, 4]), 2)).toEqual([U8S([3, 4]), U8S([1, 2])]);
  });
  test('[1, 2, 3, 4] take 6', () => {
    expect(U8STakeEnd(U8S([1, 2, 3, 4]), 6)).toEqual([U8S([1, 2, 3, 4]), U8S()]);
  });
  test('[] take 1', () => {
    expect(U8STakeEnd(U8S(), 1)).toEqual([U8S(), U8S()]);
  });
});

// Conversion Utility Functions

describe(getBytes.name, () => {
  test('[1, 2, 3, 4]', () => {
    expect([...getBytes(U8S([1, 2, 3, 4]).buffer)]).toEqual([1, 2, 3, 4]);
  });
  test('[0x12345678]', () => {
    // Does not adjust for endianness
    expect([...getBytes(Uint32Array.from([0x12345678]).buffer)]).toEqual([0x78, 0x56, 0x34, 0x12]);
  });
  test('[0x78563412]', () => {
    expect([...getBytes(Uint32Array.from([0x78563412]).buffer)]).toEqual([0x12, 0x34, 0x56, 0x78]);
  });
});

describe(U8S.name, () => {
  test('[]', () => {
    expect(U8S()).toEqual(new Uint8Array(0));
    expect(U8S([])).toEqual(new Uint8Array(0));
  });
  test('[0]', () => {
    expect(U8S([0])).toEqual(new Uint8Array([0]));
  });
  test('[0, 0]', () => {
    expect(U8S([0, 0])).toEqual(new Uint8Array([0, 0]));
  });
  test('[1, 2, 3]', () => {
    expect(U8S([1, 2, 3])).toEqual(new Uint8Array([1, 2, 3]));
  });
  test('[200, 250, 300]', () => {
    expect(U8S([200, 250, 300])).toEqual(new Uint8Array([200, 250, 44]));
  });
  test('[0x0f, 0xff0f, 0xffff0f, 0xffffff0f]', () => {
    expect(U8S([0x0f, 0xff0f, 0xffff0f, 0xffffff0f])).toEqual(new Uint8Array([0x0f, 0x0f, 0x0f, 0x0f]));
  });
  test('[0xff, 0xffff, 0xffffff, 0xffffffff]', () => {
    expect(U8S([0xff, 0xffff, 0xffffff, 0xffffffff])).toEqual(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  });
  test('U8S(U8S())', () => {
    expect(U8S(U8S([0x0f, 0xff0f, 0xffff0f, 0xffffff0f]))).toEqual(new Uint8Array([0x0f, 0x0f, 0x0f, 0x0f]));
    expect(U8S(U8S([0xff, 0xffff, 0xffffff, 0xffffffff]))).toEqual(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  });
});

describe(U8SClamped.name, () => {
  test('[]', () => {
    expect(U8SClamped()).toEqual(new Uint8Array(0));
    expect(U8SClamped([])).toEqual(new Uint8Array(0));
  });
  test('[0]', () => {
    expect(U8SClamped([0])).toEqual(new Uint8Array([0]));
  });
  test('[0, 0]', () => {
    expect(U8SClamped([0, 0])).toEqual(new Uint8Array([0, 0]));
  });
  test('[1, 2, 3]', () => {
    expect(U8SClamped([1, 2, 3])).toEqual(new Uint8Array([1, 2, 3]));
  });
  test('[200, 250, 300]', () => {
    expect(U8SClamped([200, 250, 300])).toEqual(new Uint8Array([200, 250, 255]));
  });
  test('[0x0f, 0xff0f, 0xffff0f, 0xffffff0f]', () => {
    expect(U8SClamped([0x0f, 0xff0f, 0xffff0f, 0xffffff0f])).toEqual(new Uint8Array([0x0f, 0xff, 0xff, 0xff]));
  });
  test('[0xff, 0xffff, 0xffffff, 0xffffffff]', () => {
    expect(U8SClamped([0xff, 0xffff, 0xffffff, 0xffffffff])).toEqual(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  });
  test('U8SClamped(U8SClamped())', () => {
    expect(U8SClamped(U8SClamped([0x0f, 0xff0f, 0xffff0f, 0xffffff0f]))).toEqual(new Uint8Array([0x0f, 0xff, 0xff, 0xff]));
    expect(U8SClamped(U8SClamped([0xff, 0xffff, 0xffffff, 0xffffffff]))).toEqual(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  });
});

describe(U8SFromUint32.name, () => {
  const cases = [
    [0x00000000, U8S([0x00, 0x00, 0x00, 0x00])],
    [0x414fa339, U8S([0x41, 0x4f, 0xa3, 0x39])],
    [0x9bd366ae, U8S([0x9b, 0xd3, 0x66, 0xae])],
    [0x0c877f61, U8S([0x0c, 0x87, 0x7f, 0x61])],
  ] as const;
  for (const [input, expected] of cases) {
    test('0x' + input.toString(16).padStart(8, '0'), () => {
      expect(U8SFromUint32(input)).toEqual(expected);
    });
  }
});

describe(U8SFromString.name, () => {
  const cases = [
    ['123', U8S([49, 50, 51])],
    ['abc', U8S([97, 98, 99])],
    ['ABC', U8S([65, 66, 67])],
    ['IDAT', U8S([0x49, 0x44, 0x41, 0x54])],
  ] as const;
  for (const [input, expected] of cases) {
    test(input, () => {
      expect(U8SFromString(input)).toEqual(expected);
    });
  }
});

describe(U8SToDecimal.name, () => {
  const cases = [
    [U8S([49, 50, 51]), '123'],
    [U8S([97, 98, 99]), 'abc'],
    [U8S([65, 66, 67]), 'ABC'],
    [U8S([0x49, 0x44, 0x41, 0x54]), 'IDAT'],
  ] as const;
  for (const [input, expected] of cases) {
    test(expected, () => {
      expect(U8SToASCII(input)).toEqual(expected);
    });
  }
});

describe(U8SToDecimal.name, () => {
  const cases = [
    [0x00000000, '0 0 0 0'],
    [0x414fa339, '65 79 163 57'],
    [0x9bd366ae, '155 211 102 174'],
    [0x0c877f61, '12 135 127 97'],
  ] as const;
  for (const [input, expected] of cases) {
    test(expected, () => {
      expect(U8SToDecimal(U8SFromUint32(input)).join(' ')).toEqual(expected);
    });
  }
});

describe(U8SToHex.name, () => {
  const cases = [
    [0x00000000, '00 00 00 00'],
    [0x414fa339, '41 4f a3 39'],
    [0x9bd366ae, '9b d3 66 ae'],
    [0x0c877f61, '0c 87 7f 61'],
  ] as const;
  for (const [input, expected] of cases) {
    test(expected, () => {
      expect(U8SToHex(U8SFromUint32(input)).join(' ')).toEqual(expected);
    });
  }
});
