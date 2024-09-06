import { U8StreamReadAll } from '../Algorithm/Stream/ReadAll.js';

export function GetWebkitRelativePath(file: File): string | undefined {
  if (typeof file.webkitRelativePath !== 'undefined') {
    return file.webkitRelativePath;
  }
}

export function GetBytes(file?: File) {
  if (file) {
    if (typeof file.bytes !== 'undefined') {
      return file.bytes();
    }
    return U8StreamReadAll(file.stream());
  }
}
