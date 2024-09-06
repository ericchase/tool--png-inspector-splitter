import { Store } from '../Design Pattern/Observer/Store.js';
import { ConsoleLog } from './Console.js';

export type SubscriptionCallback<Result, Tag> = (result?: Result, error?: Error, tag?: Tag) => { abort: boolean } | void;

export class JobQueue<Result = void, Tag = void> {
  /**
   * 0: No delay. -1: Consecutive.
   */
  constructor(public delay_ms: number) {}
  /**
   * ! Watch out for circular calls !
   *
   * Sets the `aborted` state and resolves when currently running jobs finish.
   */
  public async abort() {
    this.aborted = true;
    await this.done;
  }
  public add(fn: () => Promise<Result>, tag?: Tag) {
    if (this.aborted === false) {
      this.queue.push({ fn, tag });
      if (this.running === false) {
        this.running = true;
        this.run();
      }
    }
  }
  /**
   * Returns a promise that resolves when jobs finish.
   */
  public get done() {
    return new Promise<void>((resolve) => {
      this.runningCount.subscribe((count) => {
        if (count === 0) resolve();
      });
    });
  }
  /**
   * Resets the JobQueue to an initial state, keeping subscriptions alive.
   *
   * @throws If called when jobs are currently running.
   */
  public async reset() {
    if (this.running === true || (await this.runningCount.get()) > 0) {
      throw 'Warning: Wait for running jobs to finish before calling reset. `await JobQueue.done;`';
    }
    this.aborted = false;
    this.completionCount = 0;
    this.queue.length = 0;
    this.queueIndex = 0;
    this.results.length = 0;
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
  protected aborted = false;
  protected completionCount = 0;
  protected queue: { fn: () => Promise<Result>; tag?: Tag }[] = [];
  protected queueIndex = 0;
  protected results: { value?: Result; error?: Error }[] = [];
  protected running = false;
  protected runningCount = new Store(0);
  protected subscriptionSet = new Set<SubscriptionCallback<Result, Tag>>();
  protected run() {
    if (this.aborted === false && this.queueIndex < this.queue.length) {
      const { fn, tag } = this.queue[this.queueIndex++];
      (async () => {
        this.runningCount.update((count) => {
          return count + 1;
        });
        try {
          const value = await fn();
          this.send({ value, tag });
        } catch (error: any) {
          ConsoleLog(error);
          this.send({ error, tag });
        }
        this.runningCount.update((count) => {
          return count - 1;
        });
        if (this.delay_ms < 0) {
          this.run();
        }
      })();
      if (this.delay_ms >= 0) {
        setTimeout(() => this.run(), this.delay_ms);
      }
    } else {
      this.running = false;
    }
  }
  protected send(result: { value?: Result; error?: Error; tag?: Tag }) {
    if (this.aborted === false) {
      this.completionCount++;
      this.results.push(result);
      for (const callback of this.subscriptionSet) {
        if (callback(result.value, result.error, result.tag)?.abort === true) {
          this.subscriptionSet.delete(callback);
        }
      }
    }
  }
}
