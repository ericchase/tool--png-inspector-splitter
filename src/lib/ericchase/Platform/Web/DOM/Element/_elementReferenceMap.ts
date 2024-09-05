const tagNameToElementReferenceMap: Map<string, Function> = new Map();
export function GetElementReference<K extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap>(
  tagName: K, //
) {
  const ref = tagNameToElementReferenceMap.get(tagName) || document.createElement(tagName).constructor;
  if (!tagNameToElementReferenceMap.has(tagName)) {
    tagNameToElementReferenceMap.set(tagName, ref);
  }
  return ref;
}
