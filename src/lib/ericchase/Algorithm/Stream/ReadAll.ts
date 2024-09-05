import { U8Concat } from '../Uint8Array/U8Concat.js';

export async function U8StreamReadAll(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      chunks.push(value);
    }
    if (done) {
      break;
    }
  }
  return U8Concat(chunks);
}
