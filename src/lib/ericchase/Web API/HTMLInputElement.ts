// Webkit Guards

export function GetWebkitEntries(element: HTMLInputElement): readonly FileSystemEntry[] | undefined {
  return element.webkitEntries ?? undefined;
}

export function GetWebkitRelativePath(file: File): string | undefined {
  return file.webkitRelativePath ?? undefined;
}

export function SupportsWebkitDirectory(): boolean {
  return /android|iphone|mobile/i.test(window.navigator.userAgent) === true ? false : true;
}
