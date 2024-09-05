export type SubscriptionCallback = (record: MutationRecord, unsubscribe: () => void) => void;

export class ChildListObserver {
  constructor({ source = document.documentElement, options = { subtree: true } }: { source?: Node; options?: { subtree?: boolean } }) {
    this.mutationObserver = new MutationObserver((mutationRecords: MutationRecord[]) => {
      for (const record of mutationRecords) {
        this.send(record);
      }
    });
    this.mutationObserver.observe(source, { childList: true, subtree: options.subtree ?? true });
  }
  public subscribe(callback: SubscriptionCallback): () => void {
    this.subscriptionSet.add(callback);
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  protected mutationObserver: MutationObserver;
  protected subscriptionSet = new Set<SubscriptionCallback>();
  private send(record: MutationRecord) {
    for (const callback of this.subscriptionSet) {
      callback(record, () => {
        this.subscriptionSet.delete(callback);
      });
    }
  }
}
