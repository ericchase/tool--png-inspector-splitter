// Issues with falsey branch.
// export function HasMethod<T extends object = object>(item: unknown, key: keyof T): item is T & Record<typeof key, (...args: any[]) => any> {
//   return typeof item === 'object' && item !== null && key in item && typeof (item as Record<typeof key, unknown>)[key] === 'function';
// }
export function HasMethod(item: unknown, key: string): item is Record<string, (...args: any[]) => any> {
  return typeof item === 'object' && item !== null && key in item && typeof (item as Record<string, unknown>)[key] === 'function';
}

// Does not seem to have the same issues as above
export function HasProperty<T extends object = object>(item: unknown, key: keyof T): item is T & Record<typeof key, (...args: any[]) => any> {
  return typeof item === 'object' && item !== null && key in item && typeof (item as Record<typeof key, unknown>)[key] !== 'undefined';
}
