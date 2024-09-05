import { Endpoints } from '../Array/Endpoints.js';
import { midpoint } from '../Math/Midpoint.js';

export function BinarySearch<T>(array: T[], target: T, isOrdered: (a: T, b: T) => boolean = (a: T, b: T) => a < b): number {
  let [begin, end] = Endpoints(array);
  let middle = midpoint(begin, end);
  while (begin < end) {
    if (isOrdered(target, array[middle])) {
      end = middle;
    } else {
      if (!isOrdered(array[middle], target)) {
        break;
      }
      begin = middle + 1;
    }
    middle = midpoint(begin, end);
  }
  return middle;
}

// dunno what these are anymore
BinarySearch.Lower = function <T>(array: T[], target: T, isOrdered: (a: T, b: T) => boolean = (a: T, b: T) => a < b): number {
  return BinarySearch.Upper(array, target, (a: T, b: T) => isOrdered(a, b) || !isOrdered(b, a)) + 1;
};
BinarySearch.Upper = function <T>(array: T[], target: T, isOrdered: (a: T, b: T) => boolean = (a: T, b: T) => a < b): number {
  let [begin, end] = Endpoints(array);
  let middle = midpoint(begin, end);
  while (begin < end) {
    if (isOrdered(target, array[middle])) {
      end = middle;
    } else {
      begin = middle + 1;
    }
    middle = midpoint(begin, end);
  }
  return middle - 1;
};
