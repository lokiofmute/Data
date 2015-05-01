///<reference path="Vector2.ts" />
///<reference path="Rect.ts" />
///<reference path="NfConnector.ts" />
///<reference path="NfLink.ts" />
///<reference path="ShakeDetector.ts" />
///<reference path="ProgressIndicator.ts" />
// possible actions an NfNode can be performing
var NfNodeAction;
(function (NfNodeAction) {
    NfNodeAction[NfNodeAction["none"] = 0] = "none";
    NfNodeAction[NfNodeAction["dragHeader"] = 1] = "dragHeader";
    NfNodeAction[NfNodeAction["resizing"] = 2] = "resizing";
})(NfNodeAction || (NfNodeAction = {}));

var NfNodeState;
(function (NfNodeState) {
    NfNodeState[NfNodeState["none"] = 0] = "none";
    NfNodeState[NfNodeState["isSelected"] = 1 << 0] = "isSelected";
    NfNodeState[NfNodeState["isPassThrough"] = 1 << 1] = "isPassThrough";
    NfNodeState[NfNodeState["isController"] = 1 << 2] = "isController";
    NfNodeState[NfNodeState["isInvalid"] = 1 << 3] = "isInvalid";
    NfNodeState[NfNodeState["isVisible"] = 1 << 4] = "isVisible";
})(NfNodeState || (NfNodeState = {}));

var NfMinMaxState;
(function (NfMinMaxState) {
    NfMinMaxState[NfMinMaxState["normal"] = 0] = "normal";
    NfMinMaxState[NfMinMaxState["minimized"] = 1] = "minimized";
    NfMinMaxState[NfMinMaxState["maximized"] = 2] = "maximized";
})(NfMinMaxState || (NfMinMaxState = {}));

// possible capabilities of an NfNode
var NfNodeCaps;
(function (NfNodeCaps) {
    NfNodeCaps[NfNodeCaps["none"] = 0] = "none";
    NfNodeCaps[NfNodeCaps["hasCloseButton"] = 1 << 0] = "hasCloseButton";
    NfNodeCaps[NfNodeCaps["askCloseConfirm"] = 1 << 1] = "askCloseConfirm";
    NfNodeCaps[NfNodeCaps["hasPassThroughButton"] = 1 << 2] = "hasPassThroughButton";
    NfNodeCaps[NfNodeCaps["hasMaximizeButton"] = 1 << 3] = "hasMaximizeButton";
    NfNodeCaps[NfNodeCaps["showProgressIndicator"] = 1 << 4] = "showProgressIndicator";
    NfNodeCaps[NfNodeCaps["showBusyIndicator"] = 1 << 5] = "showBusyIndicator";
    NfNodeCaps[NfNodeCaps["hasControllerButton"] = 1 << 6] = "hasControllerButton";

    // the default caps combination
    NfNodeCaps[NfNodeCaps["defaultCaps"] = NfNodeCaps.none | NfNodeCaps.hasCloseButton | NfNodeCaps.hasPassThroughButton | NfNodeCaps.hasMaximizeButton] = "defaultCaps";
})(NfNodeCaps || (NfNodeCaps = {}));

// an NfNode is a NodeFlow Node, it represents a single block on the NodeFlow.
var NfNode = (function () {
    function NfNode(nodeFlow, rect, name, caps) {
        if (typeof name === "undefined") { name = undefined; }
        if (typeof caps === "undefined") { caps = NfNodeCaps.defaultCaps; }
        var _this = this;
        this._nfConnectors = [];
        this._previousAutoPanVector = new Vector2(-9999, -9999);
        this._normalRect = new Rect(0, 0, 0, 0);
        this._originalRect = new Rect(0, 0, 0, 0);
        this._normalCaps = NfNodeCaps.defaultCaps;
        this._preMinimizeRect = new Rect(0, 0, 0, 0);
        this._preMinimizeCaps = NfNodeCaps.defaultCaps;
        this._state = 0 /* none */;
        this._minMaxState = 0 /* normal */;
        this._previousMinMaxState = 0 /* normal */;
        this._resizeStartOffset = new Vector2();
        this.connectorRelativeMid = new Vector2();
        this.defaultMinimalNodeSize = new Vector2(115, 25);
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
        this._dblclickEventHandler = function (e) {
            return _this.handleMouseDoubleClick(e);
        };
        this._maximizeMouseEnter = function (e) {
            return _this.handleMaximizeMouseEnter(e);
        };
        this._maximizeMouseMove = function (e) {
            return _this.handleMaximizeMouseMove(e);
        };
        this._maximizeMouseDown = function (e) {
            return _this.handleMaximizeMouseDown(e);
        };
        this._resizeMousedownEventHandler = function (e) {
            return _this.handleResizeMouseDown(e);
        };
        this._resizeMousemoveEventHandler = function (e) {
            return _this.handleResizeMouseMove(e);
        };
        this._resizeMouseupEventHandler = function (e) {
            return _this.handleResizeMouseUp(e);
        };
        this.nodeFlow = nodeFlow;
        this._progressIndicator = new ProgressIndicator();

        // make the dragging header (which also carries the name of the node)
        this._headerGroup = pimGui.merge(pimGui.hflex(this._closeButton = pimGui.merge(pimGui.pimButton("X", function () {
            return _this.close();
        }), { className: "nodeCloseButton" }), this._passThroughButton = pimGui.merge(pimGui.pimButton("P", function () {
            return _this.isPassThrough = !_this.isPassThrough;
        }), { className: "nodePassThroughButton" }), this._controllerButton = pimGui.merge(pimGui.pimButton("C", function () {
            return _this.isController = !_this.isController;
        }), { className: "nodeControllerButton" }), this._header = pimGui.merge(pimGui.pimLabel(name || "Node_" + nodeFlow.nodes.length), { className: "nodeHeader" }), this._progressIndicator.mainElement, this._maximizeButton = pimGui.merge(pimGui.pimButton("-", function (e) {
            return _this.cycleMinMaxState(!e.ctrlKey);
        }), { className: "nodeMaximizeButton" })), { className: "nodeHeaderFlex" });

        // the container that will hold useful stuff
        this.mainBody = this.makeBody();

        // make the main element, and hook up the contents to it, add the node to the nodeflow as a child element
        this.mainElement = pimGui.merge(pimGui.pimGroup(this._headerGroup, this.mainBody), { className: "nodeBody", draggable: false });

        this._resizer = pimGui.merge(document.createElement("div"), { className: "nodeResizer" });
        this.mainElement.appendChild(this._resizer);
        this.mainElement.appendChild(this._passThroughOverlay = pimGui.merge(document.createElement("div"), { className: "nodePassThroughOverlay" }));

        // equip the dragging header with the necessary event handlers for dragging
        this.registerEventHandlers(true);

        // and stuff it in the nodeflow's nodes collection
        nodeFlow.addNode(this);

        this.rect = this._normalRect = this._originalRect = rect;
        this.caps = this._normalCaps = caps;
        this.nodeAction = 0 /* none */;
        this._unSelectedBackgroundColor = this.mainElement.style.backgroundColor;

        this.nodeFlow.unSelectAllNodes();
        this.isSelected = true;
    }
    Object.defineProperty(NfNode.prototype, "name", {
        //#endregion
        //#region Properties
        // the node's name
        get: function () {
            return this._header.innerHTML;
        },
        set: function (value) {
            this._header.innerHTML = value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "caps", {
        // the capabilities of the node
        get: function () {
            return this._caps;
        },
        set: function (value) {
            if (this._caps == value)
                return;
            this._caps = value;

            var hasCloseButton = (this._caps & NfNodeCaps.hasCloseButton);
            pimGui.merge(this._closeButton, undefined, {
                visibility: hasCloseButton ? "visible" : "collapse",
                display: hasCloseButton ? "inline" : "none",
                width: hasCloseButton ? "undefined" : "0"
            });

            var hasPassThroughButton = (this._caps & NfNodeCaps.hasPassThroughButton);
            pimGui.merge(this._passThroughButton, undefined, {
                visibility: hasPassThroughButton ? "visible" : "collapse",
                display: hasPassThroughButton ? "inline" : "none",
                width: hasPassThroughButton ? "undefined" : "0"
            });

            var hasControllerButton = (this._caps & NfNodeCaps.hasControllerButton);
            pimGui.merge(this._controllerButton, undefined, {
                visibility: hasControllerButton ? "visible" : "collapse",
                display: hasControllerButton ? "inline" : "none",
                width: hasControllerButton ? "undefined" : "0"
            });

            var hasMaximizeButton = (this.caps & NfNodeCaps.hasMaximizeButton);
            pimGui.merge(this._maximizeButton, undefined, {
                visibility: hasMaximizeButton ? "visible" : "collapse",
                display: hasMaximizeButton ? "inline" : "none",
                width: hasMaximizeButton ? "undefined" : "0"
            });

            this._progressIndicator.isVisible = !!(this.caps & (NfNodeCaps.showProgressIndicator | NfNodeCaps.showBusyIndicator));
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "connectors", {
        // get all connectors that are attached to this node
        get: function () {
            return this._nfConnectors;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NfNode.prototype, "connectorCount", {
        get: function () {
            return this._nfConnectors ? this._nfConnectors.length : 0;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "links", {
        // get all links that are attached to this node's connectors
        get: function () {
            var arr = [];
            for (var c in this.connectors) {
                var cl = this.connectors[c].links;
                for (var l in cl)
                    arr.push(cl[l]);
            }
            return arr;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "hasLinks", {
        get: function () {
            for (var c in this.connectors)
                if (this.connectors[c].links.length > 0)
                    return true;
            return false;
        },
        enumerable: true,
        configurable: true
    });

    // is the node connected to the given connector somehow upstream?
    NfNode.prototype.isConnected = function (connector, upStream) {
        for (var c in this.connectors) {
            var conn = this.connectors[c];
            if (conn === connector)
                return true;
            if ((upStream && conn.kind & NfConnectorKind.Input) || (!upStream && conn.kind & NfConnectorKind.Output)) {
                for (var l in conn.links) {
                    var otherConn = conn.links[l].theOtherConnector(conn);
                    if (otherConn.node && otherConn.node.isConnected(connector, upStream))
                        return true;
                }
            }
        }
        return false;
    };

    Object.defineProperty(NfNode.prototype, "incomingLinks", {
        // get all incoming links that are attached to this node
        get: function () {
            var _this = this;
            return this.nodeFlow.links.filter(function (link) {
                return link.connectorB.node === _this;
            });
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "outgoingLinks", {
        // get all incoming links that are attached to this node
        get: function () {
            var _this = this;
            return this.nodeFlow.links.filter(function (link) {
                return link.connectorA.node === _this;
            });
        },
        enumerable: true,
        configurable: true
    });

    NfNode.prototype.setClassName = function (element, baseName) {
        var className = baseName;
        if (this.isPassThrough)
            className += " passthrough";
        if (this.isController)
            className += " controller";
        if (this.isInvalid)
            className += " invalid";
        if (this.isSelected)
            className += " selected";
        if (this.minMaxState == 1 /* minimized */)
            className += " minimized";
        if (this.minMaxState == 2 /* maximized */)
            className += " maximized";
        element.className = className;
    };

    NfNode.prototype.setClassNames = function () {
        this.setClassName(this._header, "nodeHeader");
        this.setClassName(this.mainElement, "nodeBody");
    };

    NfNode.prototype.getStateFlag = function (state) {
        return !!(this._state & state);
    };
    NfNode.prototype.setStateFlag = function (state, value) {
        var oldState = this._state;
        this._state = value ? (this._state | state) : (this._state & (~state));
        if (oldState != this._state)
            this.setClassNames();
    };
    Object.defineProperty(NfNode.prototype, "isSelected", {
        get: function () {
            return this.getStateFlag(NfNodeState.isSelected);
        },
        set: function (value) {
            value = this.isPassThrough ? false : value;
            if (value == this.isSelected)
                return;
            this.setStateFlag(NfNodeState.isSelected, value);
            this.nodeFlow._updateTopology(this, 4 /* SelectionChanged */);
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "nodeAction", {
        // the current node action the node is in
        get: function () {
            return this._nodeAction;
        },
        set: function (value) {
            if (this._nodeAction === value)
                return;
            this._nodeAction = value;
            switch (this._nodeAction) {
                case 0 /* none */:
                    this.setDownShakeDetector();
                    break;
                case 1 /* dragHeader */:
                    this.setupShakeDetector();
                    break;
            }
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "isAutoPanning", {
        get: function () {
            return this.nodeFlow && this.nodeFlow.isAutoPanning;
        },
        set: function (value) {
            var _this = this;
            this.nodeFlow.setAutoPanning(value, function () {
                if (!_this.nodeFlow)
                    return false;
                var nfRect = Rect.contract(_this.nodeFlow.clientRect, Vector2.mul(2, _this.nodeFlow.autoPanMargin));
                var ourViewRect = _this.rect;
                var so = _this.nodeFlow.scrollOffset;
                ourViewRect.x -= so.x;
                ourViewRect.y -= so.y;
                var panVector = new Vector2(0, 0);
                if (ourViewRect.x < nfRect.x)
                    panVector.x = nfRect.x - ourViewRect.x;
                if (ourViewRect.y < nfRect.y)
                    panVector.y = nfRect.y - ourViewRect.y;
                if (ourViewRect.right > nfRect.right)
                    panVector.x = nfRect.right - ourViewRect.right;
                if (ourViewRect.bottom > nfRect.bottom)
                    panVector.y = nfRect.bottom - ourViewRect.bottom;

                if (Vector2.isNearZero(panVector) || Vector2.isNearZero(Vector2.minus(_this._previousAutoPanVector, panVector)))
                    return false;

                _this._previousAutoPanVector = panVector;
                _this.nodeFlow.pan(panVector);
                return true;
            });
        },
        enumerable: true,
        configurable: true
    });

    NfNode.prototype.setProgress = function (value) {
        if (value === true) {
            this._progressIndicator.isBusy = true;
            this.caps |= NfNodeCaps.showBusyIndicator;
        } else if (value === false || isNaN(value))
            this.caps &= ~(NfNodeCaps.showProgressIndicator | NfNodeCaps.showBusyIndicator);
        else {
            value = Math.max(Math.min(value, 1), 0);
            if (isNaN(value) || value <= 0 || value >= 1) {
                this.caps &= ~(NfNodeCaps.showProgressIndicator | NfNodeCaps.showBusyIndicator);
                return;
            }
            this.caps = (this.caps | NfNodeCaps.showProgressIndicator) & (~NfNodeCaps.showBusyIndicator);
            this._progressIndicator.progress = value;
        }
    };

    // is the node hit at the given location?
    NfNode.prototype.isHit = function (position) {
        return this.rect.contains(position);
    };

    Object.defineProperty(NfNode.prototype, "rect", {
        //#region location, size, rect, etc.
        // the node's rectangle, local to the NodeFlow
        get: function () {
            return Rect.fromHTMLElementStyle(this.mainElement);
        },
        set: function (value) {
            value.setToHTMLElementStyle(this.mainElement);
            this.raiseOnSizeChanged();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "connectorRect", {
        // get the rectangle spanning all connectors
        get: function () {
            var l = this.connectors.length;
            var nodeRect = this.rect;
            if (l <= 1)
                return nodeRect;
            var rect = new Rect(Number.MAX_VALUE, Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
            for (var t = 0; t < l; t++) {
                var cm = this.connectors[t].midPosition;
                if (cm.x < rect.x)
                    rect.x = cm.x;
                if (cm.x > rect.width)
                    rect.width = cm.x;
                if (cm.y < rect.y)
                    rect.y = cm.y;
                if (cm.y > rect.height)
                    rect.height = cm.y;
            }
            if (nodeRect.x < rect.x)
                rect.x = nodeRect.x;
            if (nodeRect.right > rect.width)
                rect.width = nodeRect.right;
            rect.width -= rect.x;
            rect.height -= rect.y;
            return rect;
        },
        enumerable: true,
        configurable: true
    });

    // the mid of the connectorRect, relative to the node position
    NfNode.prototype.calculateConnectorRelativeMid = function () {
        this.connectorRelativeMid = Vector2.minus(this.connectorRect.mid, this.position);
    };

    Object.defineProperty(NfNode.prototype, "mid", {
        // the node's position, local to the NodeFlow
        get: function () {
            return this.rect.mid;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "position", {
        get: function () {
            return new Vector2(this.x, this.y);
        },
        set: function (value) {
            pimGui.merge(this.mainElement, undefined, { left: Math.max(value.x, 0) + "px", top: Math.max(value.y, 0) + "px" });
            this.raiseOnSizeChanged();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "size", {
        // the node's size
        get: function () {
            return new Vector2(this.width, this.height);
        },
        set: function (value) {
            pimGui.merge(this.mainElement, undefined, { width: value.x + "px", height: value.y + "px" });
            this.raiseOnSizeChanged();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "x", {
        // the node's x position, local to the NodeFlow
        get: function () {
            return parseInt(getComputedStyle(this.mainElement).left, 10);
        },
        set: function (value) {
            this.mainElement.style.left = Math.max(value, 0) + "px";
            this.raiseOnSizeChanged();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "y", {
        // the node's y position, local to the NodeFlow
        get: function () {
            return parseInt(getComputedStyle(this.mainElement).top, 10);
        },
        set: function (value) {
            this.mainElement.style.top = Math.max(value, 0) + "px";
            this.raiseOnSizeChanged();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "width", {
        // the node's width
        get: function () {
            return parseInt(getComputedStyle(this.mainElement).width, 10);
        },
        set: function (value) {
            this.mainElement.style.width = value + "px";
            this.raiseOnSizeChanged();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "height", {
        // the node's height
        get: function () {
            return parseInt(getComputedStyle(this.mainElement).height, 10);
        },
        set: function (value) {
            this.mainElement.style.height = value + "px";
            this.raiseOnSizeChanged();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "left", {
        // the node's left (and alias for x)
        get: function () {
            return this.x;
        },
        set: function (value) {
            this.x = value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "top", {
        // the node's top (and alias for y)
        get: function () {
            return this.y;
        },
        set: function (value) {
            this.y = value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "right", {
        // the node's right
        get: function () {
            return this.x + this.width;
        },
        set: function (value) {
            this.width = value - this.x;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "bottom", {
        // the node's bottom
        get: function () {
            return this.y + this.height;
        },
        set: function (value) {
            this.height = value - this.y;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "isInvalid", {
        // the indication of an invalid node
        get: function () {
            return this.getStateFlag(NfNodeState.isInvalid);
        },
        set: function (value) {
            if (this.isInvalid != value)
                this.setStateFlag(NfNodeState.isInvalid, value);
        },
        enumerable: true,
        configurable: true
    });

    NfNode.prototype.resetInvalid = function (pinIndex) {
        if (!this.isInvalid)
            return;
        if (pinIndex == undefined)
            for (var l in this.connectors)
                this.connectors[l].resetInvalidReason();
        else {
            var conn = this.connectors[pinIndex];
            if (conn)
                conn.resetInvalidReason();
            for (var l in this.connectors)
                if (this.connectors[l].isInvalid)
                    return;
        }
        this.isInvalid = false;
    };
    NfNode.prototype.makeInvalid = function (pinIndex, reason) {
        this.isInvalid = true;
        var conn = this.connectors[pinIndex];
        if (conn) {
            conn.invalidReason = reason;
            conn.updatePosition();
        }
    };

    NfNode.prototype.resetAllConnectorHints = function () {
        for (var t = 0; t < this.connectors.length; t++)
            this.connectors[t].resetConnectorHint();
    };

    Object.defineProperty(NfNode.prototype, "isVisible", {
        get: function () {
            return this.getStateFlag(NfNodeState.isVisible);
        },
        set: function (value) {
            this.setStateFlag(NfNodeState.isVisible, value);
            this.mainElement.style.visibility = value ? "visible" : "collapse";
            this.mainElement.style.display = value ? "inline" : "none";
            for (var l in this.connectors)
                this.connectors[l].isVisible = value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "isPassThrough", {
        get: function () {
            return this.getStateFlag(NfNodeState.isPassThrough);
        },
        set: function (value) {
            this.setStateFlag(NfNodeState.isPassThrough, value);
            if (this.isPassThrough)
                this.isSelected = false;
            this._passThroughButton.className = this.isPassThrough ? "nodePassThroughButton pressed" : "nodePassThroughButton";
            var headerHeight = parseInt(getComputedStyle(this._headerGroup).height);
            pimGui.merge(this._passThroughOverlay, undefined, {
                top: headerHeight + "px",
                height: (this.rect.height - headerHeight) + "px",
                width: "100%",
                visibility: value ? "visible" : "collapse",
                display: value ? "inline" : "none"
            });
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "isController", {
        get: function () {
            return this.getStateFlag(NfNodeState.isController);
        },
        set: function (value) {
            this.setStateFlag(NfNodeState.isController, value);
            this._controllerButton.className = this.isController ? "nodeControllerButton pressed" : "nodeControllerButton";
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "minimumSize", {
        get: function () {
            return new Vector2(Math.min(this._normalRect.width, this.defaultMinimalNodeSize.x), this.defaultMinimalNodeSize.y);
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfNode.prototype, "minMaxState", {
        get: function () {
            return this._minMaxState;
        },
        set: function (value) {
            this._previousMinMaxState = this._minMaxState;
            if (this._minMaxState == value)
                return;
            if (this._minMaxState == 0 /* normal */) {
                this._normalRect = this.rect;
                this._normalCaps = this.caps;
            }
            switch (value) {
                case 0 /* normal */:
                    this._maximizeButton.className = "nodeMaximizeButton";
                    this._maximizeButton.innerHTML = "-";
                    this.nodeFlow.maximizedNode = null;
                    if (this._normalRect) {
                        this.rect = this._normalRect;
                        this.caps = this._normalCaps;
                    }
                    this.showHideResizer(true);
                    break;
                case 1 /* minimized */:
                    this._maximizeButton.className = "nodeMaximizeButton minimized";
                    this._maximizeButton.innerHTML = "+";

                    this.caps = this.caps & (~NfNodeCaps.hasCloseButton);
                    var minSize = this.minimumSize;
                    this.rect = new Rect(this._normalRect.x, this._normalRect.y, minSize.x, minSize.y);
                    this.nodeFlow.maximizedNode = null;
                    this.showHideResizer(false);
                    break;
                case 2 /* maximized */:
                    this._maximizeButton.className = "nodeMaximizeButton maximized";
                    this._maximizeButton.innerHTML = "-";
                    this.rect = this.nodeFlow.clientRect;
                    this.nodeFlow.maximizedNode = this;
                    this.showHideResizer(false);
                    break;
            }

            this._minMaxState = value;

            var isNormal = !!(this.minMaxState == 0 /* normal */ || this.minMaxState == 1 /* minimized */);
            for (var l in this.connectors) {
                var conn = this.connectors[l];
                conn.isVisible = isNormal;
                conn.updateLinks();
            }
            this.setClassNames();
        },
        enumerable: true,
        configurable: true
    });

    NfNode.prototype.cycleMinMaxState = function (forward) {
        if (typeof forward === "undefined") { forward = true; }
        switch (this._minMaxState) {
            case 0 /* normal */:
                this.minMaxState = forward ? 1 /* minimized */ : 2 /* maximized */;
                break;
            case 1 /* minimized */:
                this.minMaxState = forward ? 0 /* normal */ : 2 /* maximized */;
                break;
            case 2 /* maximized */:
                this.minMaxState = this._previousMinMaxState;
                break;
        }
        //console.log(this._minMaxState);
    };

    //#endregion
    NfNode.prototype.forEachConnector = function (func, reverse) {
        if (typeof reverse === "undefined") { reverse = false; }
        var result = [];
        var l = this.connectorCount;
        if (reverse)
            while (--l >= 0)
                func(this.connectors[l]);
        else
            for (var t = 0; t < l; t++)
                func(this.connectors[l]);
    };

    NfNode.prototype.raiseOnSizeChanged = function () {
        for (var t in this._nfConnectors)
            this._nfConnectors[t].updatePosition();
        this.nodeFlow._updateTopology(this, 3 /* NodeSizeChanged */);
        this.nodeFlow.makeDirty(NfDirtyState.nodesChanged);
    };

    //#region shake detection to unlink a node
    NfNode.prototype.setupShakeDetector = function () {
        var _this = this;
        this.setDownShakeDetector();
        if (this.nodeFlow.useShakeDisconnect && this.hasLinks)
            this._shakeDetector = new ShakeDetector(function () {
                return _this.handleShake();
            });
    };

    NfNode.prototype.setDownShakeDetector = function () {
        if (this._shakeDetector) {
            this._shakeDetector.cleanup();
            this._shakeDetector = null;
        }
    };

    NfNode.prototype.feedShakeDetector = function (position) {
        if (this._shakeDetector)
            this._shakeDetector.feedPosition(position);
    };

    NfNode.prototype.handleShake = function () {
        if (this.isAutoPanning)
            return;
        this.unlinkOrDeleteLinks();
        this.setDownShakeDetector();
    };

    //#endregion
    //#region resize event handlers
    NfNode.prototype.handleResizeMouseDown = function (e) {
        switch (e.button) {
            case 0:
                if (this.minMaxState == 0 /* normal */) {
                    var rect = this.rect;
                    this._resizeStartOffset = Vector2.minus(this.nodeFlow.getClientMousePosition(e), new Vector2(rect.right, rect.bottom));
                    this.nodeAction = 2 /* resizing */;
                    window.addEventListener("mousemove", this._resizeMousemoveEventHandler);
                    window.addEventListener("mouseup", this._resizeMouseupEventHandler);
                }
                break;
        }
    };
    NfNode.prototype.handleResizeMouseMove = function (e) {
        switch (this.nodeAction) {
            case 2 /* resizing */:
                this.resizeToMouse(e);
                break;
        }
    };
    NfNode.prototype.handleResizeMouseUp = function (e) {
        switch (this.nodeAction) {
            case 2 /* resizing */:
                this.nodeAction = 0 /* none */;
                window.removeEventListener("mousemove", this._mousemoveEventHandler);
                window.removeEventListener("mouseup", this._mouseupEventHandler);
                break;
        }
    };

    NfNode.prototype.resizeToMouse = function (e) {
        var size = Vector2.minus(Vector2.minus(this.nodeFlow.getClientMousePosition(e), this._resizeStartOffset), this.position);
        var w = (this.options && this.options["width"]) || this._originalRect.width;
        var h = (this.options && this.options["height"]) || this._originalRect.height;
        if (size.x < w)
            size.x = w;
        if (size.y < h)
            size.y = h;
        this.size = size;
        this.nodeFlow._updateTopology(this, 3 /* NodeSizeChanged */);
    };

    //#endregion
    //#region drag event handlers
    NfNode.prototype.handleMouseDown = function (e) {
        switch (e.button) {
            case 0:
                if (this.minMaxState == 2 /* maximized */)
                    break;
                var localMousePosition = this.nodeFlow.getClientMousePosition(e);
                this._localDragOffset = Vector2.minus(localMousePosition, this.position);
                this.nodeAction = 1 /* dragHeader */;
                if (!this.isAutoPanning)
                    this.feedShakeDetector(localMousePosition);
                window.addEventListener("mousemove", this._mousemoveEventHandler);
                window.addEventListener("mouseup", this._mouseupEventHandler);
                this.isAutoPanning = false;
                this.nodeFlow.unSelectAllNodes();
                this.isSelected = true;
                e.stopPropagation();
                e.preventDefault();
                break;
        }
    };

    NfNode.prototype.handleMouseMove = function (e) {
        var localMousePosition = this.nodeFlow.getClientMousePosition(e);
        switch (this.nodeAction) {
            default:
                break;
            case 1 /* dragHeader */:
                if (!this.isAutoPanning)
                    this.feedShakeDetector(localMousePosition);
                this.position = Vector2.minus(localMousePosition, this._localDragOffset);

                // if 'Ctrl' is pressed while dragging a node, unlink it!
                if (NodeFlow.isControlPressed(e)) {
                    this.unlinkOrDeleteLinks();
                    if (this._draggingHitLink) {
                        this._draggingHitLink.isHighlighted = false;
                        this._draggingHitLink = null;
                    }
                } else if (this.isLinkInsertable)
                    this.highlightPossibleInsertionLink();

                if (!this._draggingHitLink)
                    this.resetAllConnectorHints();

                this.isAutoPanning = true;
                e.stopPropagation();
                e.preventDefault();
                break;
        }
    };

    NfNode.prototype.insertOnLink = function () {
        this.highlightPossibleInsertionLink();
        if (this._draggingHitLink) {
            this._draggingHitLink.isHighlighted = false;
            this.resetAllConnectorHints();
            var connectorsToLink = this.canBeInsertedOnLink(this._draggingHitLink);
            if (connectorsToLink) {
                //console.log("linking node on link " + this._draggingHitLink);
                var connA = this._draggingHitLink.connectorA;
                var connB = this._draggingHitLink.connectorB;
                this.nodeFlow.removeLink(this._draggingHitLink);

                var linkCaps = 0 /* hasBezier */;
                if ((connectorsToLink[0].kind & NfConnectorKind.Input) || (connA.kind & NfConnectorKind.Output))
                    linkCaps |= NfLinkCaps.hasArrow;
                var freshLink = new NfLink(connA, connectorsToLink[0], linkCaps);
                this.nodeFlow.addLink(freshLink);
                freshLink.normalizeConnectors();

                linkCaps = 0 /* hasBezier */;
                if ((connB.kind & NfConnectorKind.Input) || (connectorsToLink[1].kind & NfConnectorKind.Output))
                    linkCaps |= NfLinkCaps.hasArrow;
                freshLink = new NfLink(connectorsToLink[1], connB, linkCaps);
                this.nodeFlow.addLink(freshLink);
                freshLink.normalizeConnectors();
            }
            this._draggingHitLink = null;
        }
    };

    NfNode.prototype.handleMouseUp = function (e) {
        var localMousePosition = this.nodeFlow.getClientMousePosition(e);
        this.resetAllConnectorHints();

        switch (this.nodeAction) {
            default:
                break;
            case 1 /* dragHeader */:
                this.position = Vector2.minus(localMousePosition, this._localDragOffset);
                this.nodeAction = 0 /* none */;
                if (!NodeFlow.isControlPressed(e)) {
                    this.insertOnLink();
                } else if (this._draggingHitLink) {
                    this._draggingHitLink.isHighlighted = false;
                    this._draggingHitLink = null;
                }
                this.isAutoPanning = true;
                window.removeEventListener("mousemove", this._mousemoveEventHandler);
                window.removeEventListener("mouseup", this._mouseupEventHandler);
                this.nodeFlow.minimizePaper();
                e.stopPropagation();
                e.preventDefault();
                break;
        }
    };

    //#endregion
    //#region Link insertion
    NfNode.prototype.highlightPossibleInsertionLink = function () {
        var hitLink = this.nodeFlow.getHitLinkByRect(this.rect);
        if (hitLink) {
            var shallWeHighlight = this.canBeInsertedOnLink(hitLink);
            if (shallWeHighlight) {
                if (hitLink === this._draggingHitLink && hitLink.isHighlighted)
                    return;
                if (this._draggingHitLink)
                    this._draggingHitLink.isHighlighted = false;
                hitLink.isHighlighted = true;
                hitLink.showConnectorHints(true);
                var foundFirstInput = false;
                var foundFirstOutput = false;
                for (var t = 0; t < this.connectors.length; t++) {
                    var conn = this.connectors[t];
                    if (!foundFirstInput && (conn.kind & NfConnectorKind.Input)) {
                        conn.showConnectorHint(true);
                        conn.connectorHintLabel.className = "connectorHintLabel accepted";
                        foundFirstInput = true;
                    }
                    if (!foundFirstOutput && (conn.kind & NfConnectorKind.Output)) {
                        conn.showConnectorHint(true);
                        conn.connectorHintLabel.className = "connectorHintLabel accepted";
                        foundFirstOutput = true;
                        if (foundFirstInput)
                            break;
                    }
                }
            } else {
                if (this._draggingHitLink)
                    this._draggingHitLink.isHighlighted = false;
                hitLink.isHighlighted = false;
                return;
            }
        } else if (this._draggingHitLink)
            this._draggingHitLink.isHighlighted = false;
        this._draggingHitLink = hitLink;
    };

    Object.defineProperty(NfNode.prototype, "isLinkInsertable", {
        // is this node a node that is typically electable to be inserted on an existing link?
        // a) does it have at least one input and one output connection?
        // b) does it have no links attached to it yet?
        get: function () {
            var count = this.connectorCount;
            if (count < 2 || this.hasLinks)
                return false;
            var hasInputConnector = false;
            var hasOutputConnector = false;
            for (var t = 0; t < count; t++) {
                var kind = this.connectors[t].kind;
                if (kind & NfConnectorKind.Input)
                    hasInputConnector = true;
                if (kind & NfConnectorKind.Output)
                    hasOutputConnector = true;
                if (hasInputConnector && hasOutputConnector)
                    return true;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    });

    // can the node actually be inserted on the given link?
    NfNode.prototype.canBeInsertedOnLink = function (link) {
        var resultConnectors = [null, null];
        for (var t in this.connectors) {
            var connector = this.connectors[t];
            if (connector.links.length > 0)
                return null;
            if (!resultConnectors[0] && link.connectorA.isAccepted(connector, true))
                resultConnectors[0] = connector;
            if (!resultConnectors[1] && connector.isAccepted(link.connectorB, true))
                resultConnectors[1] = connector;
            if (resultConnectors[0] && resultConnectors[1])
                return resultConnectors;
        }
        return null;
    };

    //#endregion
    //#region header renaming
    NfNode.prototype.handleMouseDoubleClick = function (e) {
        var _this = this;
        var removeRenameEditBox = function () {
            _this._headerGroup.replaceChild(_this._header, _this._renameEditBox);
            _this._renameEditBox = null;
        };
        this._renameEditBox = pimGui.pimEdit(this.name, function (e) {
            _this.name = _this._renameEditBox.value;
            if (e.key === "Enter")
                removeRenameEditBox();
        });
        this._renameEditBox.className = "NodeHeaderRenameEditBox";
        this._renameEditBox.onblur = function () {
            return removeRenameEditBox();
        };
        pimGui.merge(this._renameEditBox, undefined, {
            width: this._header.clientWidth + "px",
            height: this._header.clientHeight + "px"
        });
        this._headerGroup.replaceChild(this._renameEditBox, this._header);
        this._renameEditBox.selectionStart = 0;
        this._renameEditBox.selectionEnd = this._renameEditBox.value.length;
    };

    NfNode.prototype.handleMaximizeMouseEnter = function (e) {
        if (this.minMaxState == 2 /* maximized */)
            return;
        this._maximizeButton.className = "nodeMaximizeButton hovering";
        this._maximizeButton.innerHTML = "▲<br/>" + (this.minMaxState == 1 /* minimized */ ? "+" : "-");
        this.mainElement.appendChild(this._maximizeButton);
        this.nodeFlow.rootElement.addEventListener("mousemove", this._maximizeMouseMove);
        this._maximizeButton.addEventListener("mousedown", this._maximizeMouseDown);
    };

    NfNode.prototype.handleMaximizeMouseDown = function (e) {
        if (!this._maximizeButton)
            return;
        var mousePos = this.nodeFlow.getClientMousePosition(e);
        var rect = Rect.fromHTMLElementRecursivePositionComputedSize(this._maximizeButton, this.nodeFlow.rootElement);
        var rectMid = rect.y + rect.height * .5;
        if (mousePos.y <= rectMid) {
            this.minMaxState = 2 /* maximized */;
            this.closeMaximizeHoverButton();
        } else {
            this.cycleMinMaxState(!e.ctrlKey);
            this.closeMaximizeHoverButton();
        }
    };

    NfNode.prototype.handleMaximizeMouseMove = function (e) {
        if (this._maximizeButton && !Rect.pointInRect(Rect.fromHTMLElementRecursivePositionComputedSize(this._maximizeButton, this.nodeFlow.rootElement), this.nodeFlow.getClientMousePosition(e)))
            this.closeMaximizeHoverButton();
    };

    NfNode.prototype.closeMaximizeHoverButton = function () {
        this._maximizeButton.innerHTML = this.minMaxState == 1 /* minimized */ ? "+" : "-";
        this._maximizeButton.removeEventListener("mousedown", this._maximizeMouseDown);
        this.nodeFlow.rootElement.removeEventListener("mousemove", this._maximizeMouseMove);
        this._maximizeButton.className = "nodeMaximizeButton";
        if (this._headerGroup)
            this._headerGroup.appendChild(this._maximizeButton);
    };

    NfNode.prototype.showHideResizer = function (showHide) {
        pimGui.merge(this._resizer, {}, { visibility: showHide ? 'visible' : 'collapse', display: showHide ? "inline" : "none" });
    };

    //#endregion
    //// keep a node in view
    //private keepInView(): boolean {
    //    var nfRect = Rect.contract(this.nodeFlow.clientRect, Vector2.mul(2, this.nodeFlow.autoPanMargin));
    //    var ourViewRect = this.rect;
    //    var so = this.nodeFlow.scrollOffset;
    //    ourViewRect.x -= so.x;
    //    ourViewRect.y -= so.y;
    //    var panVector = new Vector2(0, 0);
    //    if (ourViewRect.x < nfRect.x)
    //        panVector.x = nfRect.x - ourViewRect.x;
    //    if (ourViewRect.y < nfRect.y)
    //        panVector.y = nfRect.y - ourViewRect.y;
    //    if (ourViewRect.right > nfRect.right)
    //        panVector.x = nfRect.right - ourViewRect.right;
    //    if (ourViewRect.bottom > nfRect.bottom)
    //        panVector.y = nfRect.bottom - ourViewRect.bottom;
    //    if (panVector.x || panVector.y) {
    //        this.nodeFlow.pan(panVector);
    //        return true;
    //    }
    //    return false;
    //}
    //#endregion
    //#region public Methods
    // close the node, removing it from the nodeflow
    NfNode.prototype.close = function () {
        if (!(this._caps & NfNodeCaps.askCloseConfirm) || confirm("Are you sure you want to delete node <" + this.name + "> and its links?")) {
            this.cleanup();
        }
    };

    // add an NfConnector to the NfNode
    NfNode.prototype.addConnector = function (connector) {
        if (!connector)
            return;
        connector.node = this;
        connector.nodeFlow = this.nodeFlow;

        //this.nodeFlow.paperElement.appendChild(connector.mainElement);
        this.mainElement.appendChild(connector.mainElement);
        this._nfConnectors.push(connector);
        this.calculateConnectorRelativeMid();
        return connector;
    };

    // remove an NfConnector from the NfNode
    NfNode.prototype.removeConnector = function (connector) {
        if (!connector)
            return;
        var index = this._nfConnectors.indexOf(connector);
        if (index < 0)
            return;
        this._nfConnectors.splice(index, 1);
        this.mainElement.removeChild(connector.mainElement);
        connector.node = null;
        connector.nodeFlow = null;
        this.calculateConnectorRelativeMid();
        return connector;
    };

    // get any hit connector
    NfNode.prototype.getHitConnector = function (position) {
        var closestConnector = null;
        var closestSqrDistance = Number.MAX_VALUE;
        for (var t in this._nfConnectors) {
            var connector = this._nfConnectors[t];
            if (connector.isHit(position)) {
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

    //#endregion
    NfNode.prototype.toString = function () {
        return "NfNode(" + this.name + ")";
    };

    NfNode.prototype.registerEventHandlers = function (addOrRemove) {
        var registrar = addOrRemove ? HTMLElement.prototype.addEventListener : HTMLElement.prototype.removeEventListener;
        registrar.call(this._header, "mousedown", this._mousedownEventHandler);
        registrar.call(this._header, "dblclick", this._dblclickEventHandler);
        registrar.call(this._maximizeButton, "mouseenter", this._maximizeMouseEnter);
        registrar.call(this._resizer, "mousedown", this._resizeMousedownEventHandler);
    };

    //#endregion
    // unlink the node and restore the throughput link  if possible, otherwise delete all links
    // return true when something changed, false otherwise
    NfNode.prototype.unlinkOrDeleteLinks = function () {
        var links = this.links;
        if (!links || links.length <= 0)
            return null;

        if (links.length == 2) {
            // special case: if this node has 1 input link, and 1 output link, remove the node, but link-through the existing links to become one link
            // we take the connectors that do not belong to ourself, the middle node, to link up toeachother connA->connB
            var conn0A = links[0].connectorA;
            var conn1B = links[1].connectorB;

            var connA = conn0A;
            var connB = conn1B;
            if (connA.node === connB.node) {
                connA = links[1].connectorA;
                connB = links[0].connectorB;
            }
            var generateLinkThrough = (connA.node != this && connB.node != this);

            // remove the old links
            this.nodeFlow.removeLink(links[1]);
            this.nodeFlow.removeLink(links[0]);

            // ..and make the connA->connB link, if accepted
            if (generateLinkThrough && connA.isAccepted(connB)) {
                var linkCaps = 0 /* hasBezier */;
                if ((connB.kind & NfConnectorKind.Input) || (connA.kind & NfConnectorKind.Output))
                    linkCaps |= NfLinkCaps.hasArrow;
                var link = new NfLink(connA, connB, linkCaps);
                link.normalizeConnectors();
                this.nodeFlow.addLink(link);
            }
        } else {
            var ll = links.length;
            while (--ll >= 0)
                this.nodeFlow.removeLink(links[ll]);
        }
    };

    NfNode.prototype.cleanup = function () {
        var _this = this;
        this.isAutoPanning = false;
        this.nodeAction = 0 /* none */;
        this.unlinkOrDeleteLinks();

        this.registerEventHandlers(false);
        Array.prototype.forEach.call(this._nfConnectors, function (connector) {
            //this.nodeFlow.paperElement.removeChild(connector.mainElement);
            _this.mainElement.removeChild(connector.mainElement);
            connector.cleanup();
        });
        this._nfConnectors = null;
        this.nodeFlow.removeNode(this);
        this._header = null;
        this._closeButton = null;
        this._passThroughButton = null;
        this._controllerButton = null;
        this._maximizeButton = null;
        this._progressIndicator.cleanup();
        this._progressIndicator = null;
        this._headerGroup = null;
        this.mainBody = null;
        this.mainElement = null;
    };

    NfNode.prototype.makeBody = function () {
        var result = pimGui.merge(document.createElement("div"), { className: "pimGroup nodeGroup" });
        if (arguments)
            for (var i in arguments)
                result.appendChild((arguments[i] instanceof Array) ? pimGui.pimHGroup.apply(this, arguments[i]) : arguments[i]);
        return result;
    };
    return NfNode;
})();
//# sourceMappingURL=NfNode.js.map
