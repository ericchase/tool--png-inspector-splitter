import type { N } from '../Utility/Types.js';
import { Compat_DataTransferItem } from './DataTransferItem.js';

export class DataTransferItemIterator {
  list: DataTransferItem[] = [];
  constructor(items?: N<DataTransferItem> | DataTransferItemList | null) {
    if (items) {
      if (Array.isArray(items)) {
        this.list = items;
      } else if ('length' in items) {
        this.list = Array.from(items);
      } else {
        this.list = [items];
      }
    }
  }
  *getAsEntry(): Generator<FileSystemEntry> {
    for (const item of this.list) {
      const entry: FileSystemEntry | undefined = Compat_DataTransferItem(item).getAsEntry();
      if (entry) yield entry;
    }
  }
  *getAsFile(): Generator<File> {
    for (const item of this.list) {
      const file: File | undefined = Compat_DataTransferItem(item).getAsFile();
      if (file) yield file;
    }
  }
  async *getAsString(): AsyncGenerator<string> {
    for (const item of this.list) {
      const task: string | undefined = await Compat_DataTransferItem(item).getAsString();
      if (task) yield task;
    }
  }
}
