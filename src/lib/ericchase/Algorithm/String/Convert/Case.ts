export function ToSnakeCase(s: string) {
  return s.toLowerCase().replace(/ /g, '-');
}
