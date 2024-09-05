export interface IBinaryHeap<T> {
  get length(): number;
  get top(): T | undefined;
  insert(value: T): void;
  remove(): T | undefined;
}

export class BinaryHeap<T> implements IBinaryHeap<T> {
  constructor(public isOrdered: (a: T, b: T) => boolean = (a: T, b: T) => a < b) {}
  get length(): number {
    return this.heap.length;
  }
  get top(): T | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }
    return this.heap[0];
  }
  insert(value: T): void {
    this.heap.push(value);
    this.siftUp(this.heap.length - 1);
  }
  remove(): T | undefined {
    const top = this.top;
    const bot = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bot!;
      this.siftDown(0);
    }
    return top;
  }
  protected getLeftChildIndex(index: number): number {
    return index * 2 + 1;
  }
  protected getParentIndex(index: number): number {
    return Math.floor((index - 1) / 2);
  }
  protected getRightChildIndex(index: number): number {
    return index * 2 + 2;
  }
  protected siftDown(index: number): void {
    const leftChildIndex = this.getLeftChildIndex(index);
    const rightChildIndex = this.getRightChildIndex(index);
    let orderedIndex = index;
    if (leftChildIndex < this.heap.length && this.isOrdered(this.heap[leftChildIndex], this.heap[orderedIndex])) {
      orderedIndex = leftChildIndex;
    }
    if (rightChildIndex < this.heap.length && this.isOrdered(this.heap[rightChildIndex], this.heap[orderedIndex])) {
      orderedIndex = rightChildIndex;
    }
    if (orderedIndex !== index) {
      this.swap(orderedIndex, index);
      this.siftDown(orderedIndex);
    }
  }
  protected siftUp(index: number): void {
    if (index === 0) {
      return;
    }
    const parentIndex = this.getParentIndex(index);
    if (!this.isOrdered(this.heap[parentIndex], this.heap[index])) {
      this.swap(parentIndex, index);
      this.siftUp(parentIndex);
    }
  }
  protected swap(index1: number, index2: number): void {
    [this.heap[index1], this.heap[index2]] = [this.heap[index2], this.heap[index1]];
  }
  protected heap: T[] = [];
}

export class MaxBinaryHeap<T> extends BinaryHeap<T> implements IBinaryHeap<T> {
  constructor(isOrdered: (a: T, b: T) => boolean = (a: T, b: T) => a < b) {
    super((a: T, b: T) => !isOrdered(a, b) && isOrdered(b, a));
  }
}

export class MinBinaryHeap<T> extends BinaryHeap<T> implements IBinaryHeap<T> {}
