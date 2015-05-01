///<reference path="Vector2.ts" />
var Rect = (function () {
    //#endregion
    function Rect(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    Object.defineProperty(Rect.prototype, "left", {
        //#region Properties
        get: function () {
            return this.x;
        },
        set: function (value) {
            this.x = value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(Rect.prototype, "right", {
        get: function () {
            return this.x + this.width;
        },
        set: function (value) {
            this.width = Math.max(0, value - this.x);
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(Rect.prototype, "top", {
        get: function () {
            return this.y;
        },
        set: function (value) {
            this.y = value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(Rect.prototype, "bottom", {
        get: function () {
            return this.y + this.height;
        },
        set: function (value) {
            this.height = Math.max(0, value - this.y);
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(Rect.prototype, "position", {
        get: function () {
            return new Vector2(this.x, this.y);
        },
        set: function (value) {
            this.x = value.x;
            this.y = value.y;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(Rect.prototype, "size", {
        get: function () {
            return new Vector2(this.width, this.height);
        },
        set: function (value) {
            this.width = value.x;
            this.height = value.y;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(Rect.prototype, "mid", {
        get: function () {
            return new Vector2(this.x + this.width * .5, this.y + this.height * .5);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Rect.prototype, "mide", {
        set: function (value) {
            this.x = value.x - this.width * .5;
            this.y = value.y + this.height * .5;
        },
        enumerable: true,
        configurable: true
    });

    //#endregion
    //#region public Methods
    Rect.equals = function (a, b) {
        return (a.x == b.x && a.y == b.y && a.width == b.width && a.height == b.height);
    };
    Rect.prototype.equals = function (other) {
        return (this.x == other.x && this.y == other.y && this.width == other.width && this.height == other.height);
    };

    // is a position contained within the rect?
    Rect.prototype.contains = function (position) {
        return (position.x >= this.x && position.y >= this.y && position.x < this.right && position.y < this.bottom);
    };
    Rect.pointInRect = function (rect, v) {
        return rect.left <= v.x && rect.top <= v.y && rect.right > v.x && rect.bottom > v.y;
    };
    Rect.contains = function (rect1, rect2) {
        return rect1.x <= rect2.x && rect1.y <= rect2.y && rect1.right >= rect2.right && rect1.bottom >= rect2.bottom;
    };
    Rect.intersectsWith = function (rect1, rect2) {
        return rect2.x <= rect1.right && rect2.right >= rect1.x && rect2.y <= rect1.bottom && rect2.bottom >= rect1.y;
    };
    Rect.union = function (rect1, rect2) {
        var x = Math.min(rect1.x, rect2.x);
        var y = Math.min(rect1.y, rect2.y);
        return new Rect(x, y, Math.max(rect1.right, rect2.right) - x, Math.max(rect1.bottom, rect2.bottom) - y);
    };
    Rect.scale = function (rect, scale) {
        return new Rect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
    };
    Rect.minSize = function (rect, minWidth, minHeight) {
        return new Rect(rect.x, rect.y, Math.max(rect.width, minWidth), Math.max(rect.height, minHeight));
    };
    Rect.minSizeVec = function (rect, minSize) {
        return new Rect(rect.x, rect.y, Math.max(rect.width, minSize.x), Math.max(rect.height, minSize.y));
    };
    Rect.expand = function (rect, extra) {
        return new Rect(rect.x - extra.x * .5, rect.y - extra.y * .5, rect.width + extra.x, rect.height + extra.y);
    };
    Rect.contract = function (rect, extra) {
        return Rect.expand(rect, Vector2.minus(Vector2.zero, extra));
    };

    // get a rectangle from an element's style
    Rect.fromHTMLElementStyle = function (element) {
        return new Rect(parseInt(element.style.left, 10), parseInt(element.style.top, 10), parseInt(element.style.width, 10), parseInt(element.style.height, 10));
    };
    Rect.fromHTMLElementComputedStyle = function (element) {
        var cs = getComputedStyle(element);
        return new Rect(parseInt(cs.left, 10), parseInt(cs.top, 10), parseInt(cs.width, 10), parseInt(cs.height, 10));
    };
    Rect.fromHTMLElementRecursivePositionComputedSize = function (element, stopAtElement) {
        if (typeof stopAtElement === "undefined") { stopAtElement = null; }
        var pos = Vector2.fromHTMLElementOffsetRecursive(element, stopAtElement);
        var cs = getComputedStyle(element);
        return new Rect(pos.x, pos.y, parseInt(cs.width, 10), parseInt(cs.height, 10));
    };

    // set a rectangle to an element's style
    Rect.prototype.setToHTMLElementStyle = function (element) {
        pimGui.merge(element, undefined, { left: this.x + "px", top: this.y + "px", width: this.width + "px", height: this.height + "px" });
        return this;
    };

    Rect.prototype.toString = function () {
        return "(" + this.x + "," + this.y + "," + this.width + "," + this.height + ")";
    };
    return Rect;
})();
//# sourceMappingURL=Rect.js.map
