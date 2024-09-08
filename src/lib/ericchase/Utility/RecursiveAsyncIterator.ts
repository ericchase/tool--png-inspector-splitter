import type { SyncAsyncIterable } from './Types.js';

export class RecursiveIterator<In, Out> {
  constructor(protected fn: (value: SyncAsyncIterable<In>, push: (value: SyncAsyncIterable<In>) => void) => SyncAsyncIterable<Out>) {}
  async *iterate(init: SyncAsyncIterable<In>): SyncAsyncIterable<Out> {
    const list: SyncAsyncIterable<In>[] = [init];
    for (let i = 0; i < list.length; i++) {
      for await (const item of this.fn(list[i], (value) => {
        list.push(value);
      })) {
        yield item;
      }
    }
  }
}
