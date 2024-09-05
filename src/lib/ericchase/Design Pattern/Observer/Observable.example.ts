type UnobserveFn = () => void;
type ObserverCallback<T> = (data: T, unsubscribe: () => void) => void;

class Observable<T> {
  public notify(data: T): void {
    for (const callback of this.callbackSet) {
      callback(data, () => {
        this.callbackSet.delete(callback);
        if (this.callbackSet.size === 0) {
          // do some cleanup
        }
      });
    }
  }
  public observe(callback: ObserverCallback<T>): UnobserveFn {
    this.callbackSet.add(callback);
    if (this.callbackSet.size === 1) {
      // do some init
    }
    return () => {
      this.callbackSet.delete(callback);
      if (this.callbackSet.size === 0) {
        // do some cleanup
      }
    };
  }
  protected callbackSet = new Set<ObserverCallback<T>>();
}
