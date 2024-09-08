export function U8(from: ArrayLike<number> = []): Uint8Array {
  return Uint8Array.from(from);
}

export function U8Clamped(from: ArrayLike<number> = []): Uint8Array {
  return Uint8Array.from(Uint8ClampedArray.from(from));
}

export function U8Concat(arrays: readonly Uint8Array[]): Uint8Array {
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

export function U8Copy(bytes: Uint8Array, count: number, offset = 0): Uint8Array {
  return bytes.slice(offset, offset + count);
}

export function U8FromString(from: string): Uint8Array {
  return new TextEncoder().encode(from);
}

export function U8FromUint32(from: number): Uint8Array {
  const u8s = new Uint8Array(4);
  const view = new DataView(u8s.buffer);
  view.setUint32(0, from >>> 0, false);
  return u8s;
}

export function U8Split(bytes: Uint8Array, count: number): Uint8Array[] {
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

export function U8Take(bytes: Uint8Array, count: number): [Uint8Array, Uint8Array] {
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

export function U8TakeEnd(bytes: Uint8Array, count: number): [Uint8Array, Uint8Array] {
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

export function U8ToASCII(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte >>> 0))
    .join('');
}

export function U8ToDecimal(bytes: Uint8Array): string[] {
  return Array.from(bytes).map((byte) => (byte >>> 0).toString(10));
}

export function U8ToHex(bytes: Uint8Array): string[] {
  return Array.from(bytes).map((byte) => (byte >>> 0).toString(16).padStart(2, '0'));
}
