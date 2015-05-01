class Vector2 {
    //#region predefined objects
    static zero: Vector2;
    static one: Vector2;
    static xAxis: Vector2;
    static yAxis: Vector2;

    // static constructor to initialize the predefined static objects
    private static StaticConstructor = (() => {
        Vector2.zero = new Vector2();
        Vector2.one = new Vector2(1, 1);
        Vector2.xAxis = new Vector2(1, 0);
        Vector2.yAxis = new Vector2(0, 1);
        return null;
    })();
    //#endregion

    //#region static methods
    static mul(k: number, v: Vector2): Vector2 { return new Vector2(k * v.x, k * v.y); }
    static div(v: Vector2, k: number): Vector2 { return new Vector2(v.x / k, v.y / k); }
    static minus(v1: Vector2, v2: Vector2): Vector2 { return new Vector2(v1.x - v2.x, v1.y - v2.y); }
    static plus(v1: Vector2, v2: Vector2): Vector2 { return new Vector2(v1.x + v2.x, v1.y + v2.y); }
    static dot(v1: Vector2, v2: Vector2): number { return v1.x * v2.x + v1.y * v2.y; }
    static sqrMag(v: Vector2): number { return v.x * v.x + v.y * v.y; }
    static mag(v: Vector2): number { return Math.sqrt(this.sqrMag(v)); }
    static sqrDist(v1: Vector2, v2: Vector2): number { return this.sqrMag(this.minus(v1, v2)); }
    static dist(v1: Vector2, v2: Vector2): number { return this.mag(this.minus(v1, v2)); }
    static normalize(v: Vector2): Vector2 {
        var mag = Vector2.mag(v);
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return Vector2.mul(div, v);
    }
    static angle(v1: Vector2, v2: Vector2): number { return Math.acos(Vector2.dot(v1, v2)); }
    static angleOriented(v1: Vector2, v2: Vector2): number { return Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x); }
    static equals(a: Vector2, b: Vector2): boolean { return a.x == b.x && a.y == b.y; }
    static lerp(a: Vector2, b: Vector2, v: number): Vector2 { return new Vector2(a.x * (1 - v) + b.x * v, a.y * (1 - v) + b.y * v); }
    static clamp(a: Vector2, min: number, max: number) { return new Vector2(Math.max(Math.min(a.x, max), min), Math.max(Math.min(a.y, max), min)); }
    static isZero(a: Vector2): boolean { return (a.x == 0) && (a.y == 0); }
    static isNearZero(a: Vector2, delta: number = 0.1): boolean { return Math.abs(a.x) < delta && Math.abs(a.y) < delta; }
    static fromHTMLElementOffsetRecursive(el: any, stopAtElement:HTMLElement = null) {
        for (var lx = 0, ly = 0; el && el != stopAtElement; lx += el.offsetLeft, ly += el.offsetTop, el = el.offsetParent) { };
        return new Vector2(lx, ly);
    }
    // get a Vector2 from an element's style
    static fromHTMLElementStyleClientPosition(element: HTMLElement): Vector2 { return new Vector2(element.clientLeft, element.clientTop); }
    // get a Vector2 from an element's computed style position
    static fromHTMLElementComputedStylePosition(element: HTMLElement): Vector2 {
        var cs = getComputedStyle(element);
        return new Vector2(parseInt(cs.left), parseInt(cs.top));
    }
    // get a Vector2 from an element's computed style size
    static fromHTMLElementComputedStyleSize(element: HTMLElement): Vector2 {
        var cs = getComputedStyle(element);
        return new Vector2(parseInt(cs.width), parseInt(cs.height));
    }
    // clamp a vector's components to fall within the range [0,1]
    static clamp01(v: Vector2): Vector2 { return new Vector2(Math.max(Math.min(v.x, 1), 0), Math.max(Math.min(v.y, 1), 0)); }
    //#endregion

    //#region public methods
    public toString() { return "(" + this.x + "," + this.y + ")"; }
    //#endregion

    constructor(public x: number = 0, public y: number = 0) { }
}
