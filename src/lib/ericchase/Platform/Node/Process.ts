import { execFile } from 'node:child_process';
import { ConsoleLog } from '../../Utility/Console.js';

export interface STDIO {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
}

interface RunParams {
  program: string;
  args?: string[];
  options?: Parameters<typeof execFile>[2];
}
export function Run({ program, args = [], options = {} }: RunParams) {
  return new Promise<STDIO>((resolve, reject) => {
    try {
      ConsoleLog(`[${new Date().toLocaleTimeString()}] > ${program} ${args.join(' ')}`);
      execFile(program, args, options, (error, stdout, stderr) => {
        if (error) return reject(error);
        return resolve({ stdout, stderr });
      });
    } catch (error) {
      return reject(error);
    }
  });
}

export async function PipeStdio(command: Promise<STDIO>) {
  try {
    const { stdout, stderr } = await command;
    if (stdout) ConsoleLog(stdout.slice(0, stdout.lastIndexOf('\n')));
    if (stderr) ConsoleLog(stderr.slice(0, stderr.lastIndexOf('\n')));
  } catch (error) {
    ConsoleLog(error);
  }
}
