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
      if (entry.isDirectory && entry instanceof FileSystemDirectoryEntry) {
        yield entry;
      }
    }
  }
  *getFileEntry(): Generator<FileSystemFileEntry> {
    for (const entry of this.list) {
      if (typeof FileSystemFileEntry !== 'undefined' && entry.isFile && entry instanceof FileSystemFileEntry) {
        yield entry;
      } else {
        yield entry as FileSystemFileEntry;
      }
    }
  }
}

export class FileSystemDirectoryEntryIterator {
  list: FileSystemDirectoryEntry[] = [];
  constructor(entries?: FileSystemDirectoryEntry | FileSystemDirectoryEntry[] | null) {
    if (entries instanceof FileSystemDirectoryEntry) {
      this.list = [entries];
    } else if (Array.isArray(entries)) {
      this.list = entries;
    }
  }
  async *getEntry(): AsyncGenerator<FileSystemEntry> {
    for (const entry of this.list) {
      const reader = entry.createReader();
      for (const entry of await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))) {
        yield entry;
      }
    }
  }
}