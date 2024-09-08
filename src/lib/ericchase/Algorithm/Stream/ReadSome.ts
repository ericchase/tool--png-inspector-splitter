import { U8, U8Concat, U8Take } from '../Array/Uint8Array.js';

export async function U8StreamReadSome(stream: ReadableStream<Uint8Array>, count: number): Promise<Uint8Array> {
  if (count > 0) {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size_read = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        chunks.push(value);
        size_read += value.byteLength;
        if (size_read >= count) {
          break;
        }
      }
      if (done) {
        break;
      }
    }
    return U8Take(U8Concat(chunks), count)[0];
  }
  return U8();
}
