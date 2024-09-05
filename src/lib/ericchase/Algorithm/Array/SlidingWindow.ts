export function* GenerateSlidingWindowFilter<T>(array: T[], size: number, filter: (slice: T[]) => boolean) {
  if (typeof filter !== 'function') {
    throw new Error('Parameter `filter` must be of type "function".');
  }
  if (size <= array.length) {
    for (let index = size; index <= array.length; ++index) {
      const slice = array.slice(index - size, index);
      if (filter(slice)) {
        yield { slice, begin: index - size, end: index };
      }
    }
  }
}
