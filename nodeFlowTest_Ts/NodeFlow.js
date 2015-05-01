///<reference path="pim.d.ts" />
///<reference path="Vector2.ts" />
///<reference path="TimedCaller.ts" />
///<reference path="Rect.ts" />
///<reference path="NfNode.ts" />
///<reference path="NfConnector.ts" />
///<reference path="NfLink.ts" />
///<reference path="NfSettler.ts" />
// possible actions a NodeFlow can be performing
var NodeFlowAction;
(function (NodeFlowAction) {
    NodeFlowAction[NodeFlowAction["none"] = 0] = "none";
    NodeFlowAction[NodeFlowAction["panning"] = 1] = "panning";
})(NodeFlowAction || (NodeFlowAction = {}));

var NfDirtyState;
(function (NfDirtyState) {
    NfDirtyState[NfDirtyState["none"] = 0] = "none";
    NfDirtyState[NfDirtyState["nodesChanged"] = 1 << 0] = "nodesChanged";
    NfDirtyState[NfDirtyState["linksChanged"] = 1 << 1] = "linksChanged";
})(NfDirtyState || (NfDirtyState = {}));

var NfUpdateReason;
(function (NfUpdateReason) {
    NfUpdateReason[NfUpdateReason["none"] = 0] = "none";
    NfUpdateReason[NfUpdateReason["Add"] = 1] = "Add";
    NfUpdateReason[NfUpdateReason["Remove"] = 2] = "Remove";
    NfUpdateReason[NfUpdateReason["NodeSizeChanged"] = 3] = "NodeSizeChanged";
    NfUpdateReason[NfUpdateReason["SelectionChanged"] = 4] = "SelectionChanged";
    NfUpdateReason[NfUpdateReason["NodeClose"] = 5] = "NodeClose";
})(NfUpdateReason || (NfUpdateReason = {}));

var NodeFlow = (function () {
    function NodeFlow(updateHandler) {
        var _this = this;
        //#region private Data members
        this._wasPanning = false;
        this._nodeFlowAction = 0 /* none */;
        this._refreshFPS = 20;
        this._startPanMouseOffset = new Vector2();
        this._isPanTargetSet = false;
        this._maximizedNode = null;
        this._preMaximizeScroll = new Vector2();
        this._preMaximizeOverflow = "scroll";
        this._connectorFanout = 1.0;
        this._splineBulge = 1;
        this._useSplines = true;
        this._dirtyState = 0 /* none */;
        this._toggleNodeMinMaxState = false;
        //#endregion
        //#region public Data members
        this.useCustomLinkIntersection = true;
        this.maximumSplineBulge = 1.5;
        this.xmlns = "http://www.w3.org/2000/svg";
        this.scrollingLeeway = new Vector2(500, 500);
        this.allowCycles = false;
        this.miniatureViewRect = new Rect(-25, 5, 100, 100);
        this.autoPanMargin = new Vector2(20, 20);
        this.defaultAutoPanSpeed = .3;
        this.autoPanSpeed = this.defaultAutoPanSpeed;
        this.useAutoPan = true;
        this.panMarginFractionOfView = 0.65;
        this.panSpeed = 0.05;
        this.useShakeDisconnect = true;
        this.nodes = [];
        this.links = [];
        //#region event listeners
        this._doubleClickEventHandler = function (e) {
            if (!NfConnector.draggingLooseConnector && !_this.maximizedNode && !_this.getHitNode(_this.getClientMousePosition(e))) {
                _this._toggleNodeMinMaxState = !_this._toggleNodeMinMaxState;
                console.log("this._toggleNodeMinMaxState = " + _this._toggleNodeMinMaxState);
                for (var n in _this.nodes)
                    _this.nodes[n].minMaxState = _this._toggleNodeMinMaxState ? 1 /* minimized */ : 0 /* normal */;
            }
        };
        this._mousedownEventHandler = function (e) {
            if (NfConnector.draggingLooseConnector || _this.maximizedNode)
                return;
            var mousePos = _this.getClientMousePosition(e);
            var hitNode = _this.getHitNode(mousePos);

            //console.log("hit node: " + (hitNode != null ? hitNode.name : "none"));
            if (!hitNode) {
                var hitElement = document.elementFromPoint(mousePos.x, mousePos.y);

                //console.log("hit element at " + mousePos + ": <" + (hitElement ? hitElement.nodeName : "none") + ">");
                if (!hitElement || hitElement.nodeName.toLowerCase() != "div") {
                    _this._nodeFlowAction = 1 /* panning */;
                    _this._wasPanning = false;
                    _this._startPanMouseOffset = Vector2.minus(mousePos, _this.scrollOffset);
                    _this.rootElement.style.cursor = "all-scroll";
                    window.addEventListener("mousemove", _this._mousemoveEventHandler);
                    window.addEventListener("mouseup", _this._mouseupEventHandler);
                    e.stopPropagation();
                    e.preventDefault();
                }
            }
        };
        this._mousemoveEventHandler = function (e) {
            if (NfConnector.draggingLooseConnector)
                return;
            switch (_this._nodeFlowAction) {
                case 0 /* none */:
                    break;
                case 1 /* panning */:
                    var mousePos = _this.getClientMousePosition(e);
                    var oldScrollOffset = _this.scrollOffset;
                    var delta = Vector2.minus(Vector2.minus(mousePos, _this._startPanMouseOffset), oldScrollOffset);
                    if (_this._wasPanning = _this.pan(delta, true))
                        _this._startPanMouseOffset = Vector2.minus(_this._startPanMouseOffset, Vector2.minus(_this.scrollOffset, oldScrollOffset));
                    _this.setAutoPanning(false);
                    e.stopPropagation();
                    e.preventDefault();
                    break;
            }
        };
        this._mouseupEventHandler = function (e) {
            if (NfConnector.draggingLooseConnector)
                return;
            switch (_this._nodeFlowAction) {
                case 0 /* none */:
                    break;
                case 1 /* panning */:
                    if (!_this._wasPanning)
                        _this.unSelectAllNodes();
                    _this.rootElement.style.cursor = "default";

                    window.removeEventListener("mousemove", _this._mousemoveEventHandler);
                    window.removeEventListener("mouseup", _this._mouseupEventHandler);

                    e.stopPropagation();
                    e.preventDefault();
                    break;
            }
            _this._nodeFlowAction = 0 /* none */;
        };
        this.rootElement = pimGui.merge(document.createElement("div"), { id: "root" }, {
            "background-color": "rgb(150,150,150)",
            border: "1px solid rgba(50,50,50,0.4)",
            overflow: "auto"
        });
        this.paperElement = pimGui.merge(document.createElement("div"), { id: "paper" }, {
            border: "0px",
            position: "relative"
        });
        this.rootElement.appendChild(this.paperElement);

        this.svgElement = document.createElementNS(this.xmlns, "svg");
        this.paperElement.appendChild(this.svgElement);

        document.body.appendChild(this.rootElement);

        this.registerEventHandlers(true);
        this._updateHandler = updateHandler;

        this.refreshFPS = this.refreshFPS; // note: we update here, to kick in the event handler

        console.log("The NodeFlow elements on this page are controlled by nodeFlowJS 0.0.23. ©2015 Walrus Graphics.");
    }
    //#endregion
    // helper methods
    NodeFlow.isControlPressed = function (e) {
        return (e.getModifierState && e.getModifierState("Control")) || e.ctrlKey;
    };

    //#region properties
    NodeFlow.prototype.makeDirty = function (flag) {
        this._dirtyState |= flag;
    };

    NodeFlow.prototype.updateAllLinks = function () {
        for (var l in this.links)
            this.links[l].update();
    };

    Object.defineProperty(NodeFlow.prototype, "useSplines", {
        get: function () {
            return this._useSplines;
        },
        set: function (value) {
            if (this._useSplines == value)
                return;
            this._useSplines = value;
            this.updateAllLinks();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NodeFlow.prototype, "splineBulge", {
        get: function () {
            return this._splineBulge;
        },
        set: function (value) {
            var value = Math.max(Math.min(value, 2), 0);
            if (this._splineBulge == value)
                return;
            this._splineBulge = value;
            this.updateAllLinks();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NodeFlow.prototype, "connectorFanout", {
        get: function () {
            return this._connectorFanout;
        },
        set: function (value) {
            var value = Math.max(Math.min(value, 1), 0);
            if (this._connectorFanout == value)
                return;
            this._connectorFanout = value;
            this.updateAllLinks();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NodeFlow.prototype, "scrollOffset", {
        get: function () {
            return new Vector2(this.rootElement.scrollLeft, this.rootElement.scrollTop);
        },
        set: function (value) {
            this.rootElement.scrollLeft = value.x;
            this.rootElement.scrollTop = value.y;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NodeFlow.prototype, "maximizedNode", {
        get: function () {
            return this._maximizedNode;
        },
        set: function (value) {
            var _this = this;
            var updateTopologyElement = value || this.maximizedNode;
            if (value) {
                if (!this.maximizedNode) {
                    this._preMaximizeScroll = this.scrollOffset;
                    this._preMaximizeOverflow = this.rootElement.style.overflow;
                }
                this.rootElement.style.overflow = "hidden";
                this.scrollOffset = new Vector2();
                this.rootElement.style.width = this.rootElement.style.height = this.paperElement.style.width = this.paperElement.style.height = "100%";
            } else {
                this.rootElement.style.overflow = this._preMaximizeOverflow;
                this.rootElement.style.width = this.rootElement.style.height = this.paperElement.style.width = this.paperElement.style.height = null;
                this.scrollOffset = this._preMaximizeScroll;
            }
            this._maximizedNode = value;
            pimGui.merge(this.svgElement, undefined, {
                visibility: this._maximizedNode ? "collapse" : "visible",
                display: this._maximizedNode ? "none" : "inline"
            });

            this.isMiniatureViewVisible = (!this._maximizedNode) && (this.nodes.length > 0);
            this.forEach(this.nodes, function (node) {
                if (node != _this._maximizedNode)
                    node.isVisible = !_this._maximizedNode;
            });
            this.minimizePaper();
            this.refresh();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NodeFlow.prototype, "refreshFPS", {
        // the refresh rate interval (in Frames Per Second)
        get: function () {
            return this._refreshFPS;
        },
        set: function (value) {
            var _this = this;
            this._refreshFPS = value;

            // clear out any pending handler
            if (this._refreshTimedCaller) {
                this._refreshTimedCaller.cleanup();
                this._refreshTimedCaller = null;
            }

            // install the fresh handler
            if (this._refreshFPS > 0)
                this._refreshTimedCaller = new TimedCaller(this._refreshFPS, function () {
                    if (_this._isPanTargetSet)
                        _this.handlePanTarget();
                    if (_this._dirtyState != 0 /* none */)
                        _this.refresh();
                    if (NfConnector.isDraggingTangentDirty && NfConnector.draggingLooseConnector)
                        NfConnector.draggingLooseConnector.updateLinks();
                });
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NodeFlow.prototype, "clientRect", {
        // the nodeFlow's local rect (= always (0,0,width,height))
        get: function () {
            var cs = getComputedStyle(this.rootElement);
            return new Rect(0, 0, parseInt(cs.width, 10), parseInt(cs.height, 10));
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeFlow.prototype, "paperRect", {
        get: function () {
            var cs = getComputedStyle(this.paperElement);
            return new Rect(0, 0, parseInt(cs.width, 10), parseInt(cs.height, 10));
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NodeFlow.prototype, "panMargin", {
        // the leeway we give a the sides for panning
        get: function () {
            var cs = getComputedStyle(this.paperElement);
            return new Vector2(parseInt(cs.width, 10) * this.panMarginFractionOfView, parseInt(cs.height, 10) * this.panMarginFractionOfView);
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NodeFlow.prototype, "isAutoPanning", {
        get: function () {
            return !!this._autoPanTimedCaller;
        },
        enumerable: true,
        configurable: true
    });
    NodeFlow.prototype.setAutoPanning = function (value, func) {
        var _this = this;
        if (this._autoPanTimedCaller) {
            this._autoPanTimedCaller.cleanup();
            this._autoPanTimedCaller = null;
        }

        if (this.useAutoPan && value && func && func())
            this._autoPanTimedCaller = new TimedCaller(50, function () {
                if (!func())
                    _this.setAutoPanning(false);
            });
    };

    //#region public methods
    // add an NfNode to the NodeFlow
    NodeFlow.prototype.addNode = function (node, triggerUpdate) {
        if (typeof triggerUpdate === "undefined") { triggerUpdate = true; }
        if (!node)
            return;
        this.paperElement.appendChild(node.mainElement);
        this.nodes.push(node);
        node.nodeFlow = this;
        this.makeDirty(NfDirtyState.nodesChanged);
        this.isMiniatureViewVisible = true;
        if (triggerUpdate)
            this._updateTopology(node, 1 /* Add */);
        return node;
    };

    // remove an NfNode from the NodeFlow
    NodeFlow.prototype.removeNode = function (node, triggerUpdate) {
        if (typeof triggerUpdate === "undefined") { triggerUpdate = true; }
        if (!node)
            return;
        var index = this.nodes.indexOf(node);
        if (index < 0)
            return;
        this.nodes.splice(index, 1);
        this.paperElement.removeChild(node.mainElement);
        node.nodeFlow = null;
        this.isMiniatureViewVisible = (this.nodes.length > 0);
        if (triggerUpdate)
            this._updateTopology(node, 2 /* Remove */);
        if (this.nodes.length <= 0)
            this.minimizePaper();
        this.makeDirty(NfDirtyState.nodesChanged);
        return node;
    };

    NodeFlow.prototype.addLink = function (link, triggerUpdate) {
        if (typeof triggerUpdate === "undefined") { triggerUpdate = true; }
        if (!link)
            return;
        this.links.push(link);
        link.nodeFlow = this;
        if (triggerUpdate)
            this._updateTopology(link, 1 /* Add */);
        return link;
    };

    NodeFlow.prototype.removeLink = function (link, triggerUpdate) {
        if (typeof triggerUpdate === "undefined") { triggerUpdate = true; }
        if (!link)
            return;
        var index = this.links.indexOf(link);
        if (index < 0)
            return;
        this.links.splice(index, 1);
        link.cleanup();
        if (triggerUpdate)
            this._updateTopology(link, 2 /* Remove */);
        return link;
    };

    NodeFlow.prototype.getClosestHitConnector = function (position) {
        var closestConnector = null;
        var closestSqrDistance = Number.MAX_VALUE;
        for (var t in this.nodes) {
            var connector = this.nodes[t].getHitConnector(position);
            if (connector) {
                var delta = Vector2.minus(position, connector.midPosition);
                var sqrDist = delta.x * delta.x + delta.y * delta.y;
                if (sqrDist < closestSqrDistance) {
                    closestSqrDistance = sqrDist;
                    closestConnector = connector;
                }
            }
        }
        return closestConnector;
    };

    NodeFlow.prototype.getClientMousePosition = function (e) {
        var cr = this.rootElement.getBoundingClientRect();
        var cs = getComputedStyle(this.rootElement);
        var borderLeft = parseInt(cs.borderLeftWidth, 10);
        var borderTop = parseInt(cs.borderTopWidth, 10);
        var so = this.scrollOffset;
        return new Vector2(e.clientX + so.x - cr.left - 4 - borderLeft, e.clientY + so.y - cr.top - 4 - borderTop);
    };

    NodeFlow.prototype.getClientMousePositionUnScrolled = function (e) {
        var rectObject = this.rootElement.getBoundingClientRect();
        return new Vector2(e.clientX - rectObject.left + 5, e.clientY - rectObject.top + 5);
    };

    //#endregion
    //#region private methods
    NodeFlow.prototype.refresh = function () {
        if (this.maximizedNode)
            return;

        // update miniatureview if the nodes changed
        if (this._miniatureView && this.isMiniatureViewVisible && (this._dirtyState & NfDirtyState.nodesChanged))
            this._miniatureView.refresh();
        this._dirtyState = 0 /* none */;
    };

    NodeFlow.prototype.minimizePaper = function () {
        var allRect = this.allRect;
        this.paperElement.style.width = allRect.width + "px";
        this.paperElement.style.height = allRect.height + "px";
    };

    NodeFlow.prototype.pan = function (deltaPos, setDirect) {
        if (typeof setDirect === "undefined") { setDirect = false; }
        if (Vector2.isZero(deltaPos) || this.maximizedNode)
            return false;

        if (setDirect) {
            this.scrollOffset = Vector2.minus(this.scrollOffset, deltaPos);
            if (this._miniatureView)
                this._miniatureView.refresh();
            this._panTarget = this.scrollOffset;
        } else
            this._panTarget = Vector2.minus(this.scrollOffset, deltaPos);
        this._isPanTargetSet = !setDirect;
        this.updateAllLinks();
        return true;
    };

    NodeFlow.prototype.handlePanTarget = function () {
        var oldScrollOffset = this.scrollOffset;
        this.scrollOffset = Vector2.lerp(this.scrollOffset, this._panTarget, this.autoPanSpeed);
        if (Vector2.equals(oldScrollOffset, this.scrollOffset))
            this._isPanTargetSet = false;
        if (this._miniatureView)
            this._miniatureView.refresh();
    };

    Object.defineProperty(NodeFlow.prototype, "allNodesRect", {
        // get the total bounding rectangle of all nodes
        get: function () {
            var count = this.nodes.length;
            if (count <= 0)
                return new Rect(0, 0, 0, 0);
            var rect = this.nodes[0].rect;
            for (var t = 1; t < count; t++)
                rect = Rect.union(rect, this.nodes[t].rect);
            return rect;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NodeFlow.prototype, "allRect", {
        get: function () {
            var allRect = this.allNodesRect;
            var nfRect = this.clientRect;
            allRect.x = 0;
            allRect.y = 0;

            // extend the allRect to be at least the size of the view too, for nicer UI, because the user sees that, really
            allRect.width = Math.max(nfRect.width, allRect.width);
            allRect.height = Math.max(nfRect.height, allRect.height);
            if (this.nodes.length > 0) {
                allRect.width += this.scrollingLeeway.x;
                allRect.height += this.scrollingLeeway.y;
            }
            return allRect;
        },
        enumerable: true,
        configurable: true
    });

    NodeFlow.prototype.getHitLinkByRect = function (rect) {
        for (var t in this.links)
            if (this.links[t].isCurveHitByRect(rect))
                return this.links[t];
        return null;
    };

    // return the hitnode at the given position, if any
    NodeFlow.prototype.getHitNode = function (position) {
        for (var t in this.nodes)
            if (this.nodes[t].isHit(position))
                return this.nodes[t];
        return null;
    };

    NodeFlow.prototype.registerEventHandlers = function (addOrRemove) {
        this.rootElement[addOrRemove ? "addEventListener" : "removeEventListener"]("mousedown", this._mousedownEventHandler);
        this.rootElement[addOrRemove ? "addEventListener" : "removeEventListener"]("dblclick", this._doubleClickEventHandler);
    };

    //#endregion
    //#endregion
    NodeFlow.prototype.forEach = function (arr, func, reverse) {
        if (typeof reverse === "undefined") { reverse = false; }
        if (!arr)
            return;
        var l = arr.length;
        if (l <= 0)
            return;
        if (reverse)
            while (--l >= 0)
                func(arr[l]);
        else
            for (var t in arr)
                func(arr[t]);
    };

    NodeFlow.prototype.unSelectAllNodes = function () {
        this.forEach(this.nodes, function (node) {
            return node.isSelected = false;
        });
    };

    // call this method internally if the nodeflow's topology is dirty
    NodeFlow.prototype._updateTopology = function (item, updateReason) {
        if (this._updateHandler)
            this._updateHandler(item, updateReason);
    };

    Object.defineProperty(NodeFlow.prototype, "isMiniatureViewVisible", {
        get: function () {
            return !!this._miniatureView;
        },
        set: function (value) {
            if (value == this.isMiniatureViewVisible)
                return;
            if (value)
                this._miniatureView = new MiniatureView(this, this.miniatureViewRect);
            else {
                this._miniatureView.cleanup();
                this._miniatureView = null;
            }
        },
        enumerable: true,
        configurable: true
    });

    NodeFlow.prototype.cleanup = function () {
        this.refreshFPS = 0;
        this.setAutoPanning(false);
        this._updateHandler = null;
        this.isMiniatureViewVisible = false;
        this.forEach(this.links, function (link) {
            link.cleanup();
            delete link;
        }, true);
        this.forEach(this.nodes, function (node) {
            node.cleanup();
            delete node;
        }, true);
        this.registerEventHandlers(false);
        this.rootElement.removeChild(this.paperElement);
        this.svgElement = null;
        this.paperElement = null;
        document.body.removeChild(this.rootElement);
        this.rootElement = null;
    };
    return NodeFlow;
})();
//# sourceMappingURL=NodeFlow.js.map
