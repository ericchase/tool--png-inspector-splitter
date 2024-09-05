export function CreateElement<K extends keyof HTMLElementTagNameMap, V extends HTMLElementTagNameMap[K]>(tagName: K): V;
export function CreateElement<K extends keyof SVGElementTagNameMap, V extends SVGElementTagNameMap[K]>(tagName: K): V;
export function CreateElement<K extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap, V extends (HTMLElementTagNameMap & SVGElementTagNameMap)[K]>(tagName: K): V;
export function CreateElement<K extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap>(
  tagName: K, //
) {
  return document.createElement(tagName);
}
