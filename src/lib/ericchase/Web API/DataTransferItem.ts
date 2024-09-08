import { HasMethod } from '../Utility/Guard.js';

export function Compat_DataTransferItem(item?: DataTransferItem) {
  return {
    getAsEntry(): Exclude<ReturnType<DataTransferItem['webkitGetAsEntry']>, null> | undefined {
      if (HasMethod(item, 'getAsEntry')) {
        return item.getAsEntry() ?? undefined;
      }
      if (HasMethod(item, 'webkitGetAsEntry')) {
        return item.webkitGetAsEntry() ?? undefined;
      }
    },
    getAsFile(): Exclude<ReturnType<DataTransferItem['getAsFile']>, null> | undefined {
      if (HasMethod(item, 'getAsFile')) {
        return item.getAsFile() ?? undefined;
      }
    },
    getAsString(): Promise<Parameters<Exclude<Parameters<DataTransferItem['getAsString']>[0], null>>[0] | undefined> {
      if (HasMethod(item, 'getAsString')) {
        return new Promise((resolve, reject) => {
          try {
            item.getAsString(resolve);
          } catch (error) {
            reject(error);
          }
        });
      }
      return Promise.resolve(undefined);
    },
  };
}
