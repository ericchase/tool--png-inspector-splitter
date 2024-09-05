export function IsVisible(element: Element) {
  const styles = window.getComputedStyle(element);
  if (styles.display === 'none') return false;
  if (styles.visibility === 'hidden' || styles.visibility === 'collapse') return false;
  const { width, height } = element.getBoundingClientRect();
  if (width <= 0 || height <= 0) return false;
  return true;
}
