import { type FileChangeInfo, watch } from 'node:fs/promises';

export type ObserverCallback = (events: FileChangeInfo<string>[], unsubscribe: () => void) => void;
export type UnobserveFn = () => void;

export class Watcher {
  /**
   * @param debounce_interval 0
   * @param recursive true
   */
  constructor(
    path: string,
    public debounce_interval = 0,
    recursive = true,
  ) {
    // Debounced Event Notification
    let calling = false;
    let events: FileChangeInfo<string>[] = [];
    let timer = setTimeout(() => {});
    const enqueue = (event: FileChangeInfo<string>) => {
      events.push(event);
      if (calling === false) {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          if (calling === false) {
            calling = true;
            clearTimeout(timer);
            this.notify(events);
            events = [];
            clearTimeout(timer);
            calling = false;
          }
        }, debounce_interval);
      }
    };
    this.done = new Promise<void>(async (resolve) => {
      try {
        for await (const event of watch(path, { recursive, signal: this.controller.signal })) {
          enqueue(event);
        }
      } catch (err) {}
      resolve();
    });
  }
  public abort() {
    this.controller.abort();
  }
  public observe(callback: ObserverCallback): UnobserveFn {
    this.callbackSet.add(callback);
    return () => {
      this.callbackSet.delete(callback);
    };
  }
  public readonly done: Promise<void>;
  protected callbackSet = new Set<ObserverCallback>();
  protected controller = new AbortController();
  protected notify(events: FileChangeInfo<string>[]): void {
    for (const callback of this.callbackSet) {
      callback(events, () => {
        this.callbackSet.delete(callback);
      });
    }
  }
}
