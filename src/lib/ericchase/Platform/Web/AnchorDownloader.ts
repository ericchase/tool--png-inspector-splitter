export function anchor_downloader(data: string, filename: string) {
  const a = document.createElement('a');
  a.setAttribute('href', data);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function SaveBlob(blob: Blob, filename: string) {
  anchor_downloader(URL.createObjectURL(blob), filename);
}
export function SaveUrl(url: string, filename: string) {
  anchor_downloader(url, filename);
}

export function SaveBuffer(buffer: ArrayBuffer, filename: string) {
  SaveBlob(new Blob([buffer], { type: 'application/octet-stream;charset=utf-8' }), filename);
}
export function SaveJSON(json: string, filename: string) {
  SaveBlob(new Blob([json], { type: 'application/json;charset=utf-8' }), filename);
}
export function SaveText(text: string, filename: string) {
  SaveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}
