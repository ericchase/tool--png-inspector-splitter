export function IsDeviceMobile(): boolean {
  return /android|iphone|mobile/i.test(window.navigator.userAgent);
}
