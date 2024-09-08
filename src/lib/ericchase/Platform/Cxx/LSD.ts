import node_child_process, { type ExecFileOptions } from 'node:child_process';
import type { ObjectEncodingOptions } from 'node:fs';
import { GlobSearch } from '../../Algorithm/String/Search/GlobSearch.js';
import { ConsoleLog } from '../../Utility/Console.js';
import type { STDIO } from '../Node/Process.js';

export interface LSDParams {
  path?: string;
  filter?: string;
  options?: ObjectEncodingOptions & ExecFileOptions;
}
export function LSD({
  path = '.', //
  filter = '',
  options = {},
}: LSDParams) {
  const program = 'lsd';
  const args = [path];
  if (filter) args.push(filter);
  return new Promise<STDIO>((resolve, reject) => {
    node_child_process.execFile(program, args, options, (error, stdout, stderr) => {
      if (error) return reject(error);
      return resolve({ stdout, stderr });
    });
  });
}

export enum PathKind {
  Directory = 1,
  File = 2,
}
export interface LSDResult {
  kind: PathKind;
  path: string;
}
export async function IterateLSD(
  command: Promise<STDIO>, //
  filterkind: PathKind = PathKind.Directory | PathKind.File,
  callback?: (result: LSDResult) => void,
) {
  const { stdout = '', stderr } = await command;
  if (stderr) ConsoleLog('LSD Error:', stderr);
  if (typeof stdout === 'string') {
    const results = stdout
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => ({
        kind: line[0] === 'D' ? PathKind.Directory : PathKind.File,
        path: line.slice(2),
      }));
    if (callback) {
      for (const { kind, path } of results) {
        if (kind & filterkind) {
          callback({ kind, path });
        }
      }
    }
  }
}

interface GetDirectoryListingOptions {
  path: string;
  include?: string[];
  exclude?: string[];
  ignore_paths?: string[];
}
export async function FilterDirectoryListing(
  options: GetDirectoryListingOptions, //
) {
  const directories: string[] = [];
  const files: string[] = [];
  let stdout = (await LSD({ path: options.path })).stdout;
  if (typeof stdout !== 'string') {
    stdout = new TextDecoder().decode(stdout);
  }
  for (const entry of stdout.split('\n') ?? []) {
    if (entry.length > 0) {
      const entry_name = entry.slice(2);
      if (entry[0] === 'D') {
        if (options.ignore_paths?.length === 0 || !options.ignore_paths?.some((ignore) => entry_name.includes(ignore))) {
          directories.push(entry_name);
        }
      } else {
        if (options.include?.length === 0 || options.include?.some((filter) => GlobSearch(entry_name, filter))) {
          if (options.exclude?.length === 0 || !options.exclude?.some((filter) => GlobSearch(entry_name, filter))) {
            files.push(entry_name);
          }
        }
      }
    }
  }
  return { directories, files };
}

export async function FilterDirectoryTree(
  options: GetDirectoryListingOptions, //
) {
  const directories: string[] = [options.path];
  const files: string[] = [];
  for (let i = 0; i < directories.length; i++) {
    let stdout = (await LSD({ path: directories[i] })).stdout;
    if (typeof stdout !== 'string') {
      stdout = new TextDecoder().decode(stdout);
    }
    for (const entry of stdout.split('\n') ?? []) {
      if (entry.length > 0) {
        const entry_name = entry.slice(2);
        const entry_path = directories[i] + '/' + entry_name;
        if (entry[0] === 'D') {
          if (options.ignore_paths?.length === 0 || !options.ignore_paths?.some((ignore) => entry_path.includes(ignore))) {
            directories.push(entry_path);
          }
        } else {
          if (options.include?.length === 0 || options.include?.some((filter) => GlobSearch(entry_name, filter))) {
            if (options.exclude?.length === 0 || !options.exclude?.some((filter) => GlobSearch(entry_name, filter))) {
              files.push(entry_path);
            }
          }
        }
      }
    }
  }
  return { directories, files };
}
