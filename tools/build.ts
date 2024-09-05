import { GlobManager } from '../src/lib/ericchase/Platform/Bun/Path.js';
import { Run } from '../src/lib/ericchase/Platform/Bun/Process.js';
import { CleanDirectory, DeleteDirectory } from '../src/lib/ericchase/Platform/Node/Fs.js';
import { NormalizePath } from '../src/lib/ericchase/Platform/Node/Path.js';
import { bundle, copy, processHTML } from './lib/build.js';
import { CustomComponentPreprocessor } from './lib/CustomComponentPreprocessor.js';

// User Values
const buildDir = NormalizePath('./build') + '/';
const sourceDir = NormalizePath('./src') + '/';
const tempDir = NormalizePath('./temp') + '/';

// Init
await CleanDirectory(buildDir);
await CleanDirectory(tempDir);

const toCopy = new GlobManager() //
  .scan(sourceDir, '*.css');

const toExclude = new GlobManager() //
  .scan(sourceDir, '{@types,cli,lib}/**', 'components/**');

// Process HTML
const htmlList = ['**/*.html'];
const customComponentPreprocessor = new CustomComponentPreprocessor();
for (const { name, path } of new GlobManager().scanDot(sourceDir, 'components/**/.*.html').pathGroups) {
  customComponentPreprocessor.registerComponentPath(name.slice(1), path, true);
}
for (const { name, path } of new GlobManager().scan(sourceDir, 'components/**/*.html').pathGroups) {
  customComponentPreprocessor.registerComponentPath(name, path);
}
const toProcess = new GlobManager() //
  .scan(sourceDir, ...htmlList);
toCopy.update(
  await processHTML({
    outDir: tempDir,
    toProcess,
    toExclude,
    preprocessors: [customComponentPreprocessor.preprocess],
  }),
);
toExclude.scan(sourceDir, ...htmlList);

// Bundle
const tsList = ['**/*.ts'];
const toBundle = new GlobManager() //
  .scan(sourceDir, ...tsList);
toCopy.update(
  await bundle({
    outDir: tempDir,
    toBundle,
    toExclude,
  }),
);
toExclude.scan(sourceDir, ...tsList);

// Copy
await copy({
  outDir: buildDir,
  toCopy,
  toExclude,
});

// Cleanup
await DeleteDirectory(tempDir);
