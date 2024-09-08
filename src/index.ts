import { setupDragAndDropFilePicker } from './components/drag-and-drop-file-picker/drag-and-drop-file-picker.js';
import { U8ToHex } from './lib/ericchase/Algorithm/Array/Uint8Array.js';
import { ConsoleError } from './lib/ericchase/Utility/Console.js';
import type { N } from './lib/ericchase/Utility/Types.js';
import { Compat_Blob } from './lib/ericchase/Web API/Blob.js';
import { ReadSome } from './lib/ericchase/Web API/Blob_Utility.js';
import { Compat_File } from './lib/ericchase/Web API/File.js';
import { PNGInspect } from './lib/png-inspect.js';
import { PNGSplit } from './lib/png-split.js';

class PageControl {
  buttonContainer: Element;
  filePicker: Element;
  imageViewer: Element;
  inspectButton: HTMLButtonElement;
  outputContainer: Element;
  sizeInput: HTMLInputElement;
  splitButton: HTMLButtonElement;

  constructor() {
    const button_container = document.querySelector('#edit-button-container');
    const file_picker = document.querySelector('#file-picker');
    const image_viewer = document.querySelector('#image-viewer');
    const inspect_button = document.querySelector('#btn-inspect');
    const output_container = document.querySelector('#output-container');
    const size_input = document.querySelector('#split-size');
    const split_button = document.querySelector('#btn-split');

    // sanity check
    if (!button_container) throw '#edit-button-container missing';
    if (!file_picker) throw '#file-picker missing';
    if (!image_viewer) throw '#image-viewer missing';
    if (!(inspect_button instanceof HTMLButtonElement)) throw '#btn-inspect not html button element';
    if (!output_container) throw '#output-container missing;';
    if (!(size_input instanceof HTMLInputElement)) throw '#split-size not html input element';
    if (!(split_button instanceof HTMLButtonElement)) throw '#btn-split not html button element';

    this.buttonContainer = button_container;
    this.filePicker = file_picker;
    this.imageViewer = image_viewer;
    this.inspectButton = inspect_button;
    this.outputContainer = output_container;
    this.sizeInput = size_input;
    this.splitButton = split_button;

    // setup
    this.inspectButton.addEventListener('click', () => this.inspectButton_clickHandler());
    this.splitButton.addEventListener('click', () => this.splitButton_clickHandler());
    this.reset();
  }

  reset() {
    this.editButtons_reset();
    this.filePicker_reset();
    this.imageViewer_reset();
    this.outputContainer_reset();
    this.sizeInput_reset();
  }

  editButtons_disable() {
    // const buttons = this.buttonContainer.querySelectorAll('button');
    // for (const button of buttons ?? []) {
    //   button.disabled = true;
    // }
  }
  inspectButton_disable() {
    // this.inspectButton.disabled = true;
  }
  splitButton_disable() {
    // this.splitButton.disabled = true;
  }
  editButtons_enable() {
    // const buttons = this.buttonContainer.querySelectorAll('button');
    // for (const button of buttons ?? []) {
    //   button.disabled = false;
    // }
  }
  editButtons_reset() {
    // this.editButtons_disable();
  }
  async inspectButton_clickHandler() {
    try {
      this.inspectButton_disable();
      const bytes = await Compat_Blob(selected_file).bytes();
      if (bytes) {
        const logs: string[] = [];
        PNGInspect(bytes, (data: any[] = []) => {
          logs.push(data.join(' '));
        });
        this.addTextsToOutput(logs);
        this.addTextsToOutput([`Inspection report for "${Compat_File(selected_file).name}"`]);
      }
    } catch (error) {
      ConsoleError(error);
    }
  }
  async splitButton_clickHandler() {
    try {
      this.splitButton_disable();
      const bytes = await Compat_Blob(selected_file).bytes();
      if (bytes) {
        const split_size = this.sizeInput_getSize();
        const split_buffers = await PNGSplit(bytes, split_size);
        await this.addImagesToOutput(split_buffers);
        this.addTextsToOutput([`Split results for "${Compat_File(selected_file).name}"`, '', `Size: ${split_size}`]);
      }
    } catch (error) {
      ConsoleError(error);
    }
  }

  filePicker_setHover(on = true) {
    if (on) this.filePicker.classList.add('hover');
    else this.filePicker.classList.remove('hover');
  }
  filePicker_setQuietMode(on = true) {
    if (on) this.filePicker.classList.add('quiet-mode');
    else this.filePicker.classList.remove('quiet-mode');
  }
  filePicker_reset() {
    this.filePicker.classList.remove('hover');
    this.filePicker.classList.remove('quiet-mode');
  }

  imageViewer_displayImage(img: HTMLImageElement) {
    if (!this.imageViewer.classList.contains('image-loaded')) {
      const gaps = document.querySelectorAll('.image-viewer-gap');
      for (const gap of gaps ?? []) gap.classList.remove('remove');
      this.imageViewer.classList.add('image-loaded');
    }
    this.imageViewer.querySelector('img')?.remove();
    this.imageViewer.appendChild(img);
  }
  imageViewer_reset() {
    const gaps = document.querySelectorAll('.image-viewer-gap');
    for (const gap of gaps ?? []) gap.classList.add('remove');
    this.imageViewer.classList.remove('image-loaded');
    this.imageViewer.querySelector('img')?.remove();
  }

  outputContainer_prepend(element: Element) {
    this.outputContainer.prepend(element);
  }
  outputContainer_show() {
    if (this.outputContainer.classList.contains('remove')) {
      const gaps = document.querySelectorAll('.output-container-gap');
      for (const gap of gaps ?? []) gap.classList.remove('remove');
      this.outputContainer.classList.remove('remove');
    }
  }
  outputContainer_reset() {
    const gaps = document.querySelectorAll('.output-container-gap');
    for (const gap of gaps ?? []) gap.classList.add('remove');
    this.outputContainer.classList.add('remove');
  }

  sizeInput_getSize() {
    return Number.parseInt(this.sizeInput.value) ?? 250;
  }
  sizeInput_reset() {
    this.sizeInput.value = '250';
  }

  async addImagesToOutput(buffers: Uint8Array[]) {
    try {
      // create images
      const imgs = [];
      for (const buffer of buffers) {
        try {
          const url = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
          const img = await loadImage_fromUrl(url);
          imgs.push(img);
        } catch (error) {
          ConsoleError(error);
          this.addTextsToOutput(error as any, true);
        }
      }
      // prepend images to output container
      for (const img of imgs.reverse()) {
        this.outputContainer_prepend(img);
      }
      this.outputContainer_show();
      // scroll top image into view
      imgs.at(-1)?.scrollIntoView(false);
    } catch (error) {
      ConsoleError(error);
    }
  }
  addTextsToOutput(texts: N<string>, is_error = false) {
    try {
      // ensure data is an array
      if (!Array.isArray(texts)) {
        texts = [texts];
      }
      // build the output structure
      const div_outer = document.createElement('div');
      const div_inner = document.createElement('div');
      const pre = document.createElement('pre');
      pre.textContent = texts.join('\n');
      if (is_error) {
        pre.classList.add('error-message');
        const delete_button = document.createElement('div');
        delete_button.classList.add('delete-output');
        delete_button.textContent = 'X';
        div_inner.appendChild(delete_button);
        delete_button.addEventListener('click', () => {
          div_outer.remove();
        });
      }
      div_inner.appendChild(pre);
      div_outer.appendChild(div_inner);
      // prepend to output container
      this.outputContainer_prepend(div_outer);
      this.outputContainer_show();
      // scroll div into view
      div_outer.scrollIntoView(false);
      return div_outer;
    } catch (error) {
      ConsoleError(error);
    }
  }
}

// ! one day use EventManager
document.documentElement.addEventListener('dragover', (event) => event.preventDefault());

let selected_file: File | undefined = undefined;
const page = new PageControl();

const onDragEnd = () => {
  page.filePicker_setHover(false);
};
setupDragAndDropFilePicker(
  page.filePicker,
  {
    onDragEnter() {
      page.filePicker_setHover(true);
    },
    onDragLeave: onDragEnd,
    onDragEnd: onDragEnd,
    onDrop: onDragEnd,
    onUploadStart() {
      selected_file = undefined;
    },
    async onUploadNextFile(file, done) {
      try {
        if (U8ToHex(await ReadSome(file, 8)).join('') !== '89504e470d0a1a0a') {
          throw `Error: Could not process "${file.name}".\nPlease upload PNG only.`;
        }
        // if (file.type !== 'image/png') {
        //   throw `Error: Could not process "${file.name}".\nPlease upload PNG only.`;
        // }
        const img = await loadImage_fromFile(file);
        page.addTextsToOutput(`Successfully loaded "${file.name}"`);
        page.editButtons_enable();
        page.filePicker_setQuietMode();
        page.imageViewer_displayImage(img);
        selected_file = file;
        done();
      } catch (error) {
        ConsoleError(error);
        page.addTextsToOutput(error as any, true);
        page.editButtons_reset();
        page.filePicker_reset();
        page.imageViewer_reset();
      }
    },
    onUploadEnd() {
      if (selected_file === undefined) {
        page.editButtons_reset();
        page.filePicker_reset();
        page.imageViewer_reset();
      }
    },
    onUploadError(error) {
      ConsoleError(error);
      page.addTextsToOutput(error, true);
    },
  },
  {
    accept: '.png', // won't work on mobile
    directory: true,
  },
);

function loadImage_fromFile(file: File): Promise<HTMLImageElement> {
  return loadImage_fromUrl(URL.createObjectURL(file));
}
function loadImage_fromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = document.createElement('img');
    img.src = url;
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
  });
}

// Useful Utility Logging Functions

// function LogCall() {
//   ConsoleLog('Call Stack');
//   for (const fn of new Error().stack?.split('\n').slice(1, 4) ?? []) {
//     ConsoleLog(' -', fn.slice(0, fn.indexOf('@http')));
//   }
//   ConsoleLog('...');
//   ConsoleLog();
// }

// function LogToPage(item: any) {
//   const entry_point = document.querySelector('.entry-point');
//   if (Array.isArray(item)) {
//     for (const key in item) {
//       if (Array.isArray(item[key])) {
//         for (const key2 in item[key]) {
//           const div = document.createElement('div');
//           div.textContent = `${key2}: ${item[key][key2]}`;
//           entry_point?.appendChild(div);
//         }
//       } else if (typeof item[key] !== 'function') {
//         const div = document.createElement('div');
//         div.textContent = `${key}: ${item[key]}`;
//         entry_point?.appendChild(div);
//       }
//     }
//   } else {
//     const div = document.createElement('div');
//     div.textContent = item;
//     entry_point?.appendChild(div);
//   }
// }
