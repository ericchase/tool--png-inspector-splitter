import { type NodeHTMLParser, ParseHTML } from '../../src/lib/ericchase/Platform/Web/HTML/ParseHTML.js';
import { LazyTask } from '../../src/lib/ericchase/Utility/Task.js';
import type { HTMLPreprocessor } from './build.js';

export class CustomComponentPreprocessor {
  componentUsageCount = new Map<string, number>();
  componentLoaders = new Map<string, LazyTask<string | undefined>>();
  get preprocess(): HTMLPreprocessor {
    return async (root: NodeHTMLParser.HTMLElement) => {
      for (const [tag, loader] of this.componentLoaders) {
        const targetElements = root.querySelectorAll(tag);
        if (targetElements.length > 0) {
          this.componentUsageCount.set(tag, (this.componentUsageCount.get(tag) ?? 0) + 1);
          const componentHTML = await loader.get;
          if (componentHTML) {
            for (const element of root.querySelectorAll(tag)) {
              // Steps
              //
              // 1. Create new component element
              //
              element.insertAdjacentHTML('afterend', componentHTML);
              const component = element.nextElementSibling;
              if (!component) continue;
              //
              // 2. Overwrite attributes (merge class and style)
              //
              for (const [key, value] of Object.entries(element.attributes)) {
                if (key === 'class') {
                  component.setAttribute(key, [component.getAttribute(key), value].filter((_) => _).join(' '));
                } else if (key === 'style') {
                  component.setAttribute(key, [component.getAttribute(key), value].filter((_) => _).join(';'));
                } else {
                  component.setAttribute(key, value);
                }
              }
              //
              // 3. Move child nodes
              //
              const slot = component.querySelector('slot');
              if (slot) {
                slot.replaceWith(...element.childNodes);
              } else {
                for (const child of element.childNodes) {
                  component.appendChild(child);
                }
              }
              //
              // 4. Remove old element
              //
              element.remove();
            }
          }
        }
      }
    };
  }
  registerComponentBody(tag: string, body: string) {
    if (!this.componentLoaders.has(tag)) {
      this.componentUsageCount.set(tag, 0);
      this.componentLoaders.set(tag, new LazyTask(async () => body));
    }
    return this;
  }
  registerComponentPath(tag: string, path: string, as_is = false) {
    if (!this.componentLoaders.has(tag)) {
      this.componentUsageCount.set(tag, 0);
      this.componentLoaders.set(
        tag,
        new LazyTask(async () => {
          try {
            if (as_is) {
              return Bun.file(path).text();
            }
            const document = ParseHTML(await Bun.file(path).text());
            const body = document.querySelector('body');
            return (body ? body.querySelector('*') : document.querySelector('*'))?.toString();
          } catch (error) {}
        }),
      );
    }
    return this;
  }
}
