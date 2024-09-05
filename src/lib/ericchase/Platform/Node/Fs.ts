import node_fs from 'node:fs/promises';
import node_path from 'node:path';

export async function DeleteFile(path: string) {
  try {
    await node_fs.unlink(path);
  } catch (error) {}
}

export async function ReadFile(path: string) {
  return await node_fs.readFile(path, { encoding: 'utf8' });
}

export async function WriteFile(path: string, text: string) {
  await node_fs.writeFile(path, text, { encoding: 'utf8' });
}

export async function CleanDirectory(path: string) {
  await DeleteDirectory(path);
  await CreateDirectory(path);
}

export async function CreateDirectory(path: string, isFile = false) {
  if (isFile === true) {
    await node_fs.mkdir(node_path.dirname(path), { recursive: true });
  } else {
    await node_fs.mkdir(path, { recursive: true });
  }
}

export async function DeleteDirectory(path: string) {
  await node_fs.rm(path, { recursive: true, force: true });
}
