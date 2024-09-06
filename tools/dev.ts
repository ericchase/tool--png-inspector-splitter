import { Debounce } from '../src/lib/ericchase/Algorithm/Debounce.js';
import { Run } from '../src/lib/ericchase/Platform/Bun/Process.js';
import { Watcher } from '../src/lib/ericchase/Platform/Node/Watch.js';
import { ConsoleError, ConsoleLog } from '../src/lib/ericchase/Utility/Console.js';

const runBuild = Debounce(async () => {
  await Run('bun run build');
}, 250);

runBuild();

try {
  const watcher = new Watcher('./src', 250);
  watcher.observe(() => {
    runBuild();
  });
  ConsoleLog();
  await watcher.done;
} catch (error) {
  ConsoleError(error);
}
