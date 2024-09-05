export function AreEqual<T>(arrayA: T[], arrayB: T[]): boolean {
  if (arrayA.length !== arrayB.length) {
    return false;
  }
  for (let i = 0; i < arrayA.length; ++i) {
    if (arrayA[i] !== arrayB[i]) {
      return false;
    }
  }
  return true;
}
