import { Compat_FileSystemDirectoryEntry } from './FileSystemDirectoryEntry.js';
import { Compat_FileSystemEntry } from './FileSystemEntry.js';

export class FileSystemEntryIterator {
  list: FileSystemEntry[] = [];
  constructor(entries?: FileSystemEntry | FileSystemEntry[] | null) {
    if (entries) {
      if (Array.isArray(entries)) {
        this.list = entries;
      } else {
        this.list = [entries];
      }
    }
  }
  *getDirectoryEntry(): Generator<FileSystemDirectoryEntry> {
    for (const entry of this.list) {
      if (Compat_FileSystemEntry(entry).isDirectory) {
        yield entry as FileSystemDirectoryEntry;
      }
    }
  }
  *getFileEntry(): Generator<FileSystemFileEntry> {
    for (const entry of this.list) {
      if (Compat_FileSystemEntry(entry).isFile) {
        yield entry as FileSystemFileEntry;
      }
    }
  }
}

export class FileSystemDirectoryEntryIterator {
  list: FileSystemDirectoryEntry[] = [];
  constructor(entries?: FileSystemDirectoryEntry | FileSystemDirectoryEntry[] | null) {
    if (entries) {
      if (Array.isArray(entries)) {
        this.list = entries;
      } else {
        this.list = [entries];
      }
    }
  }
  async *getEntry(): AsyncGenerator<FileSystemEntry> {
    for (const entry of this.list) {
      const reader = Compat_FileSystemDirectoryEntry(entry).createReader();
      if (reader) {
        for (const entry of await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))) {
          yield entry;
        }
      }
    }
  }
}
