export class LazyTask<T> {
  protected results?: Promise<T>;
  constructor(protected fn: () => Promise<T>) {}
  get get() {
    if (!this.results) {
      this.results = this.fn();
    }
    return this.results;
  }
}
