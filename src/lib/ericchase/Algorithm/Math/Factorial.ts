const cache = [1, 1];
export function Factorial(n: number) {
  if (!(n in cache)) {
    let res = cache[cache.length - 1];
    for (let i = cache.length; i < n; ++i) {
      cache[i] = res *= i;
    }
    cache[n] = res * n;
  }
  return cache[n];
}
