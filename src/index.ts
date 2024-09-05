import { RecursiveAsyncIterator } from './lib/ericchase/Utility/RecursiveAsyncIterator.js';
import { FileSystemDirectoryEntryIterator, FileSystemEntryIterator } from './lib/ericchase/Web API/FileSystem.js';

const file_pickers = document.querySelectorAll('.drag-and-drop-file-picker > input');
const el_main = document.querySelector('main');

function main() {
  if (!(el_main instanceof HTMLElement)) throw 'main tag missing';

  document.documentElement.addEventListener('dragover', dragOverHandler);
  for (const picker of file_pickers) {
    if (picker instanceof HTMLInputElement) {
      picker.addEventListener('change', changeHandler, { passive: true });
      picker.addEventListener('drop', dropHandler, { passive: true });
    }
  }
}

const fSEntryIterator = new RecursiveAsyncIterator<FileSystemEntry, FileSystemFileEntry>(async function* (fSEntryIterator, push) {
  for await (const fSEntry of fSEntryIterator) {
    const fsEntries = new FileSystemEntryIterator(fSEntry);
    for (const fSFileEntry of fsEntries.getFileEntry()) {
      yield fSFileEntry;
    }
    for (const fSDirectoryEntry of fsEntries.getDirectoryEntry()) {
      push(new FileSystemDirectoryEntryIterator(fSDirectoryEntry).getEntry());
    }
  }
});

async function changeHandler(event: Event) {
  // webkitdirectory is not available on firefox android
  console.log('changeHandler');
  console.log(event.target);
  if (event.target instanceof HTMLInputElement && event.target.files) {
    console.log('files');
    Array.from(event.target.files).forEach((_) => console.log(_));

    console.log('webkitEntries');
    Array.from(event.target.webkitEntries).forEach((_) => console.log(_));

    // // elPrompt.remove();
    // // elMain.replaceChildren();
    // // showImages(Array.from(event.target.files));
    // console.log('from event.target.files');
    // if (event.target.webkitdirectory === true && event.target.webkitEntries) {
    //   console.log('webkitdirectory && webkitEntries');
    //   console.log(...event.target.webkitEntries);
    //   for await (const fSFileEntry of fSEntryIterator.iterate(event.target.webkitEntries)) {
    //     console.log({ fSFileEntry });
    //   }
    // } else {
    //   console.log('files');
    //   console.log(...event.target.files);
    //   for (const file of event.target.files) {
    //     console.log({ file });
    //   }
    // }
  }
}

async function dropHandler(event: DragEvent) {
  console.log('dropHandler');
  console.log(event.target);
  if (event.dataTransfer) {
    console.log('files');
    Array.from(event.dataTransfer.files).forEach(async (_) => {
      console.log(_);
    });

    console.log('items');
    Array.from(event.dataTransfer.items).forEach((_) => console.log(_));
    // const dataTransferItems = new DataTransferItemIterator(event.dataTransfer.items);
    // for await (const fSFileEntry of fSEntryIterator.iterate(dataTransferItems.getAsEntry())) {
    //   console.log({ fSFileEntry });
    // }

    // elMain.replaceChildren();
    // elPrompt.remove();
    // for await (const file of get_Files_from_FSEntries(fSEntries)) {
    //   console.log(...U8SToHex(await file.bytes()));
    // }
    //
    // console.log('from event.dataTransfer.files');
    // for (const file of event.dataTransfer.files) {
    //   console.log(...U8SToHex(await file.bytes()));
    // }
    //
  }
}

function dragOverHandler(event: Event) {
  event.preventDefault();
}

//
//
//

const showImages = (fileList: File[]) => {
  for (const file of fileList) {
    const div = document.createElement('div');
    const img = document.createElement('img');
    img.onerror = function () {
      div.remove();
    };
    img.src = URL.createObjectURL(file);
    div.append(img);
    el_main.append(div);
  }
};

async function* fSDirectoryEntry_readEntries(fSDirectoryEntry: FileSystemDirectoryEntry): AsyncGenerator<FileSystemEntry> {
  const reader = fSDirectoryEntry.createReader();
  while (true) {
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (entries.length === 0) {
      break; // done
    }
    for (const entry of entries) {
      yield entry;
    }
  }
}

async function* get_Files_from_FSEntries(fSEntries?: FileSystemEntry[]) {
  if (fSEntries) {
    while (fSEntries.length > 0) {
      const { fSDirectoryEntries, fSFileEntries } = group_FSEntries(fSEntries);
      const get_fSEntries_job = get_FSEntries_from_FSDirectoryEntries(fSDirectoryEntries);
      for (const file of await get_Files_from_FSFileEntries(fSFileEntries)) {
        yield file;
      }
      fSEntries = await get_fSEntries_job;
    }
  }
}

async function get_Files_from_FSFileEntries(fSFileEntries: FileSystemFileEntry[]) {
  const jobs: Promise<File>[] = [];
  for (const entry of fSFileEntries) {
    jobs.push(new Promise<File>((resolve, reject) => entry.file(resolve, reject)));
  }
  const files: File[] = [];
  for (const result of await Promise.allSettled(jobs)) {
    if (result.status === 'fulfilled') {
      files.push(result.value);
    }
  }
  return files;
}

async function get_FSEntries_from_FSDirectoryEntries(fSDirectoryEntries: FileSystemDirectoryEntry[]) {
  const jobs: Promise<FileSystemEntry[]>[] = [];
  for (const entry of fSDirectoryEntries) {
    jobs.push(Array.fromAsync(fSDirectoryEntry_readEntries(entry)));
  }
  const fSEntries = [];
  for (const result of await Promise.allSettled(jobs)) {
    if (result.status === 'fulfilled') {
      fSEntries.push(...result.value);
    }
  }
  return fSEntries;
}

function group_FSEntries(fSEntries: FileSystemEntry[]) {
  const fSDirectoryEntries: FileSystemDirectoryEntry[] = [];
  const fSFileEntries: FileSystemFileEntry[] = [];
  for (const entry of fSEntries ?? []) {
    if (entry.isDirectory && entry instanceof FileSystemDirectoryEntry) {
      fSDirectoryEntries.push(entry);
    }
    if (entry.isFile && entry instanceof FileSystemFileEntry) {
      fSFileEntries.push(entry);
    }
  }
  return { fSDirectoryEntries, fSFileEntries };
}

main();
