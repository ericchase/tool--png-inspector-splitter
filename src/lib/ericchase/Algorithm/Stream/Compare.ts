const EMPTY_UI8A = new Uint8Array();

export class U8StreamReader {
  done = false;
  i = 0;
  length = 0;
  value: Uint8Array = EMPTY_UI8A;
  constructor(public reader: ReadableStreamDefaultReader<Uint8Array>) {}
  async next(this: U8StreamReader) {
    const { done, value = EMPTY_UI8A } = await this.reader.read();
    if (this.done === done && this.value === value) {
      return { changed: false };
    }
    this.done = done;
    this.i = 0;
    this.length = value.length;
    this.value = value;
    return { changed: true };
  }
}

export async function U8StreamCompare(stream1: ReadableStream<Uint8Array>, stream2: ReadableStream<Uint8Array>) {
  const one = new U8StreamReader(stream1.getReader());
  const two = new U8StreamReader(stream2.getReader());

  while (true) {
    let changed = false;
    if (one.done === false && one.i >= one.length) {
      if ((await one.next()).changed === true) {
        changed = true;
      }
    }
    if (two.done === false && two.i >= two.length) {
      if ((await two.next()).changed === true) {
        changed = true;
      }
    }
    if (one.done && two.done) {
      return true;
    }
    if (one.done !== two.done || changed === false) {
      return false;
    }
    while (one.i < one.length && two.i < two.length) {
      if (one.value[one.i] !== two.value[two.i]) {
        return false;
      }
      one.i++;
      two.i++;
    }
  }
}
