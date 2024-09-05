export function Debounce(callback: () => Promise<void>, delay: number) {
  let timer: number | Timer | undefined = undefined;
  let calling = false;
  return function () {
    if (calling === false) {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (calling === false) {
          calling = true;
          clearTimeout(timer);
          await callback();
          clearTimeout(timer);
          calling = false;
        }
      }, delay);
    }
  };
}
