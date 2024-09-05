export type SubscriptionCallback<Value> = (value: Value, unsubscribe: () => void) => void;
export type UpdateCallback<Value> = (value: Value) => Value;

export class Const<Value> {
  protected subscriptionSet = new Set<SubscriptionCallback<Value>>();
  constructor(protected value?: Value) {}
  subscribe(callback: SubscriptionCallback<Value>): () => void {
    this.subscriptionSet.add(callback);
    if (this.value !== undefined) {
      callback(this.value, () => {
        this.subscriptionSet.delete(callback);
      });
    }
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  get(): Promise<Value> {
    return new Promise<Value>((resolve) => {
      this.subscribe((value, unsubscribe) => {
        unsubscribe();
        resolve(value);
      });
    });
  }
  set(value: Value): void {
    if (this.value === undefined) {
      this.value = value;
      for (const callback of this.subscriptionSet) {
        callback(value, () => {
          this.subscriptionSet.delete(callback);
        });
      }
    }
  }
}

export class Store<Value> {
  protected currentValue: Value;
  protected subscriptionSet = new Set<SubscriptionCallback<Value>>();
  constructor(
    protected initialValue: Value,
    protected notifyOnChangeOnly: boolean = false,
  ) {
    this.currentValue = initialValue;
  }
  subscribe(callback: SubscriptionCallback<Value>): () => void {
    this.subscriptionSet.add(callback);
    const unsubscribe = () => {
      this.subscriptionSet.delete(callback);
    };
    callback(this.currentValue, unsubscribe);
    return unsubscribe;
  }
  get(): Promise<Value> {
    return new Promise<Value>((resolve) => {
      this.subscribe((value, unsubscribe) => {
        unsubscribe();
        resolve(value);
      });
    });
  }
  set(value: Value): void {
    if (this.notifyOnChangeOnly && this.currentValue === value) return;
    this.currentValue = value;
    for (const callback of this.subscriptionSet) {
      callback(value, () => {
        this.subscriptionSet.delete(callback);
      });
    }
  }
  update(callback: UpdateCallback<Value>): void {
    this.set(callback(this.currentValue));
  }
}

export class Optional<Value> {
  protected store: Store<Value | undefined>;
  constructor(notifyOnChangeOnly = false) {
    this.store = new Store<Value | undefined>(undefined, notifyOnChangeOnly);
  }
  subscribe(callback: SubscriptionCallback<Value | undefined>): () => void {
    return this.store.subscribe(callback);
  }
  get(): Promise<Value | undefined> {
    return new Promise<Value | undefined>((resolve) => {
      this.subscribe((value, unsubscribe) => {
        unsubscribe();
        resolve(value);
      });
    });
  }
  set(value: Value | undefined): void {
    this.store.set(value);
  }
  update(callback: UpdateCallback<Value | undefined>): void {
    this.store.update(callback);
  }
}

export function CompoundSubscription<T extends any[]>(stores: { [K in keyof T]: Store<T[K]> | Optional<T[K]> }, callback: SubscriptionCallback<{ [K in keyof T]: T[K] | undefined }>): () => void {
  const unsubs: (() => void)[] = [];
  const unsubscribe = () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
  const values = [] as { [K in keyof T]: T[K] | undefined };
  const callback_handler = () => {
    if (values.length === stores.length) {
      callback(values, unsubscribe);
    }
  };
  for (let i = 0; i < stores.length; i++) {
    stores[i].subscribe((value, unsubscribe) => {
      values[i] = value;
      unsubs[i] = unsubscribe;
      if (values.length === stores.length) {
        callback_handler();
      }
    });
  }
  return unsubscribe;
}
