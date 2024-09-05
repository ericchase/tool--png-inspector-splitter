export function DiscardError<T>(fn: () => T) {
  try {
    return fn();
  } catch (_) {}
  return undefined;
}
