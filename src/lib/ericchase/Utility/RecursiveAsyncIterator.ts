export class RecursiveAsyncIterator<In, Out> {
  constructor(protected fn: (value: Iterable<In> | AsyncIterable<In>, push: (value: Iterable<In> | AsyncIterable<In>) => void) => Iterable<Out> | AsyncIterable<Out>) {}
  async *iterate(init: Iterable<In> | AsyncIterable<In>): Iterable<Out> | AsyncIterable<Out> {
    const list: (Iterable<In> | AsyncIterable<In>)[] = [init];
    for (let i = 0; i < list.length; i++) {
      for await (const fSEntry of this.fn(list[i], (value) => {
        list.push(value);
      })) {
        yield fSEntry;
      }
    }
  }
}
