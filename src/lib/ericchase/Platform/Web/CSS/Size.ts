export function ToRelativePx(px: number, root: HTMLElement | SVGElement = document.documentElement) {
  const fontSizePx = Number.parseInt(getComputedStyle(root).fontSize);
  return (fontSizePx / 16) * px;
}

export function ToAdjustedEm(em: number, root: HTMLElement | SVGElement = document.documentElement) {
  const fontSizePx = Number.parseInt(getComputedStyle(root).fontSize);
  return (16 / fontSizePx) * em;
}

export function ToRelativeEm(em: number, root: HTMLElement | SVGElement = document.documentElement) {
  const fontSizePx = Number.parseInt(getComputedStyle(root).fontSize);
  return (fontSizePx / 16) * em;
}
