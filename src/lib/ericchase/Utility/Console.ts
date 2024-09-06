export function ConsoleLog(...items: any[]) {
  console['log'](...items);
}
export function ConsoleError(...items: any[]) {
  console['error'](...items);
}
