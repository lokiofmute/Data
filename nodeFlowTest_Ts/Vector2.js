var Vector2 = (function () {
    //#endregion
    function Vector2(x, y) {
        if (typeof x === "undefined") { x = 0; }
        if (typeof y === "undefined") { y = 0; }
        this.x = x;
        this.y = y;
    }
    //#endregion
    //#region static methods
    Vector2.mul = function (k, v) {
        return new Vector2(k * v.x, k * v.y);
    };
    Vector2.div = function (v, k) {
        return new Vector2(v.x / k, v.y / k);
    };
    Vector2.minus = function (v1, v2) {
        return new Vector2(v1.x - v2.x, v1.y - v2.y);
    };
    Vector2.plus = function (v1, v2) {
        return new Vector2(v1.x + v2.x, v1.y + v2.y);
    };
    Vector2.dot = function (v1, v2) {
        return v1.x * v2.x + v1.y * v2.y;
    };
    Vector2.sqrMag = function (v) {
        return v.x * v.x + v.y * v.y;
    };
    Vector2.mag = function (v) {
        return Math.sqrt(this.sqrMag(v));
    };
    Vector2.sqrDist = function (v1, v2) {
        return this.sqrMag(this.minus(v1, v2));
    };
    Vector2.dist = function (v1, v2) {
        return this.mag(this.minus(v1, v2));
    };
    Vector2.normalize = function (v) {
        var mag = Vector2.mag(v);
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return Vector2.mul(div, v);
    };
    Vector2.angle = function (v1, v2) {
        return Math.acos(Vector2.dot(v1, v2));
    };
    Vector2.angleOriented = function (v1, v2) {
        return Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
    };
    Vector2.equals = function (a, b) {
        return a.x == b.x && a.y == b.y;
    };
    Vector2.lerp = function (a, b, v) {
        return new Vector2(a.x * (1 - v) + b.x * v, a.y * (1 - v) + b.y * v);
    };
    Vector2.clamp = function (a, min, max) {
        return new Vector2(Math.max(Math.min(a.x, max), min), Math.max(Math.min(a.y, max), min));
    };
    Vector2.isZero = function (a) {
        return (a.x == 0) && (a.y == 0);
    };
    Vector2.isNearZero = function (a, delta) {
        if (typeof delta === "undefined") { delta = 0.1; }
        return Math.abs(a.x) < delta && Math.abs(a.y) < delta;
    };
    Vector2.fromHTMLElementOffsetRecursive = function (el, stopAtElement) {
        if (typeof stopAtElement === "undefined") { stopAtElement = null; }
        for (var lx = 0, ly = 0; el && el != stopAtElement; lx += el.offsetLeft, ly += el.offsetTop, el = el.offsetParent) {
        }
        ;
        return new Vector2(lx, ly);
    };

    // get a Vector2 from an element's style
    Vector2.fromHTMLElementStyleClientPosition = function (element) {
        return new Vector2(element.clientLeft, element.clientTop);
    };

    // get a Vector2 from an element's computed style position
    Vector2.fromHTMLElementComputedStylePosition = function (element) {
        var cs = getComputedStyle(element);
        return new Vector2(parseInt(cs.left), parseInt(cs.top));
    };

    // get a Vector2 from an element's computed style size
    Vector2.fromHTMLElementComputedStyleSize = function (element) {
        var cs = getComputedStyle(element);
        return new Vector2(parseInt(cs.width), parseInt(cs.height));
    };

    // clamp a vector's components to fall within the range [0,1]
    Vector2.clamp01 = function (v) {
        return new Vector2(Math.max(Math.min(v.x, 1), 0), Math.max(Math.min(v.y, 1), 0));
    };

    //#endregion
    //#region public methods
    Vector2.prototype.toString = function () {
        return "(" + this.x + "," + this.y + ")";
    };
    Vector2.StaticConstructor = (function () {
        Vector2.zero = new Vector2();
        Vector2.one = new Vector2(1, 1);
        Vector2.xAxis = new Vector2(1, 0);
        Vector2.yAxis = new Vector2(0, 1);
        return null;
    })();
    return Vector2;
})();
//# sourceMappingURL=Vector2.js.map
