///<reference path="ResizeSensor.ts" />
///<reference path="Vector2.ts" />
///<reference path="Rect.ts" />
///<reference path="NfNode.ts" />
///<reference path="NfConnector.ts" />
///<reference path="NfLink.ts" />
///<reference path="NodeFlow.ts" />
// possible actions the MiniatureView can be performing
var MiniatureViewAction;
(function (MiniatureViewAction) {
    MiniatureViewAction[MiniatureViewAction["none"] = 0] = "none";
    MiniatureViewAction[MiniatureViewAction["panning"] = 1] = "panning";
})(MiniatureViewAction || (MiniatureViewAction = {}));

var MiniatureView = (function () {
    function MiniatureView(nodeFlow, rect) {
        var _this = this;
        this._overlayPanningColor = "rgba(150,150,255,0.6)";
        this._overlayColor = "rgba(200,200,200,0.2)";
        this._miniatureViewAction = 0 /* none */;
        this._previousMousePosition = new Vector2();
        //#endregion
        //#region add/remove event listeners
        this._mousedownEventHandler = function (e) {
            return _this.handleMouseDown(e);
        };
        this._mousemoveEventHandler = function (e) {
            return _this.handleMouseMove(e);
        };
        this._mouseupEventHandler = function (e) {
            return _this.handleMouseUp(e);
        };
        this._nodeFlow = nodeFlow;
        this._rect = rect;
        this._maxSizePx = new Vector2(rect.width, rect.height);
        this._nodeFlow.rootElement.appendChild(this._canvas = pimGui.merge(document.createElement("canvas"), { className: "MiniatureView" }, { position: "fixed" }));
        this._canvas.addEventListener("mousedown", this._mousedownEventHandler);
        this.refresh();
        this._resizeSensor = new ResizeSensor(this._nodeFlow.rootElement, function () {
            return _this.resize();
        });
    }
    Object.defineProperty(MiniatureView.prototype, "canvasRect", {
        //#endregion
        get: function () {
            return new Rect(0, 0, this._canvas.width, this._canvas.height);
        },
        enumerable: true,
        configurable: true
    });

    MiniatureView.prototype.getComputedStyle = function (element, propertyName) {
        if (element.currentStyle)
            return element.currentStyle[propertyName];
        else if (getComputedStyle)
            return getComputedStyle(element).getPropertyValue(propertyName);
        else
            return element.style[propertyName];
    };

    MiniatureView.prototype.resize = function () {
        var allRect = this._nodeFlow.allRect;
        if (allRect) {
            // dimension the view so that aspect is retained, and the longest side is maximally the _maxSize
            var w;
            var h;
            if (allRect.width > allRect.height) {
                w = this._maxSizePx.x;
                h = this._maxSizePx.x * allRect.height / Math.max(1, allRect.width);
            } else {
                w = (this._maxSizePx.y * allRect.width / Math.max(1, allRect.height));
                h = this._maxSizePx.y;
            }
            this._canvas.style.width = w + "px";
            this._canvas.style.height = h + "px";
        }

        var rectObject = this._nodeFlow.rootElement.getBoundingClientRect();

        var cs = getComputedStyle(this._nodeFlow.rootElement);
        var width = parseInt(cs.width, 10);
        if (width > 0)
            rectObject.right = rectObject.left + width;
        var height = parseInt(cs.height, 10);
        if (height > 0)
            rectObject.bottom = rectObject.top + height;

        this._canvas.style.left = ((this._rect.x < 0) ? (rectObject.right + this._rect.x - w) : (rectObject.left + this._rect.x)) + "px";
        this._canvas.style.top = ((this._rect.y < 0) ? (rectObject.bottom + this._rect.y - h) : (rectObject.top + this._rect.y)) + "px";
    };

    MiniatureView.prototype.refresh = function () {
        var allRect = this._nodeFlow.allRect;
        if (!allRect)
            return;
        var nfRect = this._nodeFlow.clientRect;
        var canvasRect = this.canvasRect;
        var ctx = this._canvas.getContext("2d");

        ctx.clearRect(canvasRect.x, canvasRect.y, canvasRect.width, canvasRect.height);
        this.resize();

        // now draw all miniature nodes
        ctx.fillStyle = "rgba(200,200,200,0.3)";
        ctx.strokeStyle = "rgba(220,220,220,0.4)";
        ctx.lineWidth = 3;

        var w = canvasRect.width / allRect.width;
        var h = canvasRect.height / allRect.height;
        var nodes = this._nodeFlow.nodes;
        var miniRect;
        for (var t in nodes) {
            var nodeRect = nodes[t].rect;
            miniRect = new Rect((nodeRect.x - allRect.x) * w, (nodeRect.y - allRect.y) * h, nodeRect.width * w, nodeRect.height * h);
            ctx.fillRect(miniRect.x, miniRect.y, miniRect.width, miniRect.height);
            ctx.strokeRect(miniRect.x, miniRect.y, miniRect.width, miniRect.height);
        }

        // draw the viewport overlay
        ctx.fillStyle = this._miniatureViewAction == 1 /* panning */ ? this._overlayPanningColor : this._overlayColor;
        var so = this._nodeFlow.scrollOffset;
        ctx.fillRect(so.x * w, so.y * h, nfRect.width * w, nfRect.height * h);
    };

    MiniatureView.prototype.pan = function (deltaPos) {
        if (Vector2.isZero(deltaPos))
            return;

        var allRect = this._nodeFlow.allRect;
        if (!allRect)
            return;

        // we scale the panning delta up, and forward it to the nodeflow, to do that actual panning for us... we'll get updated accordingly, and voila!  eat your own dogfood ;-)
        var canvasRect = this.canvasRect;
        this._nodeFlow.pan(new Vector2(-deltaPos.x * allRect.width * 2 / canvasRect.width, -deltaPos.y * allRect.height * 2 / canvasRect.height), true);
    };

    //#region event handlers
    MiniatureView.prototype.handleMouseDown = function (e) {
        switch (e.button) {
            case 0:
                var mousePos = this._nodeFlow.getClientMousePositionUnScrolled(e);

                // console.log("mouse down at " + mousePos);
                this._miniatureViewAction = 1 /* panning */;
                this._previousMousePosition = mousePos;
                this._canvas.style.cursor = "move";
                e.stopPropagation();
                e.preventDefault();

                window.addEventListener("mousemove", this._mousemoveEventHandler);
                window.addEventListener("mouseup", this._mouseupEventHandler);
                break;
        }
    };
    MiniatureView.prototype.handleMouseMove = function (e) {
        switch (e.button) {
            case 0:
                var mousePos = this._nodeFlow.getClientMousePositionUnScrolled(e);

                switch (this._miniatureViewAction) {
                    case 0 /* none */:
                        break;
                    case 1 /* panning */:
                        var mousePos = this._nodeFlow.getClientMousePositionUnScrolled(e);
                        this.pan(new Vector2(mousePos.x - this._previousMousePosition.x, mousePos.y - this._previousMousePosition.y));
                        this._previousMousePosition = mousePos;
                        e.stopPropagation();
                        e.preventDefault();
                        break;
                }
                break;
        }
    };
    MiniatureView.prototype.handleMouseUp = function (e) {
        switch (e.button) {
            case 0:
                var mousePos = this._nodeFlow.getClientMousePositionUnScrolled(e);

                switch (this._miniatureViewAction) {
                    case 0 /* none */:
                        break;
                    case 1 /* panning */:
                        this._miniatureViewAction = 0 /* none */;
                        this._canvas.style.cursor = "pointer";
                        e.stopPropagation();
                        e.preventDefault();
                        this.refresh();

                        window.removeEventListener("mousemove", this._mousemoveEventHandler);
                        window.removeEventListener("mouseup", this._mouseupEventHandler);
                        break;
                }
                break;
        }
    };

    //#endregion
    MiniatureView.prototype.cleanup = function () {
        this._resizeSensor.detach(this._nodeFlow.rootElement);
        this._resizeSensor = null;
        this._canvas.removeEventListener("mousedown", this._mousedownEventHandler);
        this._nodeFlow.rootElement.removeChild(this._canvas);
        this._canvas = null;
        this._nodeFlow = null;
    };
    return MiniatureView;
})();
//# sourceMappingURL=MiniatureView.js.map
