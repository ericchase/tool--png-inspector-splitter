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
      for await (const item of this.fn(list[i], (value) => {
        list.push(value);
      })) {
        yield item;
      }
    }
  }
}

// src/lib/ericchase/Utility/Guard.ts
function HasMethod(item, key) {
  return typeof item === 'object' && item !== null && key in item && typeof item[key] === 'function';
}
function HasProperty(item, key) {
  return typeof item === 'object' && item !== null && key in item && typeof item[key] !== 'undefined';
}

// src/lib/ericchase/Web API/DataTransferItem.ts
function Compat_DataTransferItem(item) {
  return {
    getAsEntry() {
      if (HasMethod(item, 'getAsEntry')) {
        return item.getAsEntry() ?? undefined;
      }
      if (HasMethod(item, 'webkitGetAsEntry')) {
        return item.webkitGetAsEntry() ?? undefined;
      }
    },
    getAsFile() {
      if (HasMethod(item, 'getAsFile')) {
        return item.getAsFile() ?? undefined;
      }
    },
    getAsString() {
      if (HasMethod(item, 'getAsString')) {
        return new Promise((resolve, reject) => {
          try {
            item.getAsString(resolve);
          } catch (error) {
            reject(error);
          }
        });
      }
      return Promise.resolve(undefined);
    },
  };
}

// src/lib/ericchase/Web API/DataTransferItem_Utility.ts
class DataTransferItemIterator {
  list = [];
  constructor(items) {
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
  *getAsEntry() {
    for (const item of this.list) {
      const entry = Compat_DataTransferItem(item).getAsEntry();
      if (entry) yield entry;
    }
  }
  *getAsFile() {
    for (const item of this.list) {
      const file = Compat_DataTransferItem(item).getAsFile();
      if (file) yield file;
    }
  }
  async *getAsString() {
    for (const item of this.list) {
      const task = await Compat_DataTransferItem(item).getAsString();
      if (task) yield task;
    }
  }
}

// src/lib/ericchase/Web API/File.ts
function Compat_File(file) {
  return {
    get lastModified() {
      return HasProperty(file, 'lastModified') ? file.lastModified : undefined;
    },
    get name() {
      return HasProperty(file, 'name') ? file.name : undefined;
    },
    get webkitRelativePath() {
      return HasProperty(file, 'webkitRelativePath') ? file.webkitRelativePath : undefined;
    },
  };
}

// src/lib/ericchase/Web API/FileSystemDirectoryEntry.ts
function Compat_FileSystemDirectoryEntry(entry) {
  return {
    createReader() {
      if (HasMethod(entry, 'createReader')) {
        return entry.createReader() ?? undefined;
      }
    },
    getDirectory(path, options) {
      if (HasMethod(entry, 'getDirectory')) {
        return new Promise((resolve, reject) => {
          entry.getDirectory(path, options, () => resolve, reject);
        });
      }
      return Promise.resolve(undefined);
    },
    getFile(path, options) {
      if (HasMethod(entry, 'getFile')) {
        return new Promise((resolve, reject) => {
          entry.getFile(path, options, () => resolve, reject);
        });
      }
      return Promise.resolve(undefined);
    },
  };
}

// src/lib/ericchase/Web API/FileSystemEntry.ts
function Compat_FileSystemEntry(entry) {
  return {
    get filesystem() {
      return HasProperty(entry, 'filesystem') ? entry.filesystem : undefined;
    },
    get fullPath() {
      return HasProperty(entry, 'fullPath') ? entry.fullPath : undefined;
    },
    get isDirectory() {
      return HasProperty(entry, 'isDirectory') ? entry.isDirectory : undefined;
    },
    get isFile() {
      return HasProperty(entry, 'isFile') ? entry.isFile : undefined;
    },
    get name() {
      return HasProperty(entry, 'name') ? entry.name : undefined;
    },
    getParent() {
      if (HasMethod(entry, 'getParent')) {
        return new Promise((resolve, reject) => {
          entry.getParent(resolve, reject);
        });
      }
      return Promise.resolve(undefined);
    },
  };
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
      if (Compat_FileSystemEntry(entry).isDirectory) {
        yield entry;
      }
    }
  }
  *getFileEntry() {
    for (const entry of this.list) {
      if (Compat_FileSystemEntry(entry).isFile) {
        yield entry;
      }
    }
  }
}

class FileSystemDirectoryEntryIterator {
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
  async *getEntry() {
    for (const entry of this.list) {
      const reader = Compat_FileSystemDirectoryEntry(entry).createReader();
      if (reader) {
        for (const entry2 of await new Promise((resolve, reject) => reader.readEntries(resolve, reject))) {
          yield entry2;
        }
      }
    }
  }
}

// src/lib/ericchase/Web API/Device.ts
function IsDeviceMobile() {
  return /android|iphone|mobile/i.test(window.navigator.userAgent);
}

// src/lib/ericchase/Web API/HTMLInputElement.ts
function Compat_HTMLInputElement(input) {
  return {
    get webkitEntries() {
      return HasProperty(input, 'webkitEntries') ? input.webkitEntries : undefined;
    },
    get webkitdirectory() {
      return HasProperty(input, 'webkitdirectory') ? input.webkitdirectory : undefined;
    },
  };
}
function IsWebkitDirectorySupported() {
  return IsDeviceMobile() ? false : true;
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
  if (options?.directory === true && IsWebkitDirectorySupported()) {
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
      if (!fSEntrySet.has(path)) {
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
        const reader = new FileReader();
        reader.readAsText(file);
        await fn.onUploadNextFile(file, () => (done = true));
        if (done === true) return;
      }
      for (const file of files) {
        const path = Compat_File(file).webkitRelativePath + file.name;
        if (!fSEntrySet.has(path)) {
          fSEntrySet.add(path);
          if (file.size > 0) {
            await fn.onUploadNextFile(file, () => (done = true));
            if (done === true) return;
          }
        }
      }
    }
  };
  const changeHandler = () => {
    jobQueue.add(async () => {
      await uploadStart();
      if (done === false && element instanceof HTMLInputElement && element.files) {
        await iterateFSEntries(Compat_HTMLInputElement(element).webkitEntries ?? [], element.files);
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

//# debugId=4B3A357AE97DD68964756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcQWxnb3JpdGhtXFxTbGVlcC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxEZXNpZ24gUGF0dGVyblxcT2JzZXJ2ZXJcXFN0b3JlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFV0aWxpdHlcXENvbnNvbGUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcSm9iUXVldWUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcUmVjdXJzaXZlQXN5bmNJdGVyYXRvci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxHdWFyZC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxEYXRhVHJhbnNmZXJJdGVtLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERhdGFUcmFuc2Zlckl0ZW1fVXRpbGl0eS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtRW50cnkudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcV2ViIEFQSVxcRmlsZVN5c3RlbV9VdGlsaXR5LnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERldmljZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxIVE1MSW5wdXRFbGVtZW50LnRzIiwgInNyY1xcY29tcG9uZW50c1xcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlclxcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsKICAgICJleHBvcnQgYXN5bmMgZnVuY3Rpb24gU2xlZXAobXM6IG51bWJlcikge1xuICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuIiwKICAgICJleHBvcnQgdHlwZSBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4gPSAodmFsdWU6IFZhbHVlLCB1bnN1YnNjcmliZTogKCkgPT4gdm9pZCkgPT4gdm9pZDtcbmV4cG9ydCB0eXBlIFVwZGF0ZUNhbGxiYWNrPFZhbHVlPiA9ICh2YWx1ZTogVmFsdWUpID0+IFZhbHVlO1xuXG5leHBvcnQgY2xhc3MgQ29uc3Q8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgdmFsdWU/OiBWYWx1ZSkge31cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGlmICh0aGlzLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNhbGxiYWNrKHRoaXMudmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy52YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGNhbGxiYWNrKHZhbHVlLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTdG9yZTxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgY3VycmVudFZhbHVlOiBWYWx1ZTtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgaW5pdGlhbFZhbHVlOiBWYWx1ZSxcbiAgICBwcm90ZWN0ZWQgbm90aWZ5T25DaGFuZ2VPbmx5OiBib29sZWFuID0gZmFsc2UsXG4gICkge1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICB9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgICBjYWxsYmFjayh0aGlzLmN1cnJlbnRWYWx1ZSwgdW5zdWJzY3JpYmUpO1xuICAgIHJldHVybiB1bnN1YnNjcmliZTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZT4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubm90aWZ5T25DaGFuZ2VPbmx5ICYmIHRoaXMuY3VycmVudFZhbHVlID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gdmFsdWU7XG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgY2FsbGJhY2sodmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlPik6IHZvaWQge1xuICAgIHRoaXMuc2V0KGNhbGxiYWNrKHRoaXMuY3VycmVudFZhbHVlKSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wdGlvbmFsPFZhbHVlPiB7XG4gIHByb3RlY3RlZCBzdG9yZTogU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+O1xuICBjb25zdHJ1Y3Rvcihub3RpZnlPbkNoYW5nZU9ubHkgPSBmYWxzZSkge1xuICAgIHRoaXMuc3RvcmUgPSBuZXcgU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+KHVuZGVmaW5lZCwgbm90aWZ5T25DaGFuZ2VPbmx5KTtcbiAgfVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6ICgpID0+IHZvaWQge1xuICAgIHJldHVybiB0aGlzLnN0b3JlLnN1YnNjcmliZShjYWxsYmFjayk7XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0KHZhbHVlKTtcbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUudXBkYXRlKGNhbGxiYWNrKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gQ29tcG91bmRTdWJzY3JpcHRpb248VCBleHRlbmRzIGFueVtdPihzdG9yZXM6IHsgW0sgaW4ga2V5b2YgVF06IFN0b3JlPFRbS10+IHwgT3B0aW9uYWw8VFtLXT4gfSwgY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfT4pOiAoKSA9PiB2b2lkIHtcbiAgY29uc3QgdW5zdWJzOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IHVuc3ViIG9mIHVuc3Vicykge1xuICAgICAgdW5zdWIoKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHZhbHVlcyA9IFtdIGFzIHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfTtcbiAgY29uc3QgY2FsbGJhY2tfaGFuZGxlciA9ICgpID0+IHtcbiAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gc3RvcmVzLmxlbmd0aCkge1xuICAgICAgY2FsbGJhY2sodmFsdWVzLCB1bnN1YnNjcmliZSk7XG4gICAgfVxuICB9O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0b3Jlcy5sZW5ndGg7IGkrKykge1xuICAgIHN0b3Jlc1tpXS5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgdmFsdWVzW2ldID0gdmFsdWU7XG4gICAgICB1bnN1YnNbaV0gPSB1bnN1YnNjcmliZTtcbiAgICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSBzdG9yZXMubGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrX2hhbmRsZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICByZXR1cm4gdW5zdWJzY3JpYmU7XG59XG4iLAogICAgImV4cG9ydCBmdW5jdGlvbiBDb25zb2xlTG9nKC4uLml0ZW1zOiBhbnlbXSkge1xuICBjb25zb2xlWydsb2cnXSguLi5pdGVtcyk7XG59XG5leHBvcnQgZnVuY3Rpb24gQ29uc29sZUVycm9yKC4uLml0ZW1zOiBhbnlbXSkge1xuICBjb25zb2xlWydlcnJvciddKC4uLml0ZW1zKTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU3RvcmUgfSBmcm9tICcuLi9EZXNpZ24gUGF0dGVybi9PYnNlcnZlci9TdG9yZS5qcyc7XG5pbXBvcnQgeyBDb25zb2xlTG9nIH0gZnJvbSAnLi9Db25zb2xlLmpzJztcblxuZXhwb3J0IHR5cGUgU3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+ID0gKHJlc3VsdD86IFJlc3VsdCwgZXJyb3I/OiBFcnJvciwgdGFnPzogVGFnKSA9PiB7IGFib3J0OiBib29sZWFuIH0gfCB2b2lkO1xuXG5leHBvcnQgY2xhc3MgSm9iUXVldWU8UmVzdWx0ID0gdm9pZCwgVGFnID0gdm9pZD4ge1xuICAvKipcbiAgICogMDogTm8gZGVsYXkuIC0xOiBDb25zZWN1dGl2ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBkZWxheV9tczogbnVtYmVyKSB7fVxuICAvKipcbiAgICogISBXYXRjaCBvdXQgZm9yIGNpcmN1bGFyIGNhbGxzICFcbiAgICpcbiAgICogU2V0cyB0aGUgYGFib3J0ZWRgIHN0YXRlIGFuZCByZXNvbHZlcyB3aGVuIGN1cnJlbnRseSBydW5uaW5nIGpvYnMgZmluaXNoLlxuICAgKi9cbiAgcHVibGljIGFzeW5jIGFib3J0KCkge1xuICAgIHRoaXMuYWJvcnRlZCA9IHRydWU7XG4gICAgYXdhaXQgdGhpcy5kb25lO1xuICB9XG4gIHB1YmxpYyBhZGQoZm46ICgpID0+IFByb21pc2U8UmVzdWx0PiwgdGFnPzogVGFnKSB7XG4gICAgaWYgKHRoaXMuYWJvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMucXVldWUucHVzaCh7IGZuLCB0YWcgfSk7XG4gICAgICBpZiAodGhpcy5ydW5uaW5nID09PSBmYWxzZSkge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLnJ1bigpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvKipcbiAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGpvYnMgZmluaXNoLlxuICAgKi9cbiAgcHVibGljIGdldCBkb25lKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5ydW5uaW5nQ291bnQuc3Vic2NyaWJlKChjb3VudCkgPT4ge1xuICAgICAgICBpZiAoY291bnQgPT09IDApIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBSZXNldHMgdGhlIEpvYlF1ZXVlIHRvIGFuIGluaXRpYWwgc3RhdGUsIGtlZXBpbmcgc3Vic2NyaXB0aW9ucyBhbGl2ZS5cbiAgICpcbiAgICogQHRocm93cyBJZiBjYWxsZWQgd2hlbiBqb2JzIGFyZSBjdXJyZW50bHkgcnVubmluZy5cbiAgICovXG4gIHB1YmxpYyBhc3luYyByZXNldCgpIHtcbiAgICBpZiAodGhpcy5ydW5uaW5nID09PSB0cnVlIHx8IChhd2FpdCB0aGlzLnJ1bm5pbmdDb3VudC5nZXQoKSkgPiAwKSB7XG4gICAgICB0aHJvdyAnV2FybmluZzogV2FpdCBmb3IgcnVubmluZyBqb2JzIHRvIGZpbmlzaCBiZWZvcmUgY2FsbGluZyByZXNldC4gYGF3YWl0IEpvYlF1ZXVlLmRvbmU7YCc7XG4gICAgfVxuICAgIHRoaXMuYWJvcnRlZCA9IGZhbHNlO1xuICAgIHRoaXMuY29tcGxldGlvbkNvdW50ID0gMDtcbiAgICB0aGlzLnF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5xdWV1ZUluZGV4ID0gMDtcbiAgICB0aGlzLnJlc3VsdHMubGVuZ3RoID0gMDtcbiAgfVxuICBwdWJsaWMgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHRoaXMucmVzdWx0cykge1xuICAgICAgaWYgKGNhbGxiYWNrKHJlc3VsdC52YWx1ZSwgcmVzdWx0LmVycm9yKT8uYWJvcnQgPT09IHRydWUpIHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuICgpID0+IHt9O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICB9XG4gIHByb3RlY3RlZCBhYm9ydGVkID0gZmFsc2U7XG4gIHByb3RlY3RlZCBjb21wbGV0aW9uQ291bnQgPSAwO1xuICBwcm90ZWN0ZWQgcXVldWU6IHsgZm46ICgpID0+IFByb21pc2U8UmVzdWx0PjsgdGFnPzogVGFnIH1bXSA9IFtdO1xuICBwcm90ZWN0ZWQgcXVldWVJbmRleCA9IDA7XG4gIHByb3RlY3RlZCByZXN1bHRzOiB7IHZhbHVlPzogUmVzdWx0OyBlcnJvcj86IEVycm9yIH1bXSA9IFtdO1xuICBwcm90ZWN0ZWQgcnVubmluZyA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgcnVubmluZ0NvdW50ID0gbmV3IFN0b3JlKDApO1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4+KCk7XG4gIHByb3RlY3RlZCBydW4oKSB7XG4gICAgaWYgKHRoaXMuYWJvcnRlZCA9PT0gZmFsc2UgJiYgdGhpcy5xdWV1ZUluZGV4IDwgdGhpcy5xdWV1ZS5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHsgZm4sIHRhZyB9ID0gdGhpcy5xdWV1ZVt0aGlzLnF1ZXVlSW5kZXgrK107XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGNvdW50ICsgMTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCBmbigpO1xuICAgICAgICAgIHRoaXMuc2VuZCh7IHZhbHVlLCB0YWcgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICBDb25zb2xlTG9nKGVycm9yKTtcbiAgICAgICAgICB0aGlzLnNlbmQoeyBlcnJvciwgdGFnIH0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucnVubmluZ0NvdW50LnVwZGF0ZSgoY291bnQpID0+IHtcbiAgICAgICAgICByZXR1cm4gY291bnQgLSAxO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuZGVsYXlfbXMgPCAwKSB7XG4gICAgICAgICAgdGhpcy5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgfSkoKTtcbiAgICAgIGlmICh0aGlzLmRlbGF5X21zID49IDApIHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLnJ1bigpLCB0aGlzLmRlbGF5X21zKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgfVxuICB9XG4gIHByb3RlY3RlZCBzZW5kKHJlc3VsdDogeyB2YWx1ZT86IFJlc3VsdDsgZXJyb3I/OiBFcnJvcjsgdGFnPzogVGFnIH0pIHtcbiAgICBpZiAodGhpcy5hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5jb21wbGV0aW9uQ291bnQrKztcbiAgICAgIHRoaXMucmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvciwgcmVzdWx0LnRhZyk/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IFN5bmNBc3luY0l0ZXJhYmxlIH0gZnJvbSAnLi9UeXBlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVJdGVyYXRvcjxJbiwgT3V0PiB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBmbjogKHZhbHVlOiBTeW5jQXN5bmNJdGVyYWJsZTxJbj4sIHB1c2g6ICh2YWx1ZTogU3luY0FzeW5jSXRlcmFibGU8SW4+KSA9PiB2b2lkKSA9PiBTeW5jQXN5bmNJdGVyYWJsZTxPdXQ+KSB7fVxuICBhc3luYyAqaXRlcmF0ZShpbml0OiBTeW5jQXN5bmNJdGVyYWJsZTxJbj4pOiBTeW5jQXN5bmNJdGVyYWJsZTxPdXQ+IHtcbiAgICBjb25zdCBsaXN0OiBTeW5jQXN5bmNJdGVyYWJsZTxJbj5bXSA9IFtpbml0XTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLmZuKGxpc3RbaV0sICh2YWx1ZSkgPT4ge1xuICAgICAgICBsaXN0LnB1c2godmFsdWUpO1xuICAgICAgfSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiLy8gSXNzdWVzIHdpdGggZmFsc2V5IGJyYW5jaC5cbi8vIGV4cG9ydCBmdW5jdGlvbiBIYXNNZXRob2Q8VCBleHRlbmRzIG9iamVjdCA9IG9iamVjdD4oaXRlbTogdW5rbm93biwga2V5OiBrZXlvZiBUKTogaXRlbSBpcyBUICYgUmVjb3JkPHR5cGVvZiBrZXksICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PiB7XG4vLyAgIHJldHVybiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAhPT0gbnVsbCAmJiBrZXkgaW4gaXRlbSAmJiB0eXBlb2YgKGl0ZW0gYXMgUmVjb3JkPHR5cGVvZiBrZXksIHVua25vd24+KVtrZXldID09PSAnZnVuY3Rpb24nO1xuLy8gfVxuZXhwb3J0IGZ1bmN0aW9uIEhhc01ldGhvZChpdGVtOiB1bmtub3duLCBrZXk6IHN0cmluZyk6IGl0ZW0gaXMgUmVjb3JkPHN0cmluZywgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+IHtcbiAgcmV0dXJuIHR5cGVvZiBpdGVtID09PSAnb2JqZWN0JyAmJiBpdGVtICE9PSBudWxsICYmIGtleSBpbiBpdGVtICYmIHR5cGVvZiAoaXRlbSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XSA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuLy8gRG9lcyBub3Qgc2VlbSB0byBoYXZlIHRoZSBzYW1lIGlzc3VlcyBhcyBhYm92ZVxuZXhwb3J0IGZ1bmN0aW9uIEhhc1Byb3BlcnR5PFQgZXh0ZW5kcyBvYmplY3QgPSBvYmplY3Q+KGl0ZW06IHVua25vd24sIGtleToga2V5b2YgVCk6IGl0ZW0gaXMgVCAmIFJlY29yZDx0eXBlb2Yga2V5LCAoLi4uYXJnczogYW55W10pID0+IGFueT4ge1xuICByZXR1cm4gdHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnICYmIGl0ZW0gIT09IG51bGwgJiYga2V5IGluIGl0ZW0gJiYgdHlwZW9mIChpdGVtIGFzIFJlY29yZDx0eXBlb2Yga2V5LCB1bmtub3duPilba2V5XSAhPT0gJ3VuZGVmaW5lZCc7XG59XG4iLAogICAgImltcG9ydCB7IEhhc01ldGhvZCB9IGZyb20gJy4uL1V0aWxpdHkvR3VhcmQuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gQ29tcGF0X0RhdGFUcmFuc2Zlckl0ZW0oaXRlbT86IERhdGFUcmFuc2Zlckl0ZW0pIHtcbiAgcmV0dXJuIHtcbiAgICBnZXRBc0VudHJ5KCk6IEV4Y2x1ZGU8UmV0dXJuVHlwZTxEYXRhVHJhbnNmZXJJdGVtWyd3ZWJraXRHZXRBc0VudHJ5J10+LCBudWxsPiB8IHVuZGVmaW5lZCB7XG4gICAgICBpZiAoSGFzTWV0aG9kKGl0ZW0sICdnZXRBc0VudHJ5JykpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0uZ2V0QXNFbnRyeSgpID8/IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIGlmIChIYXNNZXRob2QoaXRlbSwgJ3dlYmtpdEdldEFzRW50cnknKSkge1xuICAgICAgICByZXR1cm4gaXRlbS53ZWJraXRHZXRBc0VudHJ5KCkgPz8gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0QXNGaWxlKCk6IEV4Y2x1ZGU8UmV0dXJuVHlwZTxEYXRhVHJhbnNmZXJJdGVtWydnZXRBc0ZpbGUnXT4sIG51bGw+IHwgdW5kZWZpbmVkIHtcbiAgICAgIGlmIChIYXNNZXRob2QoaXRlbSwgJ2dldEFzRmlsZScpKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmdldEFzRmlsZSgpID8/IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldEFzU3RyaW5nKCk6IFByb21pc2U8UGFyYW1ldGVyczxFeGNsdWRlPFBhcmFtZXRlcnM8RGF0YVRyYW5zZmVySXRlbVsnZ2V0QXNTdHJpbmcnXT5bMF0sIG51bGw+PlswXSB8IHVuZGVmaW5lZD4ge1xuICAgICAgaWYgKEhhc01ldGhvZChpdGVtLCAnZ2V0QXNTdHJpbmcnKSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpdGVtLmdldEFzU3RyaW5nKHJlc29sdmUpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG4gICAgfSxcbiAgfTtcbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBOIH0gZnJvbSAnLi4vVXRpbGl0eS9UeXBlcy5qcyc7XG5pbXBvcnQgeyBDb21wYXRfRGF0YVRyYW5zZmVySXRlbSB9IGZyb20gJy4vRGF0YVRyYW5zZmVySXRlbS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3Ige1xuICBsaXN0OiBEYXRhVHJhbnNmZXJJdGVtW10gPSBbXTtcbiAgY29uc3RydWN0b3IoaXRlbXM/OiBOPERhdGFUcmFuc2Zlckl0ZW0+IHwgRGF0YVRyYW5zZmVySXRlbUxpc3QgfCBudWxsKSB7XG4gICAgaWYgKGl0ZW1zKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgICAgdGhpcy5saXN0ID0gaXRlbXM7XG4gICAgICB9IGVsc2UgaWYgKCdsZW5ndGgnIGluIGl0ZW1zKSB7XG4gICAgICAgIHRoaXMubGlzdCA9IEFycmF5LmZyb20oaXRlbXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5saXN0ID0gW2l0ZW1zXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEFzRW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGVudHJ5OiBGaWxlU3lzdGVtRW50cnkgfCB1bmRlZmluZWQgPSBDb21wYXRfRGF0YVRyYW5zZmVySXRlbShpdGVtKS5nZXRBc0VudHJ5KCk7XG4gICAgICBpZiAoZW50cnkpIHlpZWxkIGVudHJ5O1xuICAgIH1cbiAgfVxuICAqZ2V0QXNGaWxlKCk6IEdlbmVyYXRvcjxGaWxlPiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZmlsZTogRmlsZSB8IHVuZGVmaW5lZCA9IENvbXBhdF9EYXRhVHJhbnNmZXJJdGVtKGl0ZW0pLmdldEFzRmlsZSgpO1xuICAgICAgaWYgKGZpbGUpIHlpZWxkIGZpbGU7XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRBc1N0cmluZygpOiBBc3luY0dlbmVyYXRvcjxzdHJpbmc+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5saXN0KSB7XG4gICAgICBjb25zdCB0YXNrOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBhd2FpdCBDb21wYXRfRGF0YVRyYW5zZmVySXRlbShpdGVtKS5nZXRBc1N0cmluZygpO1xuICAgICAgaWYgKHRhc2spIHlpZWxkIHRhc2s7XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB7IEhhc1Byb3BlcnR5IH0gZnJvbSAnLi4vVXRpbGl0eS9HdWFyZC5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wYXRfRmlsZShmaWxlPzogRmlsZSkge1xuICByZXR1cm4ge1xuICAgIGdldCBsYXN0TW9kaWZpZWQoKTogRmlsZVsnbGFzdE1vZGlmaWVkJ10gfCB1bmRlZmluZWQge1xuICAgICAgcmV0dXJuIEhhc1Byb3BlcnR5KGZpbGUsICdsYXN0TW9kaWZpZWQnKSA/IGZpbGUubGFzdE1vZGlmaWVkIDogdW5kZWZpbmVkO1xuICAgIH0sXG4gICAgZ2V0IG5hbWUoKTogRmlsZVsnbmFtZSddIHwgdW5kZWZpbmVkIHtcbiAgICAgIHJldHVybiBIYXNQcm9wZXJ0eShmaWxlLCAnbmFtZScpID8gZmlsZS5uYW1lIDogdW5kZWZpbmVkO1xuICAgIH0sXG4gICAgZ2V0IHdlYmtpdFJlbGF0aXZlUGF0aCgpOiBGaWxlWyd3ZWJraXRSZWxhdGl2ZVBhdGgnXSB8IHVuZGVmaW5lZCB7XG4gICAgICByZXR1cm4gSGFzUHJvcGVydHkoZmlsZSwgJ3dlYmtpdFJlbGF0aXZlUGF0aCcpID8gZmlsZS53ZWJraXRSZWxhdGl2ZVBhdGggOiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgfTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgSGFzTWV0aG9kIH0gZnJvbSAnLi4vVXRpbGl0eS9HdWFyZC5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wYXRfRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KGVudHJ5PzogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KSB7XG4gIHJldHVybiB7XG4gICAgY3JlYXRlUmVhZGVyKCk6IFJldHVyblR5cGU8RmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5WydjcmVhdGVSZWFkZXInXT4gfCB1bmRlZmluZWQge1xuICAgICAgaWYgKEhhc01ldGhvZChlbnRyeSwgJ2NyZWF0ZVJlYWRlcicpKSB7XG4gICAgICAgIHJldHVybiBlbnRyeS5jcmVhdGVSZWFkZXIoKSA/PyB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcbiAgICBnZXREaXJlY3RvcnkocGF0aDogUGFyYW1ldGVyczxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbJ2dldERpcmVjdG9yeSddPlswXSwgb3B0aW9uczogUGFyYW1ldGVyczxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbJ2dldERpcmVjdG9yeSddPlsxXSk6IFByb21pc2U8UGFyYW1ldGVyczxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbJ2dldERpcmVjdG9yeSddPlsyXSB8IHVuZGVmaW5lZD4ge1xuICAgICAgaWYgKEhhc01ldGhvZChlbnRyeSwgJ2dldERpcmVjdG9yeScpKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgZW50cnkuZ2V0RGlyZWN0b3J5KHBhdGgsIG9wdGlvbnMsICgpID0+IHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuICAgIH0sXG4gICAgZ2V0RmlsZShwYXRoOiBQYXJhbWV0ZXJzPEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVsnZ2V0RmlsZSddPlswXSwgb3B0aW9uczogUGFyYW1ldGVyczxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbJ2dldEZpbGUnXT5bMV0pOiBQcm9taXNlPFBhcmFtZXRlcnM8RmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5WydnZXRGaWxlJ10+WzBdIHwgdW5kZWZpbmVkPiB7XG4gICAgICBpZiAoSGFzTWV0aG9kKGVudHJ5LCAnZ2V0RmlsZScpKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgZW50cnkuZ2V0RmlsZShwYXRoLCBvcHRpb25zLCAoKSA9PiByZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcbiAgICB9LFxuICB9O1xufVxuIiwKICAgICJpbXBvcnQgeyBIYXNNZXRob2QsIEhhc1Byb3BlcnR5IH0gZnJvbSAnLi4vVXRpbGl0eS9HdWFyZC5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wYXRfRmlsZVN5c3RlbUVudHJ5KGVudHJ5PzogRmlsZVN5c3RlbUVudHJ5KSB7XG4gIHJldHVybiB7XG4gICAgZ2V0IGZpbGVzeXN0ZW0oKTogRmlsZVN5c3RlbUVudHJ5WydmaWxlc3lzdGVtJ10gfCB1bmRlZmluZWQge1xuICAgICAgcmV0dXJuIEhhc1Byb3BlcnR5KGVudHJ5LCAnZmlsZXN5c3RlbScpID8gZW50cnkuZmlsZXN5c3RlbSA6IHVuZGVmaW5lZDtcbiAgICB9LFxuICAgIGdldCBmdWxsUGF0aCgpOiBGaWxlU3lzdGVtRW50cnlbJ2Z1bGxQYXRoJ10gfCB1bmRlZmluZWQge1xuICAgICAgcmV0dXJuIEhhc1Byb3BlcnR5KGVudHJ5LCAnZnVsbFBhdGgnKSA/IGVudHJ5LmZ1bGxQYXRoIDogdW5kZWZpbmVkO1xuICAgIH0sXG4gICAgZ2V0IGlzRGlyZWN0b3J5KCk6IEZpbGVTeXN0ZW1FbnRyeVsnaXNEaXJlY3RvcnknXSB8IHVuZGVmaW5lZCB7XG4gICAgICByZXR1cm4gSGFzUHJvcGVydHkoZW50cnksICdpc0RpcmVjdG9yeScpID8gZW50cnkuaXNEaXJlY3RvcnkgOiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgICBnZXQgaXNGaWxlKCk6IEZpbGVTeXN0ZW1FbnRyeVsnaXNGaWxlJ10gfCB1bmRlZmluZWQge1xuICAgICAgcmV0dXJuIEhhc1Byb3BlcnR5KGVudHJ5LCAnaXNGaWxlJykgPyBlbnRyeS5pc0ZpbGUgOiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgICBnZXQgbmFtZSgpOiBGaWxlU3lzdGVtRW50cnlbJ25hbWUnXSB8IHVuZGVmaW5lZCB7XG4gICAgICByZXR1cm4gSGFzUHJvcGVydHkoZW50cnksICduYW1lJykgPyBlbnRyeS5uYW1lIDogdW5kZWZpbmVkO1xuICAgIH0sXG4gICAgZ2V0UGFyZW50KCk6IFByb21pc2U8UGFyYW1ldGVyczxFeGNsdWRlPFBhcmFtZXRlcnM8RmlsZVN5c3RlbUVudHJ5WydnZXRQYXJlbnQnXT5bMF0sIHVuZGVmaW5lZD4+WzBdIHwgdW5kZWZpbmVkPiB7XG4gICAgICBpZiAoSGFzTWV0aG9kKGVudHJ5LCAnZ2V0UGFyZW50JykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBlbnRyeS5nZXRQYXJlbnQocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG4gICAgfSxcbiAgfTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgQ29tcGF0X0ZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSB9IGZyb20gJy4vRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5LmpzJztcbmltcG9ydCB7IENvbXBhdF9GaWxlU3lzdGVtRW50cnkgfSBmcm9tICcuL0ZpbGVTeXN0ZW1FbnRyeS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB7XG4gIGxpc3Q6IEZpbGVTeXN0ZW1FbnRyeVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGVudHJpZXM/OiBGaWxlU3lzdGVtRW50cnkgfCBGaWxlU3lzdGVtRW50cnlbXSB8IG51bGwpIHtcbiAgICBpZiAoZW50cmllcykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgICAgdGhpcy5saXN0ID0gZW50cmllcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldERpcmVjdG9yeUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgaWYgKENvbXBhdF9GaWxlU3lzdGVtRW50cnkoZW50cnkpLmlzRGlyZWN0b3J5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5IGFzIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEZpbGVFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUZpbGVFbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBpZiAoQ29tcGF0X0ZpbGVTeXN0ZW1FbnRyeShlbnRyeSkuaXNGaWxlKSB7XG4gICAgICAgIHlpZWxkIGVudHJ5IGFzIEZpbGVTeXN0ZW1GaWxlRW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvciB7XG4gIGxpc3Q6IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGVudHJpZXM/OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkgfCBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbXSB8IG51bGwpIHtcbiAgICBpZiAoZW50cmllcykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgICAgdGhpcy5saXN0ID0gZW50cmllcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKmdldEVudHJ5KCk6IEFzeW5jR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBjb25zdCByZWFkZXIgPSBDb21wYXRfRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KGVudHJ5KS5jcmVhdGVSZWFkZXIoKTtcbiAgICAgIGlmIChyZWFkZXIpIHtcbiAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBhd2FpdCBuZXcgUHJvbWlzZTxGaWxlU3lzdGVtRW50cnlbXT4oKHJlc29sdmUsIHJlamVjdCkgPT4gcmVhZGVyLnJlYWRFbnRyaWVzKHJlc29sdmUsIHJlamVjdCkpKSB7XG4gICAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIElzRGV2aWNlTW9iaWxlKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gL2FuZHJvaWR8aXBob25lfG1vYmlsZS9pLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpO1xufVxuIiwKICAgICJpbXBvcnQgeyBIYXNQcm9wZXJ0eSB9IGZyb20gJy4uL1V0aWxpdHkvR3VhcmQuanMnO1xuaW1wb3J0IHsgSXNEZXZpY2VNb2JpbGUgfSBmcm9tICcuL0RldmljZS5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wYXRfSFRNTElucHV0RWxlbWVudChpbnB1dD86IEhUTUxJbnB1dEVsZW1lbnQpIHtcbiAgcmV0dXJuIHtcbiAgICBnZXQgd2Via2l0RW50cmllcygpOiBIVE1MSW5wdXRFbGVtZW50Wyd3ZWJraXRFbnRyaWVzJ10gfCB1bmRlZmluZWQge1xuICAgICAgcmV0dXJuIEhhc1Byb3BlcnR5KGlucHV0LCAnd2Via2l0RW50cmllcycpID8gaW5wdXQud2Via2l0RW50cmllcyA6IHVuZGVmaW5lZDtcbiAgICB9LFxuICAgIGdldCB3ZWJraXRkaXJlY3RvcnkoKTogSFRNTElucHV0RWxlbWVudFsnd2Via2l0ZGlyZWN0b3J5J10gfCB1bmRlZmluZWQge1xuICAgICAgcmV0dXJuIEhhc1Byb3BlcnR5KGlucHV0LCAnd2Via2l0ZGlyZWN0b3J5JykgPyBpbnB1dC53ZWJraXRkaXJlY3RvcnkgOiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIElzV2Via2l0RGlyZWN0b3J5U3VwcG9ydGVkKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gSXNEZXZpY2VNb2JpbGUoKSA/IGZhbHNlIDogdHJ1ZTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU2xlZXAgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL0FsZ29yaXRobS9TbGVlcC5qcyc7XG5pbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9Kb2JRdWV1ZS5qcyc7XG5pbXBvcnQgeyBSZWN1cnNpdmVJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9SZWN1cnNpdmVBc3luY0l0ZXJhdG9yLmpzJztcbmltcG9ydCB0eXBlIHsgU3luY0FzeW5jSXRlcmFibGUgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvVHlwZXMuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0RhdGFUcmFuc2Zlckl0ZW1fVXRpbGl0eS5qcyc7XG5pbXBvcnQgeyBDb21wYXRfRmlsZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvV2ViIEFQSS9GaWxlLmpzJztcbmltcG9ydCB7IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yLCBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvV2ViIEFQSS9GaWxlU3lzdGVtX1V0aWxpdHkuanMnO1xuaW1wb3J0IHsgQ29tcGF0X0hUTUxJbnB1dEVsZW1lbnQsIElzV2Via2l0RGlyZWN0b3J5U3VwcG9ydGVkIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0hUTUxJbnB1dEVsZW1lbnQuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gIGNvbnRhaW5lcjogRWxlbWVudCxcbiAgZm46IHtcbiAgICBvbkRyYWdFbmQ/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0VudGVyPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyYWdMZWF2ZT86ICgpID0+IHZvaWQ7XG4gICAgb25Ecm9wPzogKCkgPT4gdm9pZDtcbiAgICBvblVwbG9hZEVuZD86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuICAgIG9uVXBsb2FkRXJyb3I/OiAoZXJyb3I6IGFueSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG4gICAgb25VcGxvYWROZXh0RmlsZTogKGZpbGU6IEZpbGUsIGRvbmU6ICgpID0+IHZvaWQpID0+IFByb21pc2U8dm9pZD4gfCB2b2lkO1xuICAgIG9uVXBsb2FkU3RhcnQ/OiAoKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiAgfSxcbiAgb3B0aW9ucz86IHtcbiAgICBhY2NlcHQ/OiBzdHJpbmc7XG4gICAgZGlyZWN0b3J5PzogYm9vbGVhbjtcbiAgICBtdWx0aXBsZT86IGJvb2xlYW47XG4gIH0sXG4pIHtcbiAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpO1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyAnZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlciBpbnB1dCBlbGVtZW50IG1pc3NpbmcnO1xuICB9XG4gIGlmIChvcHRpb25zPy5hY2NlcHQpIHtcbiAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnYWNjZXB0Jywgb3B0aW9ucy5hY2NlcHQpO1xuICB9XG4gIGlmIChvcHRpb25zPy5kaXJlY3RvcnkgPT09IHRydWUgJiYgSXNXZWJraXREaXJlY3RvcnlTdXBwb3J0ZWQoKSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCd3ZWJraXRkaXJlY3RvcnknLCB0cnVlKTtcbiAgfVxuICBpZiAob3B0aW9ucz8ubXVsdGlwbGUgPT09IHRydWUpIHtcbiAgICBlbGVtZW50LnRvZ2dsZUF0dHJpYnV0ZSgnbXVsdGlwbGUnLCB0cnVlKTtcbiAgfVxuXG4gIGlmIChmbi5vbkRyYWdFbmQgfHwgZm4ub25EcmFnRW50ZXIgfHwgZm4ub25EcmFnTGVhdmUpIHtcbiAgICBjb25zdCByZW1vdmVMaXN0ZW5lcnMgPSAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgIH07XG4gICAgY29uc3QgZHJhZ2VuZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0VuZD8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnbGVhdmVIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyYWdMZWF2ZT8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcm9wSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25Ecm9wPy4oKTtcbiAgICB9O1xuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgKCkgPT4ge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBkcmFnbGVhdmVIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyb3BIYW5kbGVyKTtcbiAgICAgIGZuLm9uRHJhZ0VudGVyPy4oKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGZTRW50cnlTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgZlNFbnRyeUl0ZXJhdG9yID0gbmV3IFJlY3Vyc2l2ZUl0ZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeSwgRmlsZVN5c3RlbUZpbGVFbnRyeT4oYXN5bmMgZnVuY3Rpb24qIChmU0VudHJ5SXRlcmF0b3IsIHB1c2gpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yKSB7XG4gICAgICBjb25zdCBwYXRoID0gZlNFbnRyeS5mdWxsUGF0aC5zbGljZSgxKTtcbiAgICAgIGlmICghZlNFbnRyeVNldC5oYXMocGF0aCkpIHtcbiAgICAgICAgZlNFbnRyeVNldC5hZGQocGF0aCk7XG4gICAgICAgIGNvbnN0IGZzRW50cmllcyA9IG5ldyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvcihmU0VudHJ5KTtcbiAgICAgICAgZm9yIChjb25zdCBmU0ZpbGVFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RmlsZUVudHJ5KCkpIHtcbiAgICAgICAgICB5aWVsZCBmU0ZpbGVFbnRyeTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZTRGlyZWN0b3J5RW50cnkgb2YgZnNFbnRyaWVzLmdldERpcmVjdG9yeUVudHJ5KCkpIHtcbiAgICAgICAgICBwdXNoKG5ldyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvcihmU0RpcmVjdG9yeUVudHJ5KS5nZXRFbnRyeSgpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgY29uc3Qgam9iUXVldWUgPSBuZXcgSm9iUXVldWU8dm9pZCwgc3RyaW5nPigtMSk7XG4gIGpvYlF1ZXVlLnN1YnNjcmliZSgoXywgZXJyb3IpID0+IHtcbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIGZuPy5vblVwbG9hZEVycm9yPy4oZXJyb3IpO1xuICAgIH1cbiAgfSk7XG5cbiAgbGV0IGRvbmUgPSB0cnVlO1xuICBsZXQgcnVubmluZyA9IGZhbHNlO1xuICBjb25zdCB1cGxvYWRTdGFydCA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAocnVubmluZyA9PT0gZmFsc2UpIHtcbiAgICAgIGRvbmUgPSBmYWxzZTtcbiAgICAgIHJ1bm5pbmcgPSB0cnVlO1xuICAgICAgYXdhaXQgZm4ub25VcGxvYWRTdGFydD8uKCk7XG4gICAgICAvLyBnaXZlIGJyb3dzZXIgc29tZSB0aW1lIHRvIHF1ZXVlIGJvdGggZXZlbnRzXG4gICAgICBTbGVlcCg1MDApLnRoZW4oYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBqb2JRdWV1ZS5kb25lO1xuICAgICAgICB1cGxvYWRFbmQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgdXBsb2FkRW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGRvbmUgPSB0cnVlO1xuICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICBhd2FpdCBmbi5vblVwbG9hZEVuZD8uKCk7XG4gICAgam9iUXVldWUucmVzZXQoKTtcbiAgICBmU0VudHJ5U2V0LmNsZWFyKCk7XG4gIH07XG4gIGNvbnN0IGl0ZXJhdGVGU0VudHJpZXMgPSBhc3luYyAoZW50cmllczogU3luY0FzeW5jSXRlcmFibGU8RmlsZVN5c3RlbUVudHJ5PiwgZmlsZXM6IEZpbGVMaXN0KSA9PiB7XG4gICAgaWYgKGRvbmUgPT09IGZhbHNlKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZTRW50cnlJdGVyYXRvci5pdGVyYXRlKGVudHJpZXMpKSB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBuZXcgUHJvbWlzZTxGaWxlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiBmU0ZpbGVFbnRyeS5maWxlKHJlc29sdmUsIHJlamVjdCkpO1xuICAgICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcbiAgICAgICAgYXdhaXQgZm4ub25VcGxvYWROZXh0RmlsZShmaWxlLCAoKSA9PiAoZG9uZSA9IHRydWUpKTtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgIGNvbnN0IHBhdGggPSBDb21wYXRfRmlsZShmaWxlKS53ZWJraXRSZWxhdGl2ZVBhdGggKyBmaWxlLm5hbWU7XG4gICAgICAgIGlmICghZlNFbnRyeVNldC5oYXMocGF0aCkpIHtcbiAgICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgICBpZiAoZmlsZS5zaXplID4gMCkge1xuICAgICAgICAgICAgYXdhaXQgZm4ub25VcGxvYWROZXh0RmlsZShmaWxlLCAoKSA9PiAoZG9uZSA9IHRydWUpKTtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGlmIChkb25lID09PSB0cnVlKSByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBjb25zdCBjaGFuZ2VIYW5kbGVyID0gKCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGRvbmUgPT09IGZhbHNlICYmIGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmIGVsZW1lbnQuZmlsZXMpIHtcbiAgICAgICAgYXdhaXQgaXRlcmF0ZUZTRW50cmllcyhDb21wYXRfSFRNTElucHV0RWxlbWVudChlbGVtZW50KS53ZWJraXRFbnRyaWVzID8/IFtdLCBlbGVtZW50LmZpbGVzKTtcbiAgICAgIH1cbiAgICB9LCAnY2hhbmdlSGFuZGxlcicpO1xuICB9O1xuICBjb25zdCBkcm9wSGFuZGxlciA9IChldmVudDogRHJhZ0V2ZW50KSA9PiB7XG4gICAgam9iUXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHVwbG9hZFN0YXJ0KCk7XG4gICAgICBpZiAoZG9uZSA9PT0gZmFsc2UgJiYgZXZlbnQuZGF0YVRyYW5zZmVyKSB7XG4gICAgICAgIGNvbnN0IGRhdGFUcmFuc2Zlckl0ZW1zID0gbmV3IERhdGFUcmFuc2Zlckl0ZW1JdGVyYXRvcihldmVudC5kYXRhVHJhbnNmZXIuaXRlbXMpO1xuICAgICAgICBhd2FpdCBpdGVyYXRlRlNFbnRyaWVzKGRhdGFUcmFuc2Zlckl0ZW1zLmdldEFzRW50cnkoKSwgZXZlbnQuZGF0YVRyYW5zZmVyLmZpbGVzKTtcbiAgICAgIH1cbiAgICB9LCAnZHJvcEhhbmRsZXInKTtcbiAgfTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyKTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xufVxuIgogIF0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLGVBQXNCLEtBQUssQ0FBQyxJQUFZO0FBQ3RDLFFBQU0sSUFBSSxRQUFRLENBQUMsWUFBWSxXQUFXLFNBQVMsRUFBRSxDQUFDO0FBQUE7OztBQ0VqRCxNQUFNLE1BQWE7QUFBQSxFQUVGO0FBQUEsRUFEWixrQkFBa0IsSUFBSTtBQUFBLEVBQ2hDLFdBQVcsQ0FBVyxPQUFlO0FBQWY7QUFBQTtBQUFB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
