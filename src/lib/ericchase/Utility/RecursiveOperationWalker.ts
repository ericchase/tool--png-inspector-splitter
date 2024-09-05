// ! WIP

export class RecursiveOperationWalker {
  static walk<T>(root: T, fn: (values: T[]) => T[]) {
    const stack: [T, number][] = [[root, -1]];
    while (stack.length > 0) {
      const args: T[] = [];
      for (let i = stack.length - 1; i !== -1; i = stack[i][1]) {
        args.push(stack[i][0]);
      }
      const values = fn(args.reverse());
      if (values.length === 0) {
        let i = stack.length - 1;
        while (i !== -1 && i - 1 === stack[i][1]) {
          i = stack[i][1];
          stack.pop();
        }
        stack.pop();
      } else {
        const i = stack.length - 1;
        for (const value of values) {
          stack.push([value, i]);
        }
      }
    }
  }
  static async walkAsync<T>(root: T, fn: (values: T[]) => Promise<T[]>) {
    const stack: [T, number][] = [[root, -1]];
    while (stack.length > 0) {
      const args: T[] = [];
      for (let i = stack.length - 1; i !== -1; i = stack[i][1]) {
        args.push(stack[i][0]);
      }
      const values = await fn(args.reverse());
      if (values.length === 0) {
        let i = stack.length - 1;
        while (i !== -1 && i - 1 === stack[i][1]) {
          i = stack[i][1];
          stack.pop();
        }
        stack.pop();
      } else {
        const i = stack.length - 1;
        for (const value of values) {
          stack.push([value, i]);
        }
      }
    }
  }
}
