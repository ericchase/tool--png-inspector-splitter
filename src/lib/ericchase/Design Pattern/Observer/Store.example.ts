import { ConsoleLog } from '../../Utility/Console.js';

type SubscriptionCallback<Value> = (value: Value) => void;
type UpdateCallback<Value> = (value: Value) => Value;

class Store<Value> {
  protected currentValue: Value;
  protected subscriptionSet = new Set<SubscriptionCallback<Value>>();
  constructor(initialValue: Value) {
    this.currentValue = initialValue;
  }
  subscribe(callback: SubscriptionCallback<Value>) {
    ConsoleLog('store, subscribe');
    this.subscriptionSet.add(callback);
    callback(this.currentValue);
    return () => {
      ConsoleLog('store, unsubscribe');
      this.subscriptionSet.delete(callback);
    };
  }
  get value(): Value {
    ConsoleLog('store, get');
    return this.currentValue;
  }
  set(value: Value) {
    ConsoleLog('store, set', value);
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
    ConsoleLog('store, update');
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
    ConsoleLog('computed, subscribe');
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
      ConsoleLog('computed, unsubscribe');
      this.subscriptionSet.delete(callback);
      if (this.subscriptionSet.size === 0) {
        this.sourceUnsubscribe?.();
      }
    };
  }
  get value(): ComputedValue {
    ConsoleLog('computed, get');
    return this.computeFn(this.source.value);
  }
}

const counter = new Store(0);
ConsoleLog(counter.value); // 0
counter.set(1);
ConsoleLog(counter.value); // 1

const isEven = new ComputedStore(counter, (value) => (value & 1) === 0);

ConsoleLog(isEven.value); // false
counter.set(2);
ConsoleLog(isEven.value); // true

const parity = new ComputedStore(isEven, (value) => (value ? 'even' : 'odd'));

counter.set(3);
ConsoleLog(parity.value); // odd

ConsoleLog();
ConsoleLog('the important part');

// effect(() => node.textContent = parity.value);
// we will use ExpectedLog because this is just a script
const parityUnsubscribe = parity.subscribe((value) => ConsoleLog('EFFECT, parity:', value)); // immediately logs odd; this is akin to the first render
ConsoleLog();
counter.set(2); // even
ConsoleLog('isEven:', isEven.value);
ConsoleLog('parity:', parity.value);
ConsoleLog();
counter.set(4); // even
ConsoleLog('isEven:', isEven.value);
ConsoleLog('parity:', parity.value);
ConsoleLog('effect is not called because the value of parity did not change');

ConsoleLog();
ConsoleLog('unsubscribe');
parityUnsubscribe();
ConsoleLog('effect will no longer be called, because of unsubscription');
ConsoleLog();
counter.set(5); // odd // this is the unnecessary render
ConsoleLog('isEven:', isEven.value);
ConsoleLog('parity:', parity.value);
ConsoleLog();
counter.set(7); // odd // this is the unnecessary render
ConsoleLog('isEven:', isEven.value);
ConsoleLog('parity:', parity.value);
ConsoleLog();
counter.set(4); // even // this is the unnecessary render
ConsoleLog('isEven:', isEven.value);
ConsoleLog('parity:', parity.value);
