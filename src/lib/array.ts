// Array Functions

export function ArrayEquals(bytes1: ArrayLike<any>, bytes2: ArrayLike<any>): boolean {
  if (bytes1.length !== bytes2.length) {
    return false;
  }
  for (let i = 0; i < bytes1.length; i++) {
    if (bytes1[i] !== bytes2[i]) {
      return false;
    }
  }
  return true;
}

export function ArraySplit<T>(items: T[], count: number): T[][] {
  if (count > items.length) {
    return [items.slice()];
  }
  if (count > 0) {
    const parts: T[][] = [];
    for (let i = 0; i < items.length; i += count) {
      parts.push(items.slice(i, i + count));
    }
    return parts;
  }
  return [items.slice()];
}

// Uint8Array Functions

export function U8SConcat(arrays: readonly Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const array of arrays) {
    totalLength += array.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

export function U8SCopy(bytes: Uint8Array, count: number, offset = 0): Uint8Array {
  return bytes.slice(offset, offset + count);
}

export function U8SSplit(bytes: Uint8Array, count: number): Uint8Array[] {
  if (count > bytes.byteLength) {
    return [bytes.slice()];
  }
  if (count > 0) {
    const parts: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += count) {
      parts.push(bytes.slice(i, i + count));
    }
    return parts;
  }
  return [bytes.slice()];
}

export function U8STake(bytes: Uint8Array, count: number): [Uint8Array, Uint8Array] {
  if (count > bytes.byteLength) {
    return [bytes.slice(), new Uint8Array()];
  }
  if (count > 0) {
    const chunkA = bytes.slice(0, count);
    const chunkB = bytes.slice(count);
    return [chunkA, chunkB];
  }
  return [new Uint8Array(), bytes.slice()];
}

export function U8STakeEnd(bytes: Uint8Array, count: number): [Uint8Array, Uint8Array] {
  if (count > bytes.byteLength) {
    return [bytes.slice(), new Uint8Array()];
  }
  if (count > 0) {
    const chunkA = bytes.slice(bytes.byteLength - count);
    const chunkB = bytes.slice(0, bytes.byteLength - count);
    return [chunkA, chunkB];
  }
  return [new Uint8Array(), bytes.slice()];
}

// Conversion Utility Functions

export function* getBytes(buffer: ArrayBufferLike): Generator<number> {
  const view = new DataView(buffer);
  for (let i = 0; i < view.byteLength; i++) {
    yield view.getUint8(i) >>> 0;
  }
}

export function U8S(from: ArrayLike<number> = []): Uint8Array {
  return Uint8Array.from(from);
}

export function U8SClamped(from: ArrayLike<number> = []): Uint8Array {
  return Uint8Array.from(Uint8ClampedArray.from(from));
}

export function U8SFromUint32(from: number): Uint8Array {
  const u8s = new Uint8Array(4);
  const view = new DataView(u8s.buffer);
  view.setUint32(0, from >>> 0, false);
  return u8s;
}

const encoder = new TextEncoder();

export function U8SFromString(from: string) {
  return encoder.encode(from);
}

export function U8SToASCII(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte >>> 0))
    .join('');
}

export function U8SToDecimal(bytes: Uint8Array): string[] {
  return Array.from(bytes).map((byte) => (byte >>> 0).toString(10));
}

export function U8SToHex(bytes: Uint8Array): string[] {
  return Array.from(bytes).map((byte) => (byte >>> 0).toString(16).padStart(2, '0'));
}

export function Uint32ToHex(uint: number) {
  return U8SToHex(U8SFromUint32(uint));
}
