// src/lib/ericchase/Algorithm/Sleep.ts
async function Sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// src/lib/ericchase/Design Pattern/Observer/Store.ts
class Const {
  value;
  subscriptionSet = new Set();
  constructor(value) {
    this.value = value;
  }
  subscribe(callback) {
    this.subscriptionSet.add(callback);
    if (this.value !== undefined) {
      callback(this.value, () => {
        this.subscriptionSet.delete(callback);
      });
    }
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  get() {
    return new Promise((resolve) => {
      this.subscribe((value, unsubscribe) => {
        unsubscribe();
        resolve(value);
      });
    });
  }
  set(value) {
    if (this.value === undefined) {
      this.value = value;
      for (const callback of this.subscriptionSet) {
        callback(value, () => {
          this.subscriptionSet.delete(callback);
        });
      }
    }
  }
}

class Store {
  initialValue;
  notifyOnChangeOnly;
  currentValue;
  subscriptionSet = new Set();
  constructor(initialValue, notifyOnChangeOnly = false) {
    this.initialValue = initialValue;
    this.notifyOnChangeOnly = notifyOnChangeOnly;
    this.currentValue = initialValue;
  }
  subscribe(callback) {
    this.subscriptionSet.add(callback);
    const unsubscribe = () => {
      this.subscriptionSet.delete(callback);
    };
    callback(this.currentValue, unsubscribe);
    return unsubscribe;
  }
  get() {
    return new Promise((resolve) => {
      this.subscribe((value, unsubscribe) => {
        unsubscribe();
        resolve(value);
      });
    });
  }
  set(value) {
    if (this.notifyOnChangeOnly && this.currentValue === value) return;
    this.currentValue = value;
    for (const callback of this.subscriptionSet) {
      callback(value, () => {
        this.subscriptionSet.delete(callback);
      });
    }
  }
  update(callback) {
    this.set(callback(this.currentValue));
  }
}

// src/lib/ericchase/Utility/Console.ts
function ConsoleLog(...items) {
  console['log'](...items);
}

// src/lib/ericchase/Utility/JobQueue.ts
class JobQueue {
  delay_ms;
  constructor(delay_ms) {
    this.delay_ms = delay_ms;
  }
  async abort() {
    this.aborted = true;
    await this.done;
  }
  add(fn, tag) {
    if (this.aborted === false) {
      this.queue.push({ fn, tag });
      if (this.running === false) {
        this.running = true;
        this.run();
      }
    }
  }
  get done() {
    return new Promise((resolve) => {
      this.runningCount.subscribe((count) => {
        if (count === 0) resolve();
      });
    });
  }
  async reset() {
    if (this.running === true || (await this.runningCount.get()) > 0) {
      throw 'Warning: Wait for running jobs to finish before calling reset. `await JobQueue.done;`';
    }
    this.aborted = false;
    this.completionCount = 0;
    this.queue.length = 0;
    this.queueIndex = 0;
    this.results.length = 0;
  }
  subscribe(callback) {
    this.subscriptionSet.add(callback);
    for (const result of this.results) {
      if (callback(result.value, result.error)?.abort === true) {
        this.subscriptionSet.delete(callback);
        return () => {};
      }
    }
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  aborted = false;
  completionCount = 0;
  queue = [];
  queueIndex = 0;
  results = [];
  running = false;
  runningCount = new Store(0);
  subscriptionSet = new Set();
  run() {
    if (this.aborted === false && this.queueIndex < this.queue.length) {
      const { fn, tag } = this.queue[this.queueIndex++];
      (async () => {
        this.runningCount.update((count) => {
          return count + 1;
        });
        try {
          const value = await fn();
          this.send({ value, tag });
        } catch (error) {
          ConsoleLog(error);
          this.send({ error, tag });
        }
        this.runningCount.update((count) => {
          return count - 1;
        });
        if (this.delay_ms < 0) {
          this.run();
        }
      })();
      if (this.delay_ms >= 0) {
        setTimeout(() => this.run(), this.delay_ms);
      }
    } else {
      this.running = false;
    }
  }
  send(result) {
    if (this.aborted === false) {
      this.completionCount++;
      this.results.push(result);
      for (const callback of this.subscriptionSet) {
        if (callback(result.value, result.error, result.tag)?.abort === true) {
          this.subscriptionSet.delete(callback);
        }
      }
    }
  }
}

// src/lib/ericchase/Utility/RecursiveAsyncIterator.ts
class RecursiveIterator {
  fn;
  constructor(fn) {
    this.fn = fn;
  }
  async *iterate(init) {
    const list = [init];
    for (let i = 0; i < list.length; i++) {
      for await (const fSEntry of this.fn(list[i], (value) => {
        list.push(value);
      })) {
        yield fSEntry;
      }
    }
  }
}

// src/lib/ericchase/Web API/DataTransfer.ts
class DataTransferItemIterator {
  list = [];
  constructor(items) {
    if (items instanceof DataTransferItem) {
      this.list = [items];
    } else if (items instanceof DataTransferItemList) {
      this.list = Array.from(items);
    } else if (Array.isArray(items)) {
      this.list = items;
    }
  }
  *getAsEntry() {
    for (const item of this.list) {
      const entry = item.getAsEntry?.() ?? item.webkitGetAsEntry?.();
      if (typeof FileSystemEntry !== 'undefined' && entry instanceof FileSystemEntry) {
        yield entry;
      } else {
        yield entry;
      }
    }
  }
  *getAsFile() {
    for (const item of this.list) {
      const file = item.getAsFile?.();
      if (file instanceof File) {
        yield file;
      }
    }
  }
  async *getAsString() {
    for (const item of this.list) {
      yield await new Promise((resolve, reject) => {
        if (typeof item.getAsString === 'function') {
          item.getAsString(resolve);
        } else {
          reject();
        }
      });
    }
  }
}

// src/lib/ericchase/Web API/File.ts
function GetWebkitRelativePath(file) {
  if (typeof file.webkitRelativePath !== 'undefined') {
    return file.webkitRelativePath;
  }
}

// src/lib/ericchase/Web API/FileSystem_Utility.ts
class FileSystemEntryIterator {
  list = [];
  constructor(entries) {
    if (entries) {
      if (Array.isArray(entries)) {
        this.list = entries;
      } else {
        this.list = [entries];
      }
    }
  }
  *getDirectoryEntry() {
    for (const entry of this.list) {
      if (entry.isDirectory && entry instanceof FileSystemDirectoryEntry) {
        yield entry;
      }
    }
  }
  *getFileEntry() {
    for (const entry of this.list) {
      if (typeof FileSystemFileEntry !== 'undefined' && entry.isFile && entry instanceof FileSystemFileEntry) {
        yield entry;
      } else {
        yield entry;
      }
    }
  }
}

class FileSystemDirectoryEntryIterator {
  list = [];
  constructor(entries) {
    if (entries instanceof FileSystemDirectoryEntry) {
      this.list = [entries];
    } else if (Array.isArray(entries)) {
      this.list = entries;
    }
  }
  async *getEntry() {
    for (const entry of this.list) {
      const reader = entry.createReader();
      for (const entry2 of await new Promise((resolve, reject) => reader.readEntries(resolve, reject))) {
        yield entry2;
      }
    }
  }
}

// src/lib/ericchase/Web API/HTMLInputElement.ts
function GetWebkitEntries(element) {
  return element.webkitEntries ?? undefined;
}
function SupportsWebkitDirectory() {
  return /android|iphone|mobile/i.test(window.navigator.userAgent) === true ? false : true;
}

// src/components/drag-and-drop-file-picker/drag-and-drop-file-picker.ts
function setupDragAndDropFilePicker(container, fn, options) {
  const element = container.querySelector('input');
  if (!element) {
    throw 'drag-and-drop-file-picker input element missing';
  }
  if (options?.accept) {
    element.setAttribute('accept', options.accept);
  }
  if (options?.directory === true && SupportsWebkitDirectory()) {
    element.toggleAttribute('webkitdirectory', true);
  }
  if (options?.multiple === true) {
    element.toggleAttribute('multiple', true);
  }
  if (fn.onDragEnd || fn.onDragEnter || fn.onDragLeave) {
    const removeListeners = () => {
      element.addEventListener('dragleave', dragleaveHandler);
      element.addEventListener('dragend', dragendHandler);
      element.addEventListener('drop', dropHandler2);
    };
    const dragendHandler = () => {
      removeListeners();
      fn.onDragEnd?.();
    };
    const dragleaveHandler = () => {
      removeListeners();
      fn.onDragLeave?.();
    };
    const dropHandler2 = () => {
      removeListeners();
      fn.onDrop?.();
    };
    element.addEventListener('dragenter', () => {
      element.addEventListener('dragleave', dragleaveHandler);
      element.addEventListener('dragend', dragendHandler);
      element.addEventListener('drop', dropHandler2);
      fn.onDragEnter?.();
    });
  }
  const fSEntrySet = new Set();
  const fSEntryIterator = new RecursiveIterator(async function* (fSEntryIterator2, push) {
    for await (const fSEntry of fSEntryIterator2) {
      const path = fSEntry.fullPath.slice(1);
      if (true) {
        fSEntrySet.add(path);
        const fsEntries = new FileSystemEntryIterator(fSEntry);
        for (const fSFileEntry of fsEntries.getFileEntry()) {
          yield fSFileEntry;
        }
        for (const fSDirectoryEntry of fsEntries.getDirectoryEntry()) {
          push(new FileSystemDirectoryEntryIterator(fSDirectoryEntry).getEntry());
        }
      }
    }
  });
  const jobQueue = new JobQueue(-1);
  jobQueue.subscribe((_, error) => {
    if (error) {
      fn?.onUploadError?.(error);
    }
  });
  let done = true;
  let running = false;
  const uploadStart = async () => {
    if (running === false) {
      done = false;
      running = true;
      await fn.onUploadStart?.();
      Sleep(500).then(async () => {
        await jobQueue.done;
        uploadEnd();
      });
    }
  };
  const uploadEnd = async () => {
    done = true;
    running = false;
    await fn.onUploadEnd?.();
    jobQueue.reset();
    fSEntrySet.clear();
  };
  const iterateFSEntries = async (entries, files) => {
    if (done === false) {
      for await (const fSFileEntry of fSEntryIterator.iterate(entries)) {
        const file = await new Promise((resolve, reject) => fSFileEntry.file(resolve, reject));
        await fn.onUploadNextFile(file, () => (done = true));
        if (done === true) return;
      }
      for (const file of files) {
        const path = GetWebkitRelativePath(file) + file.name;
        if (true) {
          fSEntrySet.add(path);
          await fn.onUploadNextFile(file, () => (done = true));
          if (done === true) return;
        }
      }
    }
  };
  const changeHandler = () => {
    jobQueue.add(async () => {
      await uploadStart();
      if (done === false && element instanceof HTMLInputElement && element.files) {
        await iterateFSEntries(GetWebkitEntries(element) ?? [], element.files);
      }
    }, 'changeHandler');
  };
  const dropHandler = (event) => {
    jobQueue.add(async () => {
      await uploadStart();
      if (done === false && event.dataTransfer) {
        const dataTransferItems = new DataTransferItemIterator(event.dataTransfer.items);
        await iterateFSEntries(dataTransferItems.getAsEntry(), event.dataTransfer.files);
      }
    }, 'dropHandler');
  };
  element.addEventListener('change', changeHandler);
  element.addEventListener('drop', dropHandler);
}
export { setupDragAndDropFilePicker };

//# debugId=C678D6A767A76BD964756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcQWxnb3JpdGhtXFxTbGVlcC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxEZXNpZ24gUGF0dGVyblxcT2JzZXJ2ZXJcXFN0b3JlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFV0aWxpdHlcXENvbnNvbGUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcSm9iUXVldWUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcUmVjdXJzaXZlQXN5bmNJdGVyYXRvci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxEYXRhVHJhbnNmZXIudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcV2ViIEFQSVxcRmlsZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtX1V0aWxpdHkudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcV2ViIEFQSVxcSFRNTElucHV0RWxlbWVudC50cyIsICJzcmNcXGNvbXBvbmVudHNcXGRyYWctYW5kLWRyb3AtZmlsZS1waWNrZXJcXGRyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFNsZWVwKG1zOiBudW1iZXIpIHtcbiAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbn1cbiIsCiAgICAiZXhwb3J0IHR5cGUgU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+ID0gKHZhbHVlOiBWYWx1ZSwgdW5zdWJzY3JpYmU6ICgpID0+IHZvaWQpID0+IHZvaWQ7XG5leHBvcnQgdHlwZSBVcGRhdGVDYWxsYmFjazxWYWx1ZT4gPSAodmFsdWU6IFZhbHVlKSA9PiBWYWx1ZTtcblxuZXhwb3J0IGNsYXNzIENvbnN0PFZhbHVlPiB7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPj4oKTtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIHZhbHVlPzogVmFsdWUpIHt9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBpZiAodGhpcy52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjYWxsYmFjayh0aGlzLnZhbHVlLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZT4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMudmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgICBjYWxsYmFjayh2YWx1ZSwgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3RvcmU8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIGN1cnJlbnRWYWx1ZTogVmFsdWU7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPj4oKTtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGluaXRpYWxWYWx1ZTogVmFsdWUsXG4gICAgcHJvdGVjdGVkIG5vdGlmeU9uQ2hhbmdlT25seTogYm9vbGVhbiA9IGZhbHNlLFxuICApIHtcbiAgICB0aGlzLmN1cnJlbnRWYWx1ZSA9IGluaXRpYWxWYWx1ZTtcbiAgfVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gICAgY2FsbGJhY2sodGhpcy5jdXJyZW50VmFsdWUsIHVuc3Vic2NyaWJlKTtcbiAgICByZXR1cm4gdW5zdWJzY3JpYmU7XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWU+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWU+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLm5vdGlmeU9uQ2hhbmdlT25seSAmJiB0aGlzLmN1cnJlbnRWYWx1ZSA9PT0gdmFsdWUpIHJldHVybjtcbiAgICB0aGlzLmN1cnJlbnRWYWx1ZSA9IHZhbHVlO1xuICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgIGNhbGxiYWNrKHZhbHVlLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgdXBkYXRlKGNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjazxWYWx1ZT4pOiB2b2lkIHtcbiAgICB0aGlzLnNldChjYWxsYmFjayh0aGlzLmN1cnJlbnRWYWx1ZSkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBPcHRpb25hbDxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgc3RvcmU6IFN0b3JlPFZhbHVlIHwgdW5kZWZpbmVkPjtcbiAgY29uc3RydWN0b3Iobm90aWZ5T25DaGFuZ2VPbmx5ID0gZmFsc2UpIHtcbiAgICB0aGlzLnN0b3JlID0gbmV3IFN0b3JlPFZhbHVlIHwgdW5kZWZpbmVkPih1bmRlZmluZWQsIG5vdGlmeU9uQ2hhbmdlT25seSk7XG4gIH1cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZSB8IHVuZGVmaW5lZD4pOiAoKSA9PiB2b2lkIHtcbiAgICByZXR1cm4gdGhpcy5zdG9yZS5zdWJzY3JpYmUoY2FsbGJhY2spO1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlIHwgdW5kZWZpbmVkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlIHwgdW5kZWZpbmVkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUgfCB1bmRlZmluZWQpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnNldCh2YWx1ZSk7XG4gIH1cbiAgdXBkYXRlKGNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjazxWYWx1ZSB8IHVuZGVmaW5lZD4pOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnVwZGF0ZShjYWxsYmFjayk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIENvbXBvdW5kU3Vic2NyaXB0aW9uPFQgZXh0ZW5kcyBhbnlbXT4oc3RvcmVzOiB7IFtLIGluIGtleW9mIFRdOiBTdG9yZTxUW0tdPiB8IE9wdGlvbmFsPFRbS10+IH0sIGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazx7IFtLIGluIGtleW9mIFRdOiBUW0tdIHwgdW5kZWZpbmVkIH0+KTogKCkgPT4gdm9pZCB7XG4gIGNvbnN0IHVuc3ViczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgY29uc3QgdW5zdWJzY3JpYmUgPSAoKSA9PiB7XG4gICAgZm9yIChjb25zdCB1bnN1YiBvZiB1bnN1YnMpIHtcbiAgICAgIHVuc3ViKCk7XG4gICAgfVxuICB9O1xuICBjb25zdCB2YWx1ZXMgPSBbXSBhcyB7IFtLIGluIGtleW9mIFRdOiBUW0tdIHwgdW5kZWZpbmVkIH07XG4gIGNvbnN0IGNhbGxiYWNrX2hhbmRsZXIgPSAoKSA9PiB7XG4gICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IHN0b3Jlcy5sZW5ndGgpIHtcbiAgICAgIGNhbGxiYWNrKHZhbHVlcywgdW5zdWJzY3JpYmUpO1xuICAgIH1cbiAgfTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdG9yZXMubGVuZ3RoOyBpKyspIHtcbiAgICBzdG9yZXNbaV0uc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgIHZhbHVlc1tpXSA9IHZhbHVlO1xuICAgICAgdW5zdWJzW2ldID0gdW5zdWJzY3JpYmU7XG4gICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gc3RvcmVzLmxlbmd0aCkge1xuICAgICAgICBjYWxsYmFja19oYW5kbGVyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHVuc3Vic2NyaWJlO1xufVxuIiwKICAgICJleHBvcnQgZnVuY3Rpb24gQ29uc29sZUxvZyguLi5pdGVtczogYW55W10pIHtcbiAgY29uc29sZVsnbG9nJ10oLi4uaXRlbXMpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIENvbnNvbGVFcnJvciguLi5pdGVtczogYW55W10pIHtcbiAgY29uc29sZVsnZXJyb3InXSguLi5pdGVtcyk7XG59XG4iLAogICAgImltcG9ydCB7IFN0b3JlIH0gZnJvbSAnLi4vRGVzaWduIFBhdHRlcm4vT2JzZXJ2ZXIvU3RvcmUuanMnO1xuaW1wb3J0IHsgQ29uc29sZUxvZyB9IGZyb20gJy4vQ29uc29sZS5qcyc7XG5cbmV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPiA9IChyZXN1bHQ/OiBSZXN1bHQsIGVycm9yPzogRXJyb3IsIHRhZz86IFRhZykgPT4geyBhYm9ydDogYm9vbGVhbiB9IHwgdm9pZDtcblxuZXhwb3J0IGNsYXNzIEpvYlF1ZXVlPFJlc3VsdCA9IHZvaWQsIFRhZyA9IHZvaWQ+IHtcbiAgLyoqXG4gICAqIDA6IE5vIGRlbGF5LiAtMTogQ29uc2VjdXRpdmUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZGVsYXlfbXM6IG51bWJlcikge31cbiAgLyoqXG4gICAqICEgV2F0Y2ggb3V0IGZvciBjaXJjdWxhciBjYWxscyAhXG4gICAqXG4gICAqIFNldHMgdGhlIGBhYm9ydGVkYCBzdGF0ZSBhbmQgcmVzb2x2ZXMgd2hlbiBjdXJyZW50bHkgcnVubmluZyBqb2JzIGZpbmlzaC5cbiAgICovXG4gIHB1YmxpYyBhc3luYyBhYm9ydCgpIHtcbiAgICB0aGlzLmFib3J0ZWQgPSB0cnVlO1xuICAgIGF3YWl0IHRoaXMuZG9uZTtcbiAgfVxuICBwdWJsaWMgYWRkKGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD4sIHRhZz86IFRhZykge1xuICAgIGlmICh0aGlzLmFib3J0ZWQgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLnF1ZXVlLnB1c2goeyBmbiwgdGFnIH0pO1xuICAgICAgaWYgKHRoaXMucnVubmluZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5ydW4oKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBqb2JzIGZpbmlzaC5cbiAgICovXG4gIHB1YmxpYyBnZXQgZG9uZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMucnVubmluZ0NvdW50LnN1YnNjcmliZSgoY291bnQpID0+IHtcbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogUmVzZXRzIHRoZSBKb2JRdWV1ZSB0byBhbiBpbml0aWFsIHN0YXRlLCBrZWVwaW5nIHN1YnNjcmlwdGlvbnMgYWxpdmUuXG4gICAqXG4gICAqIEB0aHJvd3MgSWYgY2FsbGVkIHdoZW4gam9icyBhcmUgY3VycmVudGx5IHJ1bm5pbmcuXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgcmVzZXQoKSB7XG4gICAgaWYgKHRoaXMucnVubmluZyA9PT0gdHJ1ZSB8fCAoYXdhaXQgdGhpcy5ydW5uaW5nQ291bnQuZ2V0KCkpID4gMCkge1xuICAgICAgdGhyb3cgJ1dhcm5pbmc6IFdhaXQgZm9yIHJ1bm5pbmcgam9icyB0byBmaW5pc2ggYmVmb3JlIGNhbGxpbmcgcmVzZXQuIGBhd2FpdCBKb2JRdWV1ZS5kb25lO2AnO1xuICAgIH1cbiAgICB0aGlzLmFib3J0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmNvbXBsZXRpb25Db3VudCA9IDA7XG4gICAgdGhpcy5xdWV1ZS5sZW5ndGggPSAwO1xuICAgIHRoaXMucXVldWVJbmRleCA9IDA7XG4gICAgdGhpcy5yZXN1bHRzLmxlbmd0aCA9IDA7XG4gIH1cbiAgcHVibGljIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiB0aGlzLnJlc3VsdHMpIHtcbiAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvcik/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBwcm90ZWN0ZWQgYWJvcnRlZCA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgY29tcGxldGlvbkNvdW50ID0gMDtcbiAgcHJvdGVjdGVkIHF1ZXVlOiB7IGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD47IHRhZz86IFRhZyB9W10gPSBbXTtcbiAgcHJvdGVjdGVkIHF1ZXVlSW5kZXggPSAwO1xuICBwcm90ZWN0ZWQgcmVzdWx0czogeyB2YWx1ZT86IFJlc3VsdDsgZXJyb3I/OiBFcnJvciB9W10gPSBbXTtcbiAgcHJvdGVjdGVkIHJ1bm5pbmcgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIHJ1bm5pbmdDb3VudCA9IG5ldyBTdG9yZSgwKTtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+PigpO1xuICBwcm90ZWN0ZWQgcnVuKCkge1xuICAgIGlmICh0aGlzLmFib3J0ZWQgPT09IGZhbHNlICYmIHRoaXMucXVldWVJbmRleCA8IHRoaXMucXVldWUubGVuZ3RoKSB7XG4gICAgICBjb25zdCB7IGZuLCB0YWcgfSA9IHRoaXMucXVldWVbdGhpcy5xdWV1ZUluZGV4KytdO1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5uaW5nQ291bnQudXBkYXRlKChjb3VudCkgPT4ge1xuICAgICAgICAgIHJldHVybiBjb3VudCArIDE7XG4gICAgICAgIH0pO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgZm4oKTtcbiAgICAgICAgICB0aGlzLnNlbmQoeyB2YWx1ZSwgdGFnIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgQ29uc29sZUxvZyhlcnJvcik7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgZXJyb3IsIHRhZyB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGNvdW50IC0gMTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLmRlbGF5X21zIDwgMCkge1xuICAgICAgICAgIHRoaXMucnVuKCk7XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG4gICAgICBpZiAodGhpcy5kZWxheV9tcyA+PSAwKSB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5ydW4oKSwgdGhpcy5kZWxheV9tcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuICBwcm90ZWN0ZWQgc2VuZChyZXN1bHQ6IHsgdmFsdWU/OiBSZXN1bHQ7IGVycm9yPzogRXJyb3I7IHRhZz86IFRhZyB9KSB7XG4gICAgaWYgKHRoaXMuYWJvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMuY29tcGxldGlvbkNvdW50Kys7XG4gICAgICB0aGlzLnJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgICBpZiAoY2FsbGJhY2socmVzdWx0LnZhbHVlLCByZXN1bHQuZXJyb3IsIHJlc3VsdC50YWcpPy5hYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBTeW5jQXN5bmNJdGVyYWJsZSB9IGZyb20gJy4vVHlwZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlSXRlcmF0b3I8SW4sIE91dD4ge1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgZm46ICh2YWx1ZTogU3luY0FzeW5jSXRlcmFibGU8SW4+LCBwdXNoOiAodmFsdWU6IFN5bmNBc3luY0l0ZXJhYmxlPEluPikgPT4gdm9pZCkgPT4gU3luY0FzeW5jSXRlcmFibGU8T3V0Pikge31cbiAgYXN5bmMgKml0ZXJhdGUoaW5pdDogU3luY0FzeW5jSXRlcmFibGU8SW4+KTogU3luY0FzeW5jSXRlcmFibGU8T3V0PiB7XG4gICAgY29uc3QgbGlzdDogU3luY0FzeW5jSXRlcmFibGU8SW4+W10gPSBbaW5pdF07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgdGhpcy5mbihsaXN0W2ldLCAodmFsdWUpID0+IHtcbiAgICAgICAgbGlzdC5wdXNoKHZhbHVlKTtcbiAgICAgIH0pKSB7XG4gICAgICAgIHlpZWxkIGZTRW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgTiB9IGZyb20gJy4uL1V0aWxpdHkvVHlwZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIHtcbiAgbGlzdDogRGF0YVRyYW5zZmVySXRlbVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGl0ZW1zPzogTjxEYXRhVHJhbnNmZXJJdGVtPiB8IERhdGFUcmFuc2Zlckl0ZW1MaXN0IHwgbnVsbCkge1xuICAgIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW0pIHtcbiAgICAgIHRoaXMubGlzdCA9IFtpdGVtc107XG4gICAgfSBlbHNlIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW1MaXN0KSB7XG4gICAgICB0aGlzLmxpc3QgPSBBcnJheS5mcm9tKGl0ZW1zKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBpdGVtcztcbiAgICB9XG4gIH1cbiAgKmdldEFzRW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gKGl0ZW0gYXMgRGF0YVRyYW5zZmVySXRlbSAmIHsgZ2V0QXNFbnRyeT86IERhdGFUcmFuc2Zlckl0ZW1bJ3dlYmtpdEdldEFzRW50cnknXSB9KS5nZXRBc0VudHJ5Py4oKSA/PyBpdGVtLndlYmtpdEdldEFzRW50cnk/LigpO1xuICAgICAgaWYgKHR5cGVvZiBGaWxlU3lzdGVtRW50cnkgIT09ICd1bmRlZmluZWQnICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVE9ETyBmaWd1cmUgb3V0IHdoYXQgbmVlZHMgdG8gYmUgZG9uZSB0byBndWFyZCB0aGlzIGZvciBjaHJvbWUgYW5kIG90aGVyIGJyb3dzZXJzXG4gICAgICAgIHlpZWxkIGVudHJ5IGFzIEZpbGVTeXN0ZW1FbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEFzRmlsZSgpOiBHZW5lcmF0b3I8RmlsZT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBpdGVtLmdldEFzRmlsZT8uKCk7XG4gICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIEZpbGUpIHtcbiAgICAgICAgeWllbGQgZmlsZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKmdldEFzU3RyaW5nKCk6IEFzeW5jR2VuZXJhdG9yPHN0cmluZz4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIHlpZWxkIGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGl0ZW0uZ2V0QXNTdHJpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBpdGVtLmdldEFzU3RyaW5nKHJlc29sdmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHsgVThTdHJlYW1SZWFkQWxsIH0gZnJvbSAnLi4vQWxnb3JpdGhtL1N0cmVhbS9SZWFkQWxsLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIEdldFdlYmtpdFJlbGF0aXZlUGF0aChmaWxlOiBGaWxlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiBmaWxlLndlYmtpdFJlbGF0aXZlUGF0aCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gZmlsZS53ZWJraXRSZWxhdGl2ZVBhdGg7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEdldEJ5dGVzKGZpbGU/OiBGaWxlKSB7XG4gIGlmIChmaWxlKSB7XG4gICAgaWYgKHR5cGVvZiBmaWxlLmJ5dGVzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuIGZpbGUuYnl0ZXMoKTtcbiAgICB9XG4gICAgcmV0dXJuIFU4U3RyZWFtUmVhZEFsbChmaWxlLnN0cmVhbSgpKTtcbiAgfVxufVxuIiwKICAgICJleHBvcnQgY2xhc3MgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbUVudHJ5IHwgRmlsZVN5c3RlbUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxpc3QgPSBbZW50cmllc107XG4gICAgICB9XG4gICAgfVxuICB9XG4gICpnZXREaXJlY3RvcnlFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEZpbGVFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUZpbGVFbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBpZiAodHlwZW9mIEZpbGVTeXN0ZW1GaWxlRW50cnkgIT09ICd1bmRlZmluZWQnICYmIGVudHJ5LmlzRmlsZSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1GaWxlRW50cnkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB5aWVsZCBlbnRyeSBhcyBGaWxlU3lzdGVtRmlsZUVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5IHwgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkpIHtcbiAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRFbnRyeSgpOiBBc3luY0dlbmVyYXRvcjxGaWxlU3lzdGVtRW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgcmVhZGVyID0gZW50cnkuY3JlYXRlUmVhZGVyKCk7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGF3YWl0IG5ldyBQcm9taXNlPEZpbGVTeXN0ZW1FbnRyeVtdPigocmVzb2x2ZSwgcmVqZWN0KSA9PiByZWFkZXIucmVhZEVudHJpZXMocmVzb2x2ZSwgcmVqZWN0KSkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgIi8vIFdlYmtpdCBHdWFyZHNcblxuZXhwb3J0IGZ1bmN0aW9uIEdldFdlYmtpdEVudHJpZXMoZWxlbWVudDogSFRNTElucHV0RWxlbWVudCk6IHJlYWRvbmx5IEZpbGVTeXN0ZW1FbnRyeVtdIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIGVsZW1lbnQud2Via2l0RW50cmllcyA/PyB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTdXBwb3J0c1dlYmtpdERpcmVjdG9yeSgpOiBib29sZWFuIHtcbiAgcmV0dXJuIC9hbmRyb2lkfGlwaG9uZXxtb2JpbGUvaS50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KSA9PT0gdHJ1ZSA/IGZhbHNlIDogdHJ1ZTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU2xlZXAgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL0FsZ29yaXRobS9TbGVlcC5qcyc7XG5pbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9Kb2JRdWV1ZS5qcyc7XG5pbXBvcnQgeyBSZWN1cnNpdmVJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9SZWN1cnNpdmVBc3luY0l0ZXJhdG9yLmpzJztcbmltcG9ydCB0eXBlIHsgU3luY0FzeW5jSXRlcmFibGUgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvVHlwZXMuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0RhdGFUcmFuc2Zlci5qcyc7XG5pbXBvcnQgeyBHZXRXZWJraXRSZWxhdGl2ZVBhdGggfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZS5qcyc7XG5pbXBvcnQgeyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvciwgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZVN5c3RlbV9VdGlsaXR5LmpzJztcbmltcG9ydCB7IEdldFdlYmtpdEVudHJpZXMsIFN1cHBvcnRzV2Via2l0RGlyZWN0b3J5IH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0hUTUxJbnB1dEVsZW1lbnQuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gIGNvbnRhaW5lcjogRWxlbWVudCxcbiAgZm46IHtcbiAgICBvbkRyYWdFbmQ/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0VudGVyPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyYWdMZWF2ZT86ICgpID0+IHZvaWQ7XG4gICAgb25Ecm9wPzogKCkgPT4gdm9pZDtcbiAgICBvblVwbG9hZEVuZD86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuICAgIG9uVXBsb2FkRXJyb3I/OiAoZXJyb3I6IGFueSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG4gICAgb25VcGxvYWROZXh0RmlsZTogKGZpbGU6IEZpbGUsIGRvbmU6ICgpID0+IHZvaWQpID0+IFByb21pc2U8dm9pZD4gfCB2b2lkO1xuICAgIG9uVXBsb2FkU3RhcnQ/OiAoKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiAgfSxcbiAgb3B0aW9ucz86IHtcbiAgICBhY2NlcHQ/OiBzdHJpbmc7XG4gICAgZGlyZWN0b3J5PzogYm9vbGVhbjtcbiAgICBtdWx0aXBsZT86IGJvb2xlYW47XG4gIH0sXG4pIHtcbiAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpO1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyAnZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlciBpbnB1dCBlbGVtZW50IG1pc3NpbmcnO1xuICB9XG4gIGlmIChvcHRpb25zPy5hY2NlcHQpIHtcbiAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnYWNjZXB0Jywgb3B0aW9ucy5hY2NlcHQpO1xuICB9XG4gIGlmIChvcHRpb25zPy5kaXJlY3RvcnkgPT09IHRydWUgJiYgU3VwcG9ydHNXZWJraXREaXJlY3RvcnkoKSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCd3ZWJraXRkaXJlY3RvcnknLCB0cnVlKTtcbiAgfVxuICBpZiAob3B0aW9ucz8ubXVsdGlwbGUgPT09IHRydWUpIHtcbiAgICBlbGVtZW50LnRvZ2dsZUF0dHJpYnV0ZSgnbXVsdGlwbGUnLCB0cnVlKTtcbiAgfVxuXG4gIGlmIChmbi5vbkRyYWdFbmQgfHwgZm4ub25EcmFnRW50ZXIgfHwgZm4ub25EcmFnTGVhdmUpIHtcbiAgICBjb25zdCByZW1vdmVMaXN0ZW5lcnMgPSAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgIH07XG4gICAgY29uc3QgZHJhZ2VuZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0VuZD8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnbGVhdmVIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyYWdMZWF2ZT8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcm9wSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25Ecm9wPy4oKTtcbiAgICB9O1xuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgKCkgPT4ge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBkcmFnbGVhdmVIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyb3BIYW5kbGVyKTtcbiAgICAgIGZuLm9uRHJhZ0VudGVyPy4oKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGZTRW50cnlTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgZlNFbnRyeUl0ZXJhdG9yID0gbmV3IFJlY3Vyc2l2ZUl0ZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeSwgRmlsZVN5c3RlbUZpbGVFbnRyeT4oYXN5bmMgZnVuY3Rpb24qIChmU0VudHJ5SXRlcmF0b3IsIHB1c2gpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yKSB7XG4gICAgICBjb25zdCBwYXRoID0gZlNFbnRyeS5mdWxsUGF0aC5zbGljZSgxKTtcbiAgICAgIGlmICh0cnVlIHx8ICFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgY29uc3QgZnNFbnRyaWVzID0gbmV3IEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yKGZTRW50cnkpO1xuICAgICAgICBmb3IgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZzRW50cmllcy5nZXRGaWxlRW50cnkoKSkge1xuICAgICAgICAgIHlpZWxkIGZTRmlsZUVudHJ5O1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZlNEaXJlY3RvcnlFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RGlyZWN0b3J5RW50cnkoKSkge1xuICAgICAgICAgIHB1c2gobmV3IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yKGZTRGlyZWN0b3J5RW50cnkpLmdldEVudHJ5KCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBqb2JRdWV1ZSA9IG5ldyBKb2JRdWV1ZTx2b2lkLCBzdHJpbmc+KC0xKTtcbiAgam9iUXVldWUuc3Vic2NyaWJlKChfLCBlcnJvcikgPT4ge1xuICAgIGlmIChlcnJvcikge1xuICAgICAgZm4/Lm9uVXBsb2FkRXJyb3I/LihlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICBsZXQgZG9uZSA9IHRydWU7XG4gIGxldCBydW5uaW5nID0gZmFsc2U7XG4gIGNvbnN0IHVwbG9hZFN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChydW5uaW5nID09PSBmYWxzZSkge1xuICAgICAgZG9uZSA9IGZhbHNlO1xuICAgICAgcnVubmluZyA9IHRydWU7XG4gICAgICBhd2FpdCBmbi5vblVwbG9hZFN0YXJ0Py4oKTtcbiAgICAgIC8vIGdpdmUgYnJvd3NlciBzb21lIHRpbWUgdG8gcXVldWUgYm90aCBldmVudHNcbiAgICAgIFNsZWVwKDUwMCkudGhlbihhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IGpvYlF1ZXVlLmRvbmU7XG4gICAgICAgIHVwbG9hZEVuZCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuICBjb25zdCB1cGxvYWRFbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgZG9uZSA9IHRydWU7XG4gICAgcnVubmluZyA9IGZhbHNlO1xuICAgIGF3YWl0IGZuLm9uVXBsb2FkRW5kPy4oKTtcbiAgICBqb2JRdWV1ZS5yZXNldCgpO1xuICAgIGZTRW50cnlTZXQuY2xlYXIoKTtcbiAgfTtcbiAgY29uc3QgaXRlcmF0ZUZTRW50cmllcyA9IGFzeW5jIChlbnRyaWVzOiBTeW5jQXN5bmNJdGVyYWJsZTxGaWxlU3lzdGVtRW50cnk+LCBmaWxlczogRmlsZUxpc3QpID0+IHtcbiAgICBpZiAoZG9uZSA9PT0gZmFsc2UpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZlNGaWxlRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yLml0ZXJhdGUoZW50cmllcykpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IG5ldyBQcm9taXNlPEZpbGU+KChyZXNvbHZlLCByZWplY3QpID0+IGZTRmlsZUVudHJ5LmZpbGUocmVzb2x2ZSwgcmVqZWN0KSk7XG4gICAgICAgIGF3YWl0IGZuLm9uVXBsb2FkTmV4dEZpbGUoZmlsZSwgKCkgPT4gKGRvbmUgPSB0cnVlKSk7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICBjb25zdCBwYXRoID0gR2V0V2Via2l0UmVsYXRpdmVQYXRoKGZpbGUpICsgZmlsZS5uYW1lO1xuICAgICAgICBpZiAodHJ1ZSB8fCAhZlNFbnRyeVNldC5oYXMocGF0aCkpIHtcbiAgICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGZpbGUsICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBjb25zdCBjaGFuZ2VIYW5kbGVyID0gKCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGRvbmUgPT09IGZhbHNlICYmIGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmIGVsZW1lbnQuZmlsZXMpIHtcbiAgICAgICAgYXdhaXQgaXRlcmF0ZUZTRW50cmllcyhHZXRXZWJraXRFbnRyaWVzKGVsZW1lbnQpID8/IFtdLCBlbGVtZW50LmZpbGVzKTtcbiAgICAgIH1cbiAgICB9LCAnY2hhbmdlSGFuZGxlcicpO1xuICB9O1xuICBjb25zdCBkcm9wSGFuZGxlciA9IChldmVudDogRHJhZ0V2ZW50KSA9PiB7XG4gICAgam9iUXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHVwbG9hZFN0YXJ0KCk7XG4gICAgICBpZiAoZG9uZSA9PT0gZmFsc2UgJiYgZXZlbnQuZGF0YVRyYW5zZmVyKSB7XG4gICAgICAgIGNvbnN0IGRhdGFUcmFuc2Zlckl0ZW1zID0gbmV3IERhdGFUcmFuc2Zlckl0ZW1JdGVyYXRvcihldmVudC5kYXRhVHJhbnNmZXIuaXRlbXMpO1xuICAgICAgICBhd2FpdCBpdGVyYXRlRlNFbnRyaWVzKGRhdGFUcmFuc2Zlckl0ZW1zLmdldEFzRW50cnkoKSwgZXZlbnQuZGF0YVRyYW5zZmVyLmZpbGVzKTtcbiAgICAgIH1cbiAgICB9LCAnZHJvcEhhbmRsZXInKTtcbiAgfTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyKTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xufVxuIgogIF0sCiAgIm1hcHBpbmdz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
