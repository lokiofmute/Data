///<reference path="Vector2.ts" />
///<reference path="TimedCaller.ts" />
///<reference path="Rect.ts" />
var SplineEditor = (function () {
    function SplineEditor() {
        var _this = this;
        this.splines = [];
        this.rootElement = pimGui.merge(document.createElement("div"), { id: "root" }, {
            position: "relative",
            border: "1px solid rgba(50,50,50,0.4)",
            overflow: "hidden",
            width: "100%",
            height: "94%"
        });
        this.canvas = pimGui.merge(document.createElement("canvas"), {
            id: "canvas",
            className: "SplineEditor"
        }, {
            position: "absolute"
        });
        this.rootElement.appendChild(this.canvas);
        document.body.appendChild(this.rootElement);

        this._resizeSensor = new ResizeSensor(this.rootElement, function () {
            return _this.resize();
        });
    }
    Object.defineProperty(SplineEditor.prototype, "clientRect", {
        get: function () {
            return new Rect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
        },
        enumerable: true,
        configurable: true
    });

    SplineEditor.prototype.addSpline = function (spline) {
        this.splines.push(spline);
        return spline;
    };

    SplineEditor.prototype.removeSpline = function (spline) {
        var index = this.splines.indexOf(spline);
        if (index < 0)
            return;
        this.splines.splice(index, 1);
    };

    SplineEditor.prototype.resize = function () {
        if (!this.rootElement.parentElement)
            return;

        var measureElement = this.rootElement;
        var cs = getComputedStyle(measureElement);
        var w = parseInt(cs.width, 10);
        var h = parseInt(cs.height, 10);
        if (w != this.canvas.width || h != this.canvas.height) {
            this.canvas.width = w;
            this.canvas.height = h;
            console.log("SplineEditor canvas size: " + this.canvas.width + " x " + this.canvas.height + " on " + this.rootElement.parentElement.className);
            this.redraw();
        }
    };

    SplineEditor.prototype.redraw = function () {
        var rect = this.clientRect;
        var ctx = this.canvas.getContext("2d");
        ctx.fillStyle = "rgb(0,255,0)";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        rect = Rect.contract(rect, new Vector2(50, 50));
        ctx.fillStyle = "rgb(0,0,255)";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    };

    SplineEditor.prototype.cleanup = function () {
        this._resizeSensor.detach(this.rootElement);
        this._resizeSensor = null;
        this.rootElement.removeChild(this.canvas);
        this.canvas = null;
        document.body.removeChild(this.rootElement);
        this.rootElement = null;
    };
    return SplineEditor;
})();
//# sourceMappingURL=SplineEditor.js.map
