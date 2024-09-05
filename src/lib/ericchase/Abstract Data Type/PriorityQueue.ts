import { BinaryHeap, type IBinaryHeap } from '../Data Structure/BinaryHeap.js';

export type IPriorityQueue<T> = IBinaryHeap<T>;

class Keyed<T> {
  constructor(
    public key: number,
    public data: T,
  ) {}
}

export abstract class PriorityQueue<T> implements IPriorityQueue<T> {
  constructor(public isOrdered: (a: T, b: T) => boolean = (a: T, b: T) => a < b) {
    this.queue = new BinaryHeap<Keyed<T>>((a: Keyed<T>, b: Keyed<T>) => this.isOrdered(a.data, b.data) || (!this.isOrdered(b.data, a.data) && a.key < b.key));
  }
  get length(): number {
    return this.queue.length;
  }
  get top(): T | undefined {
    return this.queue.top?.data;
  }
  private key: number = 0;
  insert(value: T): void {
    this.queue.insert(new Keyed(this.key++, value));
  }
  remove(): T | undefined {
    return this.queue.remove()?.data;
  }
  protected queue: IBinaryHeap<Keyed<T>>;
}

export class MaxPriorityQueue<T> extends PriorityQueue<T> implements IPriorityQueue<T> {
  constructor(isOrdered: (a: T, b: T) => boolean = (a: T, b: T) => a < b) {
    super((a: T, b: T) => !isOrdered(a, b) && isOrdered(b, a));
  }
}

export class MinPriorityQueue<T> extends PriorityQueue<T> implements IPriorityQueue<T> {}
