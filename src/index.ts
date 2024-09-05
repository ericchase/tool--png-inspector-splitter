import { setupDragAndDropFilePicker } from './drag-and-drop-file-picker.js';

// ! one day use EventManager
document.documentElement.addEventListener('dragover', (event) => event.preventDefault());

const main = document.querySelector('main');
const picker = document.querySelector('.drag-and-drop-file-picker');

const input = picker?.querySelector('input');
if (input) {
  setupDragAndDropFilePicker(input, {
    onStart: () => {
      // Clear page
      main?.replaceChildren();
      picker?.classList.add('hidden');
    },
    onEntry: showImage,
    onEnd() {},
  });
}

function showImage(file: File) {
  const div = document.createElement('div');
  const img = document.createElement('img');
  img.onerror = function () {
    div.remove();
  };
  img.src = URL.createObjectURL(file);
  div.append(img);
  main?.append(div);
}
