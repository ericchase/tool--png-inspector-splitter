import { Rect } from '../../Utility/Rect.js';

export class RegionHighlighter {
  element = document.createElement('div');
  rect = new Rect();

  constructor({ width = '', style = '', color = '' }: { width?: string; style?: string; color?: string } = {}) {
    if (width !== '') this.element.style.setProperty('border-width', width);
    if (style !== '') this.element.style.setProperty('border-style', style);
    if (color !== '') this.element.style.setProperty('border-color', color);
    if (this.element.style.getPropertyValue('border-width') === '') this.element.style.setProperty('border-width', '0.125em');
    if (this.element.style.getPropertyValue('border-style') === '') this.element.style.setProperty('border-style', 'solid');
    if (this.element.style.getPropertyValue('border-color') === '') this.element.style.setProperty('border-color', 'red');

    this.element.style.position = 'absolute';
    this.element.style.pointerEvents = 'none';
    this.element.style.zIndex = '99999';
    this.hide();
  }

  attach(this: RegionHighlighter, sibling: HTMLElement) {
    sibling.insertAdjacentElement('afterend', this.element);
  }
  draw(this: RegionHighlighter) {
    const { x, y, width, height } = this.rect;
    if (width > 15 && height > 15) {
      this.element.style.left = x + 'px';
      this.element.style.top = y + 'px';
      this.element.style.width = width + 'px';
      this.element.style.height = height + 'px';
      this.show();
    } else {
      this.element.style.left = '0';
      this.element.style.top = '0';
      this.element.style.width = '0';
      this.element.style.height = '0';
      this.hide();
    }
  }
  hide(this: RegionHighlighter) {
    this.element.style.setProperty('display', 'none');
  }
  reset(this: RegionHighlighter) {
    this.hide();
    this.rect.x1 = 0;
    this.rect.x2 = 0;
    this.rect.y1 = 0;
    this.rect.y2 = 0;
  }
  show(this: RegionHighlighter) {
    this.element.style.removeProperty('display');
  }
}
