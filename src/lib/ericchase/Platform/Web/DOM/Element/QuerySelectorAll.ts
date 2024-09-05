import { GetElementReference } from './_elementReferenceMap.js';

/** Performs `querySelectorAll` on `source` and typechecks the returned `HTMLElement`s or `SVGElement`s against `tagName`. Throws if any returned element doesn't match. */
export function $$<K extends keyof HTMLElementTagNameMap, V extends HTMLElementTagNameMap[K]>(tagName: K, selector: string, source?: { querySelectorAll: Function }, includeSourceInMatch?: boolean): V[];
export function $$<K extends keyof SVGElementTagNameMap, V extends SVGElementTagNameMap[K]>(tagName: K, selector: string, source?: { querySelectorAll: Function }, includeSourceInMatch?: boolean): V[];
export function $$<K extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap, V extends (HTMLElementTagNameMap & SVGElementTagNameMap)[K]>(tagName: K, selector: string, source?: { querySelectorAll: Function }, includeSourceInMatch?: boolean): V[];
export function $$<K extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap>(
  tagName: K, //
  selector: string,
  source: { querySelectorAll: Function } = document.documentElement,
  includeSourceInMatch: boolean = false,
) {
  const elements: (HTMLElementTagNameMap & SVGElementTagNameMap)[K][] = [];
  // @ts-ignore
  if (includeSourceInMatch === true && source instanceof GetElementReference(tagName) && source.matches(selector)) {
    elements.push(source as (HTMLElementTagNameMap & SVGElementTagNameMap)[K]);
  }
  elements.push(...source.querySelectorAll(selector));
  for (const element of elements) {
    if (!(element instanceof GetElementReference(tagName))) {
      throw `Query: \`${selector}\`. Element not of type: \`${tagName}\`. ${element}`;
    }
  }
  return elements;
}

export const QuerySelectorAll = $$;
