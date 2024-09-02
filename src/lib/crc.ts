/* Table of CRCs of all 8-bit messages. */
const crc_table: Uint32Array = new Uint32Array(256);
const crc_magic: Uint32Array = new Uint32Array(1);
crc_magic[0] = 0xedb88320;

/* Make the table for a fast CRC. */
for (let n = 0; n < 256; n++) {
  let c = n >>> 0; // Use unsigned 32-bit integer
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = crc_magic[0] ^ (c >>> 1);
    } else {
      c >>>= 1;
    }
  }
  crc_table[n] = c;
}

export function updateCRC(crc: number, bytes: Uint8Array) {
  let c = crc >>> 0;
  for (let n = 0; n < bytes.length; n++) {
    c = crc_table[(c ^ bytes[n]) & 0xff] ^ (c >>> 8);
  }
  return c >>> 0;
}

/* Return the CRC of the bytes buf[0..len-1]. */
export function initCRC(bytes: Uint8Array) {
  return (updateCRC(0xffffffff >>> 0, bytes) ^ (0xffffffff >>> 0)) >>> 0;
}
