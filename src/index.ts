import { setupDragAndDropFilePicker } from './components/drag-and-drop-file-picker/drag-and-drop-file-picker.js';
import { ConsoleError } from './lib/ericchase/Utility/Console.js';
import type { N } from './lib/ericchase/Utility/Types.js';
import { GetBytes } from './lib/ericchase/Web API/File.js';
import { PNGInspect } from './lib/png-inspect.js';
import { PNGSplit } from './lib/png-split.js';

// // Extremely Useful Function To Print Logs To Pages
// export function log(item: any) {
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

// ! one day use EventManager
document.documentElement.addEventListener('dragover', (event) => event.preventDefault());

const file_picker = document.querySelector('#file-picker');
const image_viewer = document.querySelector('#image-viewer');
const image_viewer_gaps = document.querySelectorAll('.image-viewer-gap');
const edit_buttons = document.querySelector('#edit-buttons');

const btn_inspect = document.querySelector('#btn-inspect');
const btn_split = document.querySelector('#btn-split');
const output_container = document.querySelector('#output-container');
const output_container_gaps = document.querySelectorAll('.output-container-gap');

let selected_file: File | undefined = undefined;

if (file_picker) {
  const onDragEnd = () => {
    file_picker.classList.remove('hover');
  };
  setupDragAndDropFilePicker(
    file_picker,
    {
      onDragEnter() {
        file_picker.classList.add('hover');
      },
      onDragLeave: onDragEnd,
      onDragEnd: onDragEnd,
      onDrop: onDragEnd,
      onUploadStart() {
        selected_file = undefined;
        file_picker.classList.add('quiet-mode');
      },
      onUploadNextFile: showImageInViewer,
      onUploadError(error) {
        addTextsToOutput(error, true);
      },
    },
    {
      accept: '.png', // won't work on mobile
    },
  );
}

function resetViewer() {
  selected_file = undefined;
  file_picker?.classList.remove('quiet-mode');
  image_viewer?.classList.remove('image-loaded');
  image_viewer?.querySelector('img')?.remove();
  for (const gap of image_viewer_gaps ?? []) {
    gap.classList.add('remove');
  }
  for (const button of edit_buttons?.querySelectorAll('button') ?? []) {
    button.disabled = true;
  }
}

async function showImageInViewer(file: File, done: () => void) {
  try {
    if (file.type !== 'image/png') {
      throw `Error: Could not process "${file.name}".\nPlease upload PNG only.`;
    }
    selected_file = file;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', reject);
    });
    for (const gap of image_viewer_gaps ?? []) {
      gap.classList.remove('remove');
    }
    if (image_viewer) {
      image_viewer.querySelector('img')?.remove();
      image_viewer.classList.add('image-loaded');
      image_viewer.classList.remove('remove');
      image_viewer.appendChild(img);
    }
    if (edit_buttons) {
      for (const button of edit_buttons.querySelectorAll('button')) {
        button.disabled = false;
      }
    }
  } catch (error) {
    ConsoleError(error);
    addTextsToOutput(error as any, true);
    resetViewer();
  }
  // done();
}

if (btn_inspect instanceof HTMLButtonElement) {
  btn_inspect.disabled = true;
  btn_inspect.addEventListener('click', async () => {
    try {
      const bytes = await GetBytes(selected_file);
      const name = selected_file?.name;
      if (bytes) {
        const logs: string[] = [];
        if (name) logs.push(`"${name}"\n`);
        PNGInspect(bytes, (data: any[] = []) => {
          logs.push(data.join(' '));
        });
        addTextsToOutput(logs);
        addTextsToOutput([`Inspection report for "${name}"`]);
      }
    } catch (error) {
      ConsoleError(error);
    }
  });
}
if (btn_split instanceof HTMLButtonElement) {
  btn_split.disabled = true;
  btn_split.addEventListener('click', async () => {
    const bytes = await GetBytes(selected_file);
    const name = selected_file?.name;
    if (bytes) {
      const size_input = document.querySelector('#split-size');
      const size = size_input instanceof HTMLInputElement ? Number.parseInt(size_input.value ?? '1000') : 1000;
      const output_buffers = await PNGSplit(bytes, size);
      await addImagesToOutput(output_buffers);
      addTextsToOutput([`Split results for "${name}"`, '', `Size: ${size_input}`]);
    }
  });
}

async function addImagesToOutput(buffers: Uint8Array[]) {
  const imgs = [];
  for (const buffer of buffers) {
    try {
      const img_url = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = document.createElement('img');
        img.src = img_url;
        img.addEventListener('load', () => resolve(img));
        img.addEventListener('error', reject);
      });
      imgs.push(img);
    } catch (error) {
      ConsoleError(error);
    }
  }
  if (output_container) {
    output_container.classList.remove('remove');
    for (const gap of output_container_gaps ?? []) {
      gap.classList.remove('remove');
    }
    for (const img of imgs.reverse()) {
      output_container.prepend(img);
    }
    imgs.at(-1)?.scrollIntoView(false);
  }
  return imgs;
}

function addTextsToOutput(texts: N<string>, is_error = false) {
  try {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }
    if (output_container) {
      output_container.classList.remove('remove');
      for (const gap of output_container_gaps ?? []) {
        gap.classList.remove('remove');
      }
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
      output_container.prepend(div_outer);
      div_outer.scrollIntoView(false);
      return div_outer;
    }
  } catch (error) {
    ConsoleError(error);
  }
}
