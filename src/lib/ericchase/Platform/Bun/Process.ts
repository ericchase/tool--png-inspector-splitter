export async function Run(cmd: string) {
  console.log(`[${new Date().toLocaleTimeString()}] > ${cmd}`);
  return Bun.spawn(cmd.split(' '), { stdout: 'inherit', stderr: 'inherit' }).exited;
}

export async function RunQuiet(cmd: string) {
  console.log(`[${new Date().toLocaleTimeString()}] > ${cmd}`);
  return Bun.spawn(cmd.split(' '), { stdout: 'ignore', stderr: 'ignore' }).exited;
}
