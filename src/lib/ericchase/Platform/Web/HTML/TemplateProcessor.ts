//! use Bun.HTMLRewriter instead
import * as Parser from 'node-html-parser';
import node_fs from 'node:fs/promises';
import { ParseHTML } from './ParseHTML.js';

export async function LoadHtmlFile(filePath: string) {
  try {
    const html = await node_fs.readFile(filePath, { encoding: 'utf8' });
    return ParseHTML(html);
  } catch (err) {
    throw 'Could not open file: ' + filePath;
  }
}
export async function SaveHtmlFile(root: Parser.HTMLElement, filePath: string) {
  await node_fs.writeFile(filePath, root.toString(), { encoding: 'utf8' });
}

const includeMap = new Map<string, string>();
export function RegisterIncludeSource(includeName: string, includeHTML: string) {
  includeMap.set(includeName, includeHTML);
}
export async function LoadIncludeFile(includeName: string, includePath: string) {
  try {
    const html = await node_fs.readFile(includePath, { encoding: 'utf8' });
    includeMap.set(includeName, html);
    return html;
  } catch (err) {
    throw 'Could not open file: ' + includePath;
  }
}
async function getInclude(includeName: string) {
  const html = includeMap.get(includeName);
  if (html) {
    return ParseHTML(html);
  } else {
    try {
      return ParseHTML(await LoadIncludeFile(includeName, includeName + '.html'));
    } catch (err) {
      throw 'Could not load include: ' + includeName;
    }
  }
}

export async function ProcessTemplateNode(root: Parser.HTMLElement) {
  const stack = toReversed(root.childNodes);
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node instanceof Parser.HTMLElement) {
      if (node.tagName === 'INCLUDE') {
        const newNode = await processInclude(node);
        stack.push(...toReversed(newNode.childNodes));
      } else {
        stack.push(...toReversed(node.childNodes));
      }
    }
  }
  return root;
}
export async function ProcessTemplateFile(templatePath: string, outputPath: string) {
  await SaveHtmlFile(await ProcessTemplateNode(await LoadHtmlFile(templatePath)), outputPath);
}

async function processInclude(oldItem: Parser.HTMLElement) {
  const oldChildNodes = trimNodelist(oldItem.childNodes);
  const includeName = Object.keys(oldItem.attributes)[0];
  oldItem.removeAttribute(includeName);
  const root = await getInclude(includeName);
  const newItem = (function () {
    const childNodes = trimNodelist(root.childNodes);
    if (childNodes.length === 1) {
      oldItem.replaceWith(childNodes[0]);
      return childNodes[0];
    }
    if (childNodes.length > 1) {
      oldItem.replaceWith(...childNodes);
      // find first HTMLElement child if exists
      for (const child of childNodes) {
        if (child instanceof Parser.HTMLElement) {
          return child;
        }
      }
      return childNodes[0];
    }
    return oldItem;
  })();
  if (newItem !== oldItem) {
    if (newItem instanceof Parser.HTMLElement) {
      newItem.setAttributes({ ...oldItem.attributes, ...newItem.attributes });
      const classList = [...oldItem.classList.values(), ...newItem.classList.values()];
      for (const value of newItem.classList.values()) {
        newItem.classList.remove(value);
      }
      for (const value of classList) {
        newItem.classList.add(value);
      }
    }
    if (oldChildNodes.length > 0) {
      const slot = findSlot(root);
      if (slot) slot.replaceWith(...oldChildNodes);
    }
    return newItem;
  }
  return oldItem;
}

function findSlot(root: Parser.HTMLElement) {
  const stack = toReversed(root.childNodes);
  while (stack.length > 0) {
    const item = stack.pop()!;
    if (item instanceof Parser.HTMLElement) {
      if (item.tagName === 'SLOT') {
        return item;
      }
      stack.push(...toReversed(item.childNodes));
    }
  }
  return undefined;
}
function trimNodelist(nodes: Parser.Node[]) {
  let start = 0;
  for (const node of nodes) {
    if (node.nodeType === 3) {
      if (node.rawText.trim() === '') {
        start++;
        continue;
      }
    }
    break;
  }
  let end = nodes.length;
  for (const node of toReversed(nodes)) {
    if (node.nodeType === 3) {
      if (node.rawText.trim() === '') {
        end--;
        continue;
      }
    }
    break;
  }
  return nodes.slice(start, end);
}
function toReversed(tree: Parser.Node[]) {
  const reversed: Parser.Node[] = [];
  for (let index = tree.length; index > 0; index--) {
    reversed.push(tree[index - 1]);
  }
  return reversed;
}
