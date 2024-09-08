import { HasMethod, HasProperty } from '../Utility/Guard.js';

export function Compat_FileSystemEntry(entry?: FileSystemEntry) {
  return {
    get filesystem(): FileSystemEntry['filesystem'] | undefined {
      return HasProperty(entry, 'filesystem') ? entry.filesystem : undefined;
    },
    get fullPath(): FileSystemEntry['fullPath'] | undefined {
      return HasProperty(entry, 'fullPath') ? entry.fullPath : undefined;
    },
    get isDirectory(): FileSystemEntry['isDirectory'] | undefined {
      return HasProperty(entry, 'isDirectory') ? entry.isDirectory : undefined;
    },
    get isFile(): FileSystemEntry['isFile'] | undefined {
      return HasProperty(entry, 'isFile') ? entry.isFile : undefined;
    },
    get name(): FileSystemEntry['name'] | undefined {
      return HasProperty(entry, 'name') ? entry.name : undefined;
    },
    getParent(): Promise<Parameters<Exclude<Parameters<FileSystemEntry['getParent']>[0], undefined>>[0] | undefined> {
      if (HasMethod(entry, 'getParent')) {
        return new Promise((resolve, reject) => {
          entry.getParent(resolve, reject);
        });
      }
      return Promise.resolve(undefined);
    },
  };
}
