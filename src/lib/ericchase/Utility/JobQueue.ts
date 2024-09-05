export type SubscriptionCallback<Result, Tag> = (result?: Result, error?: Error, tag?: Tag) => { abort: boolean } | void;

export class JobQueue<Result = void, Tag = void> {
  constructor(public delay_ms: number) {}
  public add(fn: () => Promise<Result>, tag?: Tag) {
    this.queue.push({ fn, tag });
    if (this.running === false) {
      this.running = true;
      this.run();
    }
  }
  public get done() {
    return this.completionCount === this.queue.length ? true : false;
  }
  public subscribe(callback: SubscriptionCallback<Result, Tag>): () => void {
    this.subscriptionSet.add(callback);
    for (const result of this.results) {
      if (callback(result.value, result.error)?.abort === true) {
        this.subscriptionSet.delete(callback);
        return () => {};
      }
    }
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  protected queue: { fn: () => Promise<Result>; tag?: Tag }[] = [];
  protected queueIndex = 0;
  protected completionCount = 0;
  protected results: { value?: Result; error?: Error }[] = [];
  protected running = false;
  protected subscriptionSet = new Set<SubscriptionCallback<Result, Tag>>();
  protected run() {
    if (this.queueIndex < this.queue.length) {
      const { fn, tag } = this.queue[this.queueIndex++];
      fn()
        .then((value) => this.send({ value, tag }))
        .catch((error) => this.send({ error, tag }));
      setTimeout(() => this.run(), this.delay_ms);
    } else {
      this.running = false;
    }
  }
  protected send(result: { value?: Result; error?: Error; tag?: Tag }) {
    this.completionCount++;
    this.results.push(result);
    for (const callback of this.subscriptionSet) {
      if (callback(result.value, result.error, result.tag)?.abort === true) {
        this.subscriptionSet.delete(callback);
      }
    }
  }
}
