import { crcToBytes, initCRC } from './lib/crc.js';
import { analyzeChunk, extractChunks, toHex, U8Concat, U8Take } from './lib/lib.js';

const [, , path] = Bun.argv;

const buffer = await Bun.file(path).bytes();

const [chunkSignature, rest] = U8Take(buffer, 8);
const chunks = extractChunks(rest);

console.log('Signature');
console.log(...toHex(chunkSignature));
console.log();

for (const chunk of chunks) {
  const { data, size, type, crc } = analyzeChunk(chunk);
  console.log('Chunk');
  console.log(...toHex(chunk));
  console.log('size:', size);
  console.log('type:', String.fromCharCode(...type));
  console.log('data:', ...toHex(data));
  console.log('crc:', ...toHex(crc));
  console.log('computed crc:', ...toHex(crcToBytes(initCRC(U8Concat([type, data])))));
  console.log();
}
