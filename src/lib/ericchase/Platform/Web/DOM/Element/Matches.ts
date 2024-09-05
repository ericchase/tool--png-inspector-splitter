import { GetElementReference } from './_elementReferenceMap.js';

export function Matches<K extends keyof HTMLElementTagNameMap, V extends HTMLElementTagNameMap[K]>(tagName: K, selector: string, source: { matches: Function }): source is V;
export function Matches<K extends keyof SVGElementTagNameMap, V extends SVGElementTagNameMap[K]>(tagName: K, selector: string, source: { matches: Function }): source is V;
export function Matches<K extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap, V extends (HTMLElementTagNameMap & SVGElementTagNameMap)[K]>(tagName: K, selector: string, source: { matches: Function }): source is V;
export function Matches<K extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap>(
  tagName: K, //
  selector: string,
  source: { matches: Function },
) {
  return source instanceof GetElementReference(tagName) && source.matches(selector);
}
