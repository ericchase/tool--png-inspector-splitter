export class DataTransferItemIterator {
  list: DataTransferItem[] = [];
  constructor(items?: DataTransferItem | DataTransferItem[] | DataTransferItemList | null) {
    if (items instanceof DataTransferItem) {
      this.list = [items];
    } else if (items instanceof DataTransferItemList) {
      this.list = Array.from(items);
    } else if (Array.isArray(items)) {
      this.list = items;
    }
  }
  *getAsEntry(): Generator<FileSystemEntry> {
    for (const item of this.list) {
      const entry = (item as DataTransferItem & { getAsEntry?: DataTransferItem['webkitGetAsEntry'] }).getAsEntry?.() ?? item.webkitGetAsEntry?.();
      if (entry instanceof FileSystemEntry) {
        yield entry;
      }
    }
  }
  *getAsFile(): Generator<File> {
    for (const item of this.list) {
      const file = item.getAsFile?.();
      if (file instanceof File) {
        yield file;
      }
    }
  }
  async *getAsString(): AsyncGenerator<string> {
    for (const item of this.list) {
      yield await new Promise<string>((resolve, reject) => {
        if (typeof item.getAsString === 'function') {
          item.getAsString(resolve);
        } else {
          reject();
        }
      });
    }
  }
}
