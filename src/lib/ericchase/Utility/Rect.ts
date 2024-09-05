export interface RectInit {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface RectReadOnly {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export class Rect implements RectReadOnly {
  x1 = 0;
  x2 = 0;
  y1 = 0;
  y2 = 0;

  static fromRect(rect: RectInit) {
    const r = new Rect();
    r.x1 = rect.x ?? 0;
    r.y1 = rect.y ?? 0;
    r.x2 = r.x1 + (rect.width ?? 0);
    r.y2 = r.y1 + (rect.height ?? 0);
    return r;
  }

  toRectReadOnly(this: RectReadOnly): RectReadOnly {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      left: this.left,
      top: this.top,
      right: this.right,
      bottom: this.bottom,
    };
  }

  get xs(): [number, number] {
    return this.x1 <= this.x2 ? [this.x1, this.x2] : [this.x2, this.x1];
  }
  get ys(): [number, number] {
    return this.y1 <= this.y2 ? [this.y1, this.y2] : [this.y2, this.y1];
  }

  get x(): number {
    return this.xs[0];
  }
  get y(): number {
    return this.ys[0];
  }
  get width(): number {
    const [min, max] = this.xs;
    return max - min;
  }
  get height(): number {
    const [min, max] = this.ys;
    return max - min;
  }
  get left(): number {
    return this.xs[0];
  }
  get top(): number {
    return this.ys[0];
  }
  get right(): number {
    return this.xs[1];
  }
  get bottom(): number {
    return this.ys[1];
  }

  set x(x) {
    if (this.x1 <= this.x2) {
      this.x1 = x;
    } else {
      this.x2 = x;
    }
  }
  set y(y) {
    if (this.y1 <= this.y2) {
      this.y1 = y;
    } else {
      this.y2 = y;
    }
  }
  set width(width) {
    if (this.x1 <= this.x2) {
      this.x2 = this.x1 + width;
    } else {
      this.x1 = this.x2 + width;
    }
  }
  set height(height) {
    if (this.y1 <= this.y2) {
      this.y2 = this.y1 + height;
    } else {
      this.y1 = this.y2 + height;
    }
  }
  set left(left) {
    this.x = left;
  }
  set top(top) {
    this.y = top;
  }
  set right(right) {
    if (this.x1 <= this.x2) {
      this.x2 = right;
    } else {
      this.x1 = right;
    }
  }
  set bottom(bottom) {
    if (this.y1 <= this.y2) {
      this.y2 = bottom;
    } else {
      this.y1 = bottom;
    }
  }
}
