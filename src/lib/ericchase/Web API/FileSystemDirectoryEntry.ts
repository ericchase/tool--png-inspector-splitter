import { HasMethod } from '../Utility/Guard.js';

export function Compat_FileSystemDirectoryEntry(entry?: FileSystemDirectoryEntry) {
  return {
    createReader(): ReturnType<FileSystemDirectoryEntry['createReader']> | undefined {
      if (HasMethod(entry, 'createReader')) {
        return entry.createReader() ?? undefined;
      }
    },
    getDirectory(path: Parameters<FileSystemDirectoryEntry['getDirectory']>[0], options: Parameters<FileSystemDirectoryEntry['getDirectory']>[1]): Promise<Parameters<FileSystemDirectoryEntry['getDirectory']>[2] | undefined> {
      if (HasMethod(entry, 'getDirectory')) {
        return new Promise((resolve, reject) => {
          entry.getDirectory(path, options, () => resolve, reject);
        });
      }
      return Promise.resolve(undefined);
    },
    getFile(path: Parameters<FileSystemDirectoryEntry['getFile']>[0], options: Parameters<FileSystemDirectoryEntry['getFile']>[1]): Promise<Parameters<FileSystemDirectoryEntry['getFile']>[0] | undefined> {
      if (HasMethod(entry, 'getFile')) {
        return new Promise((resolve, reject) => {
          entry.getFile(path, options, () => resolve, reject);
        });
      }
      return Promise.resolve(undefined);
    },
  };
}
