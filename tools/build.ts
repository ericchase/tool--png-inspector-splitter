import { CopyFile } from '../src/lib/ericchase/Platform/Bun/Fs.js';
import { GlobManager } from '../src/lib/ericchase/Platform/Bun/Path.js';
import { CleanDirectory, DeleteDirectory, DeleteFile } from '../src/lib/ericchase/Platform/Node/Fs.js';
import { NormalizePath } from '../src/lib/ericchase/Platform/Node/Path.js';
import { bundle, copy, processHTML } from './lib/build.js';
import { CustomComponentPreprocessor } from './lib/CustomComponentPreprocessor.js';

// User Values
const buildDir = NormalizePath('./public') + '/';
const sourceDir = NormalizePath('./src') + '/';
const tempDir = NormalizePath('./temp') + '/';

// Init
await CleanDirectory(buildDir);
await CleanDirectory(tempDir);

const toCopy = new GlobManager() //
  .scan(sourceDir, '**/*.css');

const toExclude = new GlobManager() //
  .scan(sourceDir, '{@types,cli,lib}/**', 'components/**/*.html');

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
for (const [tag, count] of customComponentPreprocessor.componentUsageCount) {
  console.log(count === 1 ? '1 copy' : count + ' copies', 'of', tag);
}

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

// Move Index
if (await CopyFile({ from: buildDir + 'index.html', to: './index.html' })) {
  DeleteFile(buildDir + 'index.html');
}

// Cleanup
await DeleteDirectory(tempDir);
