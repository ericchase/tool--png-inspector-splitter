export function* Zip(...b: Iterable<any>[]): Generator<any[]> {
  function g(a: any): any[] {
    const h: any[] = [];
    let d = 0;
    for (; d < a.length; ) {
      const e = a[d].next();
      'done' in e && e.done && (a[d] = (++f, l));
      h.push('value' in e ? e.value : void 0);
      ++d;
    }
    return h;
  }
  let f = 0;
  const l = {
    next(...a: [] | [undefined]) {
      return { value: void 0 };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
  let c = b
    .map((a) => a ?? (++f, l))
    .map((a) => (Symbol.iterator in a ? a : (++f, l)))
    .map((a) => a[Symbol.iterator]() ?? (++f, l))
    .map((a) => ('next' in a ? a : (++f, l)));
  let k = g(c);
  for (; f < c.length; ) yield k, (k = g(c));
}
