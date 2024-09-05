/** Utility: One or more. */
export type N<T> = T | T[];

/** Recursive Object */
export type RecursiveRecord<K extends keyof any, T> = {
  [P in K]: T | RecursiveRecord<K, T>;
};

/** May help IDE show clearer type information. */
export type Prettify<T> = {
  [K in keyof T]: T[K];
};
