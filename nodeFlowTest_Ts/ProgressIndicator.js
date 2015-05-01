///<reference path="Vector2.ts" />
///<reference path="Rect.ts" />
///<reference path="pim.d.ts" />
var ProgressIndicator = (function () {
    function ProgressIndicator() {
        this._isVisible = undefined;
        this._cycle = 0;
        this._isBusy = false;
        this._progress = 0;
        this.radius = 0.43;
        this.lineWidth = 1.5;
        this.strokeColor = "black";
        this.textCenter = new Vector2(.2, .675);
        this.busyBlinkSpeed = 0.25;
        this.mainElement = pimGui.merge(document.createElement("canvas"), { className: "ProgressIndicatorCanvas" });
    }
    Object.defineProperty(ProgressIndicator.prototype, "progress", {
        get: function () {
            return this._progress;
        },
        set: function (value) {
            this._isBusy = false;
            this._progress = Math.max(Math.min(value, 1), 0);
            this.refresh();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(ProgressIndicator.prototype, "isBusy", {
        get: function () {
            return this._isBusy;
        },
        set: function (value) {
            this._isBusy = value;
            if (this.isVisible)
                this.refresh();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(ProgressIndicator.prototype, "isVisible", {
        get: function () {
            return this._isVisible;
        },
        set: function (value) {
            if (this._isVisible == value)
                return;
            this._isVisible = value;
            pimGui.merge(this.mainElement, undefined, {
                visibility: value ? "visible" : "collapse",
                display: value ? "inline" : "none",
                width: value ? "undefined" : "0"
            });
            if (value)
                this.refresh();
        },
        enumerable: true,
        configurable: true
    });

    ProgressIndicator.prototype.refresh = function () {
        var cs = getComputedStyle(this.mainElement);
        var w = parseInt(cs.width);
        var h = parseInt(cs.height);

        if (this.mainElement.width != w)
            this.mainElement.width = w;

        if (this.mainElement.height != h)
            this.mainElement.height = h;

        if (this.isBusy) {
            var ctx = this.mainElement.getContext("2d");
            this._cycle += this.busyBlinkSpeed;
            var c = Math.floor((Math.sin(this._cycle) + 1) * 127);
            ctx.fillStyle = "rgb(" + c + "," + c + "," + c + ")";
            ctx.fillRect(4, 4, w - 8, h - 8);
            ctx.strokeRect(2, 2, w - 4, h - 4);
        } else {
            var percentage = Math.floor(this._progress * 100);
            if (this._progressPercentage == percentage)
                return;
            this._progressPercentage = percentage;
            var startAngle = -Math.PI / 2;
            var endAngle = startAngle + Math.PI * this._progressPercentage / 50;
            var ctx = this.mainElement.getContext("2d");
            ctx.fillStyle = cs.backgroundColor;
            ctx.fillRect(0, 0, w, h);
            ctx.lineWidth = this.lineWidth;
            ctx.strokeStyle = this.strokeColor;
            ctx.fillStyle = this.strokeColor;
            ctx.beginPath();
            ctx.arc(w * .5, h * .5, Math.min(w, h) * this.radius, startAngle, endAngle);
            ctx.stroke();
            var pct = Math.min(this._progressPercentage, 99);
            var str = pct.toString();
            if (str.length <= 1)
                str = "0" + str;
            ctx.font = (Math.floor(h * .5) + 1) + "px Arial";
            ctx.fillText(str, w * this.textCenter.x, h * this.textCenter.y);
        }
    };

    ProgressIndicator.prototype.cleanup = function () {
        this.mainElement = null;
    };
    return ProgressIndicator;
})();
//# sourceMappingURL=ProgressIndicator.js.map
