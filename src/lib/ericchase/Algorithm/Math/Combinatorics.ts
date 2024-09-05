import { Factorial } from './Factorial.js';

/**
 * The npr formula is used to find the number of ways in which r different
 * things can be selected and arranged out of n different things. This is also
 * known as the permutations formula. The nPr formula is, P(n, r) = n! / (n−r)!.
 */
export function nPr(n: number, r: number): number {
  return Factorial(n) / Factorial(n - r);
}
export function nCr(n: number, r: number): number {
  return Factorial(n) / (Factorial(r) * Factorial(n - r));
}

export function nChooseRPermutations<T>(choices: T[], r: number): T[][] {
  function incrementIndices(indices: number[], n: number): void {
    // start with last index
    const last = indices.length - 1;
    // increment last index
    ++indices[last];

    // work backwards
    let i = last;
    while (i >= 0) {
      // increment index again if equal to a higher index
      while (indices.slice(0, i).includes(indices[i])) {
        ++indices[i]; // increment index
      }

      const end = n;
      // check if index is still less than end
      if (indices[i] < end) {
        // reset lower index if necessary
        if (++i < indices.length) {
          indices[i] = 0;
        } else {
          // done
          break;
        }
      } else {
        // move to higher index and increment it
        ++indices[--i];
      }
    }
  }

  // P(n, r) = n!/(n-r)!
  const n = choices.length;
  const permutationCount = nPr(n, r);

  const indexList = Array.from(new Array(r).keys());
  const permutations = new Array<T[]>(permutationCount);

  for (let c = 0; c < permutationCount; ++c) {
    // Create new permutation
    // - Map indices to actual values
    permutations[c] = indexList.map((i) => choices[i]);

    // Increment the indices
    incrementIndices(indexList, n);
  }

  return permutations;
}
export function nChooseRCombinations<T>(choices: T[], r: number): T[][] {
  function incrementIndices(indices: number[], n: number): void {
    // start with last index
    const last = indices.length - 1;
    // increment last index
    ++indices[last];

    // work backwards
    let i = last;
    while (i >= 0) {
      const end = i < last ? indices[i + 1] : n;
      // check if index is still less than end
      if (indices[i] < end) {
        // reset lower index if necessary
        if (++i < indices.length) {
          indices[i] = indices[i - 1] + 1;
        } else {
          // done
          break;
        }
      } else {
        // move to higher index and increment it
        ++indices[--i];
      }
    }
  }

  // C(n, r) = n!/(r!(n-r)!)
  const n = choices.length;
  const combinationCount = nCr(n, r);

  const indexList = Array.from(new Array(r).keys());
  const combinations = new Array<T[]>(combinationCount);

  for (let c = 0; c < combinationCount; ++c) {
    // Create new permutation
    // - Map indices to actual values
    combinations[c] = indexList.map((i) => choices[i]);

    // Increment the indices
    incrementIndices(indexList, n);
  }

  return combinations;
}
