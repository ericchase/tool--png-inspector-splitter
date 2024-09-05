import { GetElementReference } from './_elementReferenceMap.js';

/** Performs `querySelector` on `source` and typechecks the returned `HTMLElement` or `SVGElement` against `tagName`. Throws if no matching element. */
export function $<K extends keyof HTMLElementTagNameMap, V extends HTMLElementTagNameMap[K]>(tagName: K, selector: string, source?: { querySelector: Function }): V;
export function $<K extends keyof SVGElementTagNameMap, V extends SVGElementTagNameMap[K]>(tagName: K, selector: string, source?: { querySelector: Function }): V;
export function $<K extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap, V extends (HTMLElementTagNameMap & SVGElementTagNameMap)[K]>(tagName: K, selector: string, source?: { querySelector: Function }): V;
export function $<K extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap>(
  tagName: K, //
  selector: string,
  source: { querySelector: Function } = document.documentElement,
) {
  const element = source.querySelector(selector);
  if (element instanceof GetElementReference(tagName)) {
    return element;
  }
  throw `Query: \`${selector}\`. Element not of type: \`${tagName}\`. ${element}`;
}

export const QuerySelector = $;
