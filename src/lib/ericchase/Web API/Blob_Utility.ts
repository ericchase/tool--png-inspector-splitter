import { U8 } from '../Algorithm/Array/Uint8Array.js';
import { U8StreamReadSome } from '../Algorithm/Stream/ReadSome.js';
import { Compat_Blob } from './Blob.js';

export function ReadSome(blob: Blob, count: number): Promise<Uint8Array> {
  const stream = Compat_Blob(blob).stream();
  return stream ? U8StreamReadSome(stream ?? U8(), count) : Promise.resolve(U8());
}
