import { setupDragAndDropFilePicker } from './components/drag-and-drop-file-picker/drag-and-drop-file-picker.js';
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
        addTextToOutput(error, true);
      },
      onUploadEnd() {},
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
    addTextToOutput(`${error}`, true);
    resetViewer();
  }
  done();
}

if (btn_inspect instanceof HTMLButtonElement) {
  btn_inspect.disabled = true;
  btn_inspect.addEventListener('click', async () => {
    btn_inspect.disabled = true;
    const bytes = await selected_file?.bytes();
    const name = await selected_file?.name;
    if (bytes) {
      const logs: string[] = [];
      if (name) logs.push(`"${name}"\n`);
      PNGInspect(bytes, (data: any[] = []) => {
        logs.push(data.join(' '));
      });
      addTextToOutput(logs.join('\n'));
    }
  });
}
if (btn_split instanceof HTMLButtonElement) {
  btn_split.disabled = true;
  btn_split.addEventListener('click', async () => {
    btn_split.disabled = true;
    const bytes = await selected_file?.bytes();
    if (bytes) {
      const output_buffers = await PNGSplit(bytes, 1000);
      const [img] = output_buffers.map(async (buffer) => addImageToOutput(buffer));
      (await img)?.scrollIntoView(false);
    }
  });
}

async function addImageToOutput(buffer: Uint8Array) {
  try {
    const img_url = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement('img');
      img.src = img_url;
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', reject);
    });
    if (output_container) {
      output_container.classList.remove('remove');
      for (const gap of output_container_gaps ?? []) {
        gap.classList.remove('remove');
      }
      output_container.prepend(img);
      return img;
    }
  } catch (_) {}
}

function addTextToOutput(text: string, is_error = false) {
  try {
    if (output_container) {
      output_container.classList.remove('remove');
      for (const gap of output_container_gaps ?? []) {
        gap.classList.remove('remove');
      }
      const div_outer = document.createElement('div');
      const div_inner = document.createElement('div');
      const pre = document.createElement('pre');
      pre.textContent = text;
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
  } catch (_) {}
}
