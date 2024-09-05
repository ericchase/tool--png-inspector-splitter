import node_path from 'node:path';

export function NormalizePath(path: string) {
  return node_path.normalize(path);
}

export function ParsePath(path: string) {
  return node_path.parse(path);
}

export const PathSeparator = node_path.sep;
