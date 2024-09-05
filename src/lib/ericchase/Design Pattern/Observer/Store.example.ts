type SubscriptionCallback<Value> = (value: Value) => void;
type UpdateCallback<Value> = (value: Value) => Value;

class Store<Value> {
  protected currentValue: Value;
  protected subscriptionSet = new Set<SubscriptionCallback<Value>>();
  constructor(initialValue: Value) {
    this.currentValue = initialValue;
  }
  subscribe(callback: SubscriptionCallback<Value>) {
    console.log('store, subscribe');
    this.subscriptionSet.add(callback);
    callback(this.currentValue);
    return () => {
      console.log('store, unsubscribe');
      this.subscriptionSet.delete(callback);
    };
  }
  get value(): Value {
    console.log('store, get');
    return this.currentValue;
  }
  set(value: Value) {
    console.log('store, set', value);
    // If subscriptions should only be triggered once per
    // actual value change, keep this if statement.
    if (this.currentValue !== value) {
      this.currentValue = value;
      for (const callback of this.subscriptionSet) {
        callback(value);
      }
    }
  }
  update(callback: UpdateCallback<Value>) {
    console.log('store, update');
    this.set(callback(this.currentValue));
  }
}
class ComputedStore<SourceValue, ComputedValue> {
  protected cachedValue: ComputedValue | undefined;
  protected subscriptionSet = new Set<SubscriptionCallback<ComputedValue>>();
  protected sourceUnsubscribe: (() => void) | undefined = undefined;
  constructor(
    protected source: Store<SourceValue> | ComputedStore<SourceValue, any>, //
    protected computeFn: (value: SourceValue) => ComputedValue,
  ) {}
  subscribe(callback: SubscriptionCallback<ComputedValue>) {
    console.log('computed, subscribe');
    if (this.subscriptionSet.size === 0) {
      this.sourceUnsubscribe = this.source.subscribe((value) => {
        const newCachedValue = this.computeFn(value);
        if (this.cachedValue !== newCachedValue) {
          this.cachedValue = newCachedValue;
          for (const callback of this.subscriptionSet) {
            callback(newCachedValue);
          }
        }
      });
    }
    this.subscriptionSet.add(callback);
    if (this.cachedValue) {
      callback(this.cachedValue);
    }
    return () => {
      console.log('computed, unsubscribe');
      this.subscriptionSet.delete(callback);
      if (this.subscriptionSet.size === 0) {
        this.sourceUnsubscribe?.();
      }
    };
  }
  get value(): ComputedValue {
    console.log('computed, get');
    return this.computeFn(this.source.value);
  }
}

const counter = new Store(0);
console.log(counter.value); // 0
counter.set(1);
console.log(counter.value); // 1

const isEven = new ComputedStore(counter, (value) => (value & 1) === 0);

console.log(isEven.value); // false
counter.set(2);
console.log(isEven.value); // true

const parity = new ComputedStore(isEven, (value) => (value ? 'even' : 'odd'));

counter.set(3);
console.log(parity.value); // odd

console.log();
console.log('the important part');

// effect(() => node.textContent = parity.value);
// we will use console.log because this is just a script
const parityUnsubscribe = parity.subscribe((value) => console.log('EFFECT, parity:', value)); // immediately logs odd; this is akin to the first render
console.log();
counter.set(2); // even
console.log('isEven:', isEven.value);
console.log('parity:', parity.value);
console.log();
counter.set(4); // even
console.log('isEven:', isEven.value);
console.log('parity:', parity.value);
console.log('effect is not called because the value of parity did not change');

console.log();
console.log('unsubscribe');
parityUnsubscribe();
console.log('effect will no longer be called, because of unsubscription');
console.log();
counter.set(5); // odd // this is the unnecessary render
console.log('isEven:', isEven.value);
console.log('parity:', parity.value);
console.log();
counter.set(7); // odd // this is the unnecessary render
console.log('isEven:', isEven.value);
console.log('parity:', parity.value);
console.log();
counter.set(4); // even // this is the unnecessary render
console.log('isEven:', isEven.value);
console.log('parity:', parity.value);
