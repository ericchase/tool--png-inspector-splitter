import { Sleep } from '../../lib/ericchase/Algorithm/Sleep.js';
import { JobQueue } from '../../lib/ericchase/Utility/JobQueue.js';
import { RecursiveIterator } from '../../lib/ericchase/Utility/RecursiveAsyncIterator.js';
import type { SyncAsyncIterable } from '../../lib/ericchase/Utility/Type.js';
import { DataTransferItemIterator } from '../../lib/ericchase/Web API/DataTransfer.js';
import { FileSystemDirectoryEntryIterator, FileSystemEntryIterator } from '../../lib/ericchase/Web API/FileSystem.js';
import { GetWebkitEntries, GetWebkitRelativePath, SupportsWebkitDirectory } from '../../lib/ericchase/Web API/HTMLInputElement.js';

export function setupDragAndDropFilePicker(
  container: Element,
  fn: {
    onDragEnd?: () => void;
    onDragEnter?: () => void;
    onDragLeave?: () => void;
    onDrop?: () => void;
    onUploadEnd?: () => void | Promise<void>;
    onUploadError?: (error: any) => void | Promise<void>;
    onUploadNextFile: (file: File, done: () => void) => Promise<void> | void;
    onUploadStart?: () => void | Promise<void>;
  },
  options?: {
    accept?: string;
    directory?: boolean;
    multiple?: boolean;
  },
) {
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
      element.addEventListener('drop', dropHandler);
    };
    const dragendHandler = () => {
      removeListeners();
      fn.onDragEnd?.();
    };
    const dragleaveHandler = () => {
      removeListeners();
      fn.onDragLeave?.();
    };
    const dropHandler = () => {
      removeListeners();
      fn.onDrop?.();
    };
    element.addEventListener('dragenter', () => {
      element.addEventListener('dragleave', dragleaveHandler);
      element.addEventListener('dragend', dragendHandler);
      element.addEventListener('drop', dropHandler);
      fn.onDragEnter?.();
    });
  }

  const fSEntrySet = new Set<string>();
  const fSEntryIterator = new RecursiveIterator<FileSystemEntry, FileSystemFileEntry>(async function* (fSEntryIterator, push) {
    for await (const fSEntry of fSEntryIterator) {
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

  const jobQueue = new JobQueue<void, string>(-1);
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
      // give browser some time to queue both events
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
  const iterateFSEntries = async (entries: SyncAsyncIterable<FileSystemEntry>, files: FileList) => {
    if (done === false) {
      for await (const fSFileEntry of fSEntryIterator.iterate(entries)) {
        const file = await new Promise<File>((resolve, reject) => fSFileEntry.file(resolve, reject));
        await fn.onUploadNextFile(file, () => (done = true));
        // @ts-ignore
        if (done === true) return;
      }
      for (const file of files) {
        const path = GetWebkitRelativePath(file) + file.name;
        if (!fSEntrySet.has(path)) {
          fSEntrySet.add(path);
          await fn.onUploadNextFile(file, () => (done = true));
          // @ts-ignore
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
  const dropHandler = (event: DragEvent) => {
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
