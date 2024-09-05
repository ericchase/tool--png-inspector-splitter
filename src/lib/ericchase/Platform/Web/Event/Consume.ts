export function ConsumeEvent(e: Event) {
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
}
