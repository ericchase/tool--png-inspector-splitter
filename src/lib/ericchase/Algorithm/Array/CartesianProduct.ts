export function* CartesianProduct<T_a extends readonly any[], T_b extends readonly any[]>(array_a: T_a, array_b: T_b): Generator<[T_a, T_b], void, unknown> {
  for (let i = 0; i < array_a.length; ++i) {
    for (let j = 0; j < array_b.length; ++j) {
      yield [array_a[i], array_b[j]];
    }
  }
}

export function* ConsecutiveCartesianProduct<T extends readonly any[]>(...arrays: { [K in keyof T]: T[K][] }): Generator<[...T], void, unknown> {
  for (const item of arrays.reduce((sum, cur) => Array.from(CartesianProduct(sum, cur)).map((_) => _.flat(1)), [[]])) {
    yield item;
  }
}

export function* SelfCartesianProduct<T extends readonly any[]>(array: T): Generator<[T, T], void, unknown> {
  for (let i = 0; i < array.length; ++i) {
    for (let j = i + 1; j < array.length; ++j) {
      yield [array[i], array[j]];
    }
  }
}
