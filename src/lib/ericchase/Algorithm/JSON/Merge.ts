export function MergeJSON(...strings: string[]) {
  function merge_objects(...sources: any[]) {
    const dest: Record<any, any> = {};
    for (const source of sources) {
      if (typeof source !== 'object') {
        continue;
      }
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (typeof source[key] === 'object' && Array.isArray(source[key]) === false) {
            dest[key] = merge_objects(dest[key], source[key]);
          } else {
            dest[key] = source[key];
          }
        }
      }
    }
    return dest;
  }
  return merge_objects(strings.map((s) => JSON.parse(s)));
}
