export type SubscriptionCallback<Value> = (value: Value, unsubscribe: () => void) => void;

export class Broadcast<Value> {
  protected subscriptionSet = new Set<SubscriptionCallback<Value>>();
  subscribe(callback: SubscriptionCallback<Value>): () => void {
    this.subscriptionSet.add(callback);
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  wait(untilValue: Value): Promise<void> {
    return new Promise<void>((resolve) => {
      this.subscribe((value, unsubscribe) => {
        if (value === untilValue) {
          unsubscribe();
          resolve();
        }
      });
    });
  }
  send(value: Value): void {
    for (const callback of this.subscriptionSet) {
      callback(value, () => {
        this.subscriptionSet.delete(callback);
      });
    }
  }
  sendAndWait(value: Value, untilValue: Value): Promise<void> {
    const _ = this.wait(untilValue);
    this.send(value);
    return _;
  }
}
