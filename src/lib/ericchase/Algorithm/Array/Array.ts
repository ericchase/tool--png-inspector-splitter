export function ArrayEquals(a: ArrayLike<any>, b: ArrayLike<any>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function* ArrayGetBytes(buffer: ArrayBufferLike): Generator<number> {
  const view = new DataView(buffer);
  for (let i = 0; i < view.byteLength; i++) {
    yield view.getUint8(i) >>> 0;
  }
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
