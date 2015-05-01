///<reference path="Vector2.ts" />

class Rect {
    //#region Properties
    get left(): number { return this.x; }
    set left(value: number) { this.x = value; }

    get right(): number { return this.x + this.width; }
    set right(value: number) { this.width = Math.max(0, value - this.x); }

    get top(): number { return this.y; }
    set top(value: number) { this.y = value; }

    get bottom(): number { return this.y + this.height; }
    set bottom(value: number) { this.height = Math.max(0, value - this.y); }

    get position(): Vector2 { return new Vector2(this.x, this.y); }
    set position(value: Vector2) { this.x = value.x; this.y = value.y; }

    get size(): Vector2 { return new Vector2(this.width, this.height); }
    set size(value: Vector2) { this.width = value.x; this.height = value.y; }

    get mid(): Vector2 { return new Vector2(this.x + this.width * .5, this.y + this.height * .5); }
    set mide(value: Vector2) { this.x = value.x - this.width * .5; this.y = value.y + this.height * .5; }
    //#endregion

    //#region public Methods 
    public static equals(a: Rect, b: Rect) { return (a.x == b.x && a.y == b.y && a.width == b.width && a.height == b.height); }
    public equals(other: Rect) { return (this.x == other.x && this.y == other.y && this.width == other.width && this.height == other.height); }

    // is a position contained within the rect?
    public contains(position: Vector2): boolean {
        return (position.x >= this.x &&
            position.y >= this.y &&
            position.x < this.right &&
            position.y < this.bottom);
    }
    public static pointInRect(rect: Rect, v: Vector2): boolean {
        return rect.left <= v.x && rect.top <= v.y && rect.right > v.x && rect.bottom > v.y;
    }
    public static contains(rect1: Rect, rect2: Rect): boolean {
        return rect1.x <= rect2.x && rect1.y <= rect2.y && rect1.right >= rect2.right && rect1.bottom >= rect2.bottom;
    }
    public static intersectsWith(rect1: Rect, rect2: Rect): boolean {
        return rect2.x <= rect1.right && rect2.right >= rect1.x && rect2.y <= rect1.bottom && rect2.bottom >= rect1.y;
    }
    public static union(rect1: Rect, rect2: Rect): Rect {
        var x = Math.min(rect1.x, rect2.x);
        var y = Math.min(rect1.y, rect2.y);
        return new Rect(x, y, Math.max(rect1.right, rect2.right) - x, Math.max(rect1.bottom, rect2.bottom) - y);
    }
    public static scale(rect: Rect, scale: number): Rect {
        return new Rect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
    }
    public static minSize(rect: Rect, minWidth: number, minHeight: number): Rect {
        return new Rect(rect.x, rect.y, Math.max(rect.width, minWidth), Math.max(rect.height, minHeight));
    }
    public static minSizeVec(rect: Rect, minSize: Vector2): Rect {
        return new Rect(rect.x, rect.y, Math.max(rect.width, minSize.x), Math.max(rect.height, minSize.y));
    }
    public static expand(rect: Rect, extra: Vector2): Rect {
        return new Rect(rect.x - extra.x * .5, rect.y - extra.y * .5, rect.width + extra.x, rect.height + extra.y);
    }
    public static contract(rect: Rect, extra: Vector2): Rect {
        return Rect.expand(rect, Vector2.minus(Vector2.zero, extra));
    }

    // get a rectangle from an element's style
    static fromHTMLElementStyle(element: HTMLElement): Rect {
        return new Rect(parseInt(element.style.left, 10),
            parseInt(element.style.top, 10),
            parseInt(element.style.width, 10),
            parseInt(element.style.height, 10));
    }
    static fromHTMLElementComputedStyle(element: HTMLElement): Rect {
        var cs = getComputedStyle(element);
        return new Rect(parseInt(cs.left, 10),
            parseInt(cs.top, 10),
            parseInt(cs.width, 10),
            parseInt(cs.height, 10));
    }
    static fromHTMLElementRecursivePositionComputedSize(element: HTMLElement, stopAtElement: HTMLElement = null): Rect {
        var pos = Vector2.fromHTMLElementOffsetRecursive(element, stopAtElement);
        var cs = getComputedStyle(element);
        return new Rect(pos.x, pos.y,
            parseInt(cs.width, 10),
            parseInt(cs.height, 10));
    }
    // set a rectangle to an element's style
    setToHTMLElementStyle(element: HTMLElement): Rect {
        pimGui.merge(element, undefined, { left: this.x + "px", top: this.y + "px", width: this.width + "px", height: this.height + "px" });
        return this;
    }

    toString(): string {
        return "(" + this.x + "," + this.y + "," + this.width + "," + this.height + ")";
    }

    //#endregion

    constructor(public x: number, public y: number, public width: number, public height: number) { }
}
