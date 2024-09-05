export function CloneElement<T extends HTMLElement | SVGElement>(
  source: T,
  deep = false,
  error = (element: T) => {
    `Failed to clone element. ${element}`;
  },
) {
  const clone = source.cloneNode(deep);
  if (clone instanceof source.constructor) {
    return clone as typeof source;
  }
  throw error(source);
}
