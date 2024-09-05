import { ReadFile, WriteFile } from '../../Node/Fs.js';

export type POJO = Record<string, any>;

export class Config {
  constructor(public pojo: POJO) {}
  get(this: Config, key: string): unknown {
    return this.pojo[key];
  }
  set(this: Config, key: string, value: any) {
    this.pojo[key] = value;
  }
  toJSON() {
    return JSON.stringify(this.pojo);
  }

  // STATIC

  static mergeConfigs(configA: Config, configB: Config) {
    function merge_objects(...sources: any[]) {
      const dest: Record<any, any> = {};
      for (const source of sources) {
        if (typeof source !== 'object') {
          continue;
        }
        for (const key in source) {
          if (source.hasOwnProperty(key)) {
            if (typeof source[key] === 'object' && Array.isArray(source[key]) === false) {
              dest[key] = merge_objects(dest[key], source[key]);
            } else {
              dest[key] = source[key];
            }
          }
        }
      }
      return dest;
    }
    return new Config(merge_objects(configA.pojo, configB.pojo));
  }

  static async readConfig(path: string) {
    return new Config(JSON.parse(await ReadFile(path)));
  }
}

interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

// Given a version number MAJOR.MINOR.PATCH, increment the:
//  MAJOR version when you make incompatible API changes
//  MINOR version when you add functionality in a backward compatible manner
//  PATCH version when you make backward compatible bug fixes
// https://semver.org/

export async function GetSemanticVersion(version_json_path: string) {
  const version: SemanticVersion = JSON.parse(await ReadFile(version_json_path));
  return `${version.major}.${version.minor}.${version.patch}`;
}
export async function IncrementVersionMajor(version_json_path: string) {
  const version: SemanticVersion = JSON.parse(await ReadFile(version_json_path));
  version.major += 1;
  await WriteFile(version_json_path, JSON.stringify(version));
}
export async function IncrementVersionMinor(version_json_path: string) {
  const version: SemanticVersion = JSON.parse(await ReadFile(version_json_path));
  version.minor += 1;
  await WriteFile(version_json_path, JSON.stringify(version));
}
export async function IncrementVersionPatch(version_json_path: string) {
  const version: SemanticVersion = JSON.parse(await ReadFile(version_json_path));
  version.patch += 1;
  await WriteFile(version_json_path, JSON.stringify(version));
}
