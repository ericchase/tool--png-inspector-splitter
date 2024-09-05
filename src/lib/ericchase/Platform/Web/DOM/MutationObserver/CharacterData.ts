export type SubscriptionCallback = (record: MutationRecord, unsubscribe: () => void) => void;

export class CharacterDataObserver {
  constructor({ source = document.documentElement, options = { characterDataOldValue: true, subtree: true } }: { source?: Node; options?: { characterDataOldValue?: boolean; subtree?: boolean } }) {
    this.mutationObserver = new MutationObserver((mutationRecords: MutationRecord[]) => {
      for (const record of mutationRecords) {
        this.send(record);
      }
    });
    this.mutationObserver.observe(source, { characterData: true, characterDataOldValue: options.characterDataOldValue ?? true, subtree: options.subtree ?? true });
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
