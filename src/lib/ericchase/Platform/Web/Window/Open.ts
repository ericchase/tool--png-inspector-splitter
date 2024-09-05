export function OpenWindow(
  url: string, //
  onLoad?: (proxy: Window, event: Event) => void,
  onUnload?: (proxy: Window, event: Event) => void,
) {
  const proxy = window.open(url, '_blank');
  if (proxy) {
    if (onLoad) {
      proxy.addEventListener('load', (event: Event) => {
        onLoad(proxy, event);
      });
    }
    if (onUnload) {
      proxy.addEventListener('unload', (event: Event) => {
        onUnload(proxy, event);
      });
    }
  }
}
