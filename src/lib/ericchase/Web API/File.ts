import { HasProperty } from '../Utility/Guard.js';

export function Compat_File(file?: File) {
  return {
    get lastModified(): File['lastModified'] | undefined {
      return HasProperty(file, 'lastModified') ? file.lastModified : undefined;
    },
    get name(): File['name'] | undefined {
      return HasProperty(file, 'name') ? file.name : undefined;
    },
    get webkitRelativePath(): File['webkitRelativePath'] | undefined {
      return HasProperty(file, 'webkitRelativePath') ? file.webkitRelativePath : undefined;
    },
  };
}
