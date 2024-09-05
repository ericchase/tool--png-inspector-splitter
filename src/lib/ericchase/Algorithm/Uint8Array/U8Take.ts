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
