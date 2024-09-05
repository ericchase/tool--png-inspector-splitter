import node_child_process from 'node:child_process';

export interface WatchParams {
  path: string;
  debounce_interval: number;
  change_cb: (changes: string[]) => void;
  error_cb: (error: string) => void;
}
export function Watch({ path, debounce_interval = 0, change_cb = (_) => {}, error_cb = (_) => {} }: WatchParams) {
  return new Promise(async (resolve, reject) => {
    const p = node_child_process.spawn('watch', [path]);
    p.on('close', (code) => {
      resolve(code);
    });
    p.on('error', (error) => {
      reject(error);
    });
    if (debounce_interval > 0) {
      let changes: string[] = [];
      p.stdout.on('data', (chunk) => {
        changes.push(chunk.toString().slice(0, -1));
      });
      setInterval(() => {
        if (changes.length > 0) {
          change_cb(changes);
          changes = [];
        }
      }, debounce_interval).unref();
    } else {
      p.stdout.on('data', (chunk) => {
        change_cb([chunk.toString().slice(0, -1)]);
      });
    }
    p.stderr.on('data', (chunk) => {
      error_cb(chunk.toString().slice(0, -1));
    });
  });
}
