///<reference path="Vector2.ts" />
///<reference path="Rect.ts" />
///<reference path="NfLink.ts" />
// possible actions an NfConnector can be performing
var NfConnectorAction;
(function (NfConnectorAction) {
    NfConnectorAction[NfConnectorAction["none"] = 0] = "none";
    NfConnectorAction[NfConnectorAction["dragLink"] = 1] = "dragLink";
})(NfConnectorAction || (NfConnectorAction = {}));

// the kinds of connectors we know.  These flags give extra information about the connector, and are handy to determine link direction, filtering on which links are accepted or rejected between connectors, etc.
// e.g. input should be connected to output
var NfConnectorKind;
(function (NfConnectorKind) {
    NfConnectorKind[NfConnectorKind["Any"] = 0] = "Any";
    NfConnectorKind[NfConnectorKind["Input"] = 1 << 0] = "Input";
    NfConnectorKind[NfConnectorKind["Output"] = 1 << 1] = "Output";
})(NfConnectorKind || (NfConnectorKind = {}));

var NfConnector = (function () {
    function NfConnector(node, style, name, kind, maxLinks, nodeFlow, className) {
        if (typeof kind === "undefined") { kind = 0 /* Any */; }
        if (typeof maxLinks === "undefined") { maxLinks = Number.MAX_VALUE; }
        if (typeof nodeFlow === "undefined") { nodeFlow = undefined; }
        var _this = this;
        this.links = [];
        this._style = {};
        this._maxLinks = Number.MAX_VALUE;
        this._invalidReasonLabel = null;
        this._isVisible = true;
        this._isInvalid = false;
        this.kind = 0 /* Any */;
        this.connectorHintLabel = null;
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
        this.nodeFlow = nodeFlow;

        this.kind = kind;
        this.maxLinks = maxLinks;
        this.mainElement = pimGui.merge(pimGui.pimLabel(""), { className: className || "connector", title: name }, style);

        this._invalidReasonLabel = pimGui.merge(pimGui.pimLabel(""), { className: "connectorInvalidLabel" });
        this.mainElement.appendChild(this._invalidReasonLabel);

        this.connectorHintLabel = pimGui.merge(pimGui.pimLabel(""), { className: "connectorHintLabel" });
        this.mainElement.appendChild(this.connectorHintLabel);

        this.name = name || "Connector_" + node.connectorCount;

        if (node) {
            node.addConnector(this); // node-bound connector
            this.registerEventHandlers(true);
        } else {
            this.nodeFlow.rootElement.appendChild(this.mainElement); // loose connector
        }

        this.connectorAction = 0 /* none */;
        this.resetInvalidReason();
        this.resetConnectorHint();
    }
    Object.defineProperty(NfConnector, "draggingEndConnector", {
        get: function () {
            return NfConnector._draggingEndConnector;
        },
        set: function (value) {
            if (value === NfConnector._draggingEndConnector)
                return;

            if (NfConnector._draggingEndConnector && NfConnector._draggingEndConnector.mainElement) {
                NfConnector._draggingEndConnector.markLinksForDeletion(false);
                NfConnector._draggingEndConnector.mainElement.className = "connector";
                if (NfConnector.draggingLooseConnector.mainElement) {
                    NfConnector.draggingLooseConnector.mainElement.className = "connector loose";
                    NfConnector.draggingLooseConnector.setToolTip(NfConnector.draggingLooseConnector.name);
                    NfConnector.draggingLooseConnector.resetConnectorHint();
                    NfConnector.draggingLooseConnector.connectorHintLabel.className = "connectorHintLabel";
                } else {
                    NfConnector.draggingLooseConnector.cleanup();
                    NfConnector.draggingLooseConnector = null;
                }
            }

            NfConnector._draggingEndConnector = value;

            if (NfConnector._draggingEndConnector && NfConnector._draggingEndConnector.mainElement && NfConnector.draggingLooseConnector) {
                var draggingLinks = NfConnector.draggingLooseConnector.links;
                var len = draggingLinks.length;
                if (len > 0) {
                    var isAnyStartAndEndConnectorSame = false;
                    var isAccepted = false;
                    var reason;
                    for (var t = 0; t < len; t++) {
                        var link = draggingLinks[t];
                        var startConn = link.theOtherConnector(NfConnector.draggingLooseConnector);
                        if (startConn === NfConnector._draggingEndConnector)
                            isAnyStartAndEndConnectorSame = true;
                        if (startConn.isAccepted(NfConnector._draggingEndConnector, false, function (err) {
                            return reason = err;
                        })) {
                            isAccepted = true;
                            break;
                        }
                    }

                    var suffix = (isAccepted ? " accepted" : " refused");
                    NfConnector.draggingLooseConnector.mainElement.className = "connector" + suffix + " loose";
                    NfConnector._draggingEndConnector.mainElement.className = "connector" + suffix;

                    if (isAnyStartAndEndConnectorSame) {
                        NfConnector.draggingLooseConnector.setToolTip("can't connect to self");
                        NfConnector.draggingLooseConnector.resetConnectorHint();
                    } else if (len == 1 && link) {
                        var startName = (NfConnector._draggingEndConnector.kind & NfConnectorKind.Output) ? NfConnector._draggingEndConnector.fullName : link.theOtherConnector(NfConnector.draggingLooseConnector).fullName;
                        var endName = (NfConnector._draggingEndConnector.kind & NfConnectorKind.Output) ? link.theOtherConnector(NfConnector.draggingLooseConnector).fullName : NfConnector._draggingEndConnector.fullName;
                        NfConnector.draggingLooseConnector.setToolTip((!isAccepted ? "can't " : "") + "connect " + startName + " -> " + endName + (reason ? " (" + reason + ")" : ""));
                        NfConnector.draggingLooseConnector.connectorHint = NfConnector._draggingEndConnector.name;
                        NfConnector.draggingLooseConnector.connectorHintLabel.className = "connectorHintLabel" + suffix;
                    }
                }
            }
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfConnector, "isEndConnectorAccepted", {
        // is there an endconnector, and if so, is it currently accepted?
        get: function () {
            return (NfConnector.draggingEndConnector && NfConnector.draggingEndConnector.mainElement.className === "ConnectorAccepted");
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfConnector.prototype, "isVisible", {
        //#endregion
        //#region Properties
        get: function () {
            return this._isVisible;
        },
        set: function (value) {
            var forced = false;
            if (value && this.node.minMaxState != 0 /* normal */) {
                value = false;
                forced = true;
            }
            this._isVisible = value;
            this.mainElement.style.visibility = value ? "visible" : "collapse";
            this.mainElement.style.display = value ? "inline" : "none";
            if (value || forced) {
                this.updatePosition();
                this.updateLinks();
            }
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfConnector.prototype, "isInvalid", {
        get: function () {
            return this._isInvalid;
        },
        set: function (value) {
            this._isInvalid = value;
            this._invalidReasonLabel.style.visibility = value ? "visible" : "collapse";
            this._invalidReasonLabel.style.display = value ? "inline" : "none";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NfConnector.prototype, "invalidReason", {
        get: function () {
            return this._invalidReasonLabel ? this._invalidReasonLabel.innerHTML : null;
        },
        set: function (value) {
            if (this._invalidReasonLabel)
                this._invalidReasonLabel.innerHTML = value;
            this.isInvalid = true;
        },
        enumerable: true,
        configurable: true
    });
    NfConnector.prototype.resetInvalidReason = function () {
        if (this._invalidReasonLabel) {
            this._invalidReasonLabel.innerHTML = null;
            this.isInvalid = false;
            this.updatePosition();
        }
    };

    Object.defineProperty(NfConnector.prototype, "isShowingConnectorHint", {
        get: function () {
            return this._isShowingConnectorHint;
        },
        set: function (value) {
            this._isShowingConnectorHint = value;
            this.connectorHintLabel.style.visibility = value ? "visible" : "collapse";
            this.connectorHintLabel.style.display = value ? "inline" : "none";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NfConnector.prototype, "connectorHint", {
        get: function () {
            return this.connectorHintLabel ? this.connectorHintLabel.innerHTML : null;
        },
        set: function (value) {
            if (this.connectorHintLabel)
                this.connectorHintLabel.innerHTML = value;
            this.isShowingConnectorHint = true;
        },
        enumerable: true,
        configurable: true
    });
    NfConnector.prototype.resetConnectorHint = function () {
        if (this.connectorHintLabel) {
            this.connectorHintLabel.innerHTML = null;
            this.isShowingConnectorHint = false;
            this.connectorHintLabel.className = "connectorHintLabel";
            this.updatePosition();
        }
    };
    NfConnector.prototype.showConnectorHint = function (value) {
        if (value)
            this.connectorHint = this.name;
        else
            this.resetConnectorHint();
    };

    Object.defineProperty(NfConnector.prototype, "fullName", {
        get: function () {
            return (this.node ? this.node.name : "<noNode>") + "." + this.name;
        },
        enumerable: true,
        configurable: true
    });

    NfConnector.prototype.addLink = function (link) {
        this.links.push(link);
    };
    NfConnector.prototype.removeLink = function (link) {
        var index = this.links.indexOf(link);
        if (index >= 0)
            this.links.splice(index, 1);
    };
    Object.defineProperty(NfConnector.prototype, "maxLinks", {
        get: function () {
            return this._maxLinks;
        },
        set: function (value) {
            this._maxLinks = Math.max(Math.min(value, Number.MAX_VALUE), 1);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NfConnector.prototype, "position", {
        get: function () {
            return (this.mainElement && this.nodeFlow && this.nodeFlow.rootElement) ? Vector2.fromHTMLElementOffsetRecursive(this.mainElement, this.nodeFlow.rootElement) : new Vector2();
        },
        set: function (value) {
            this.mainElement.style.left = value.x + "px";
            this.mainElement.style.top = value.y + "px";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NfConnector.prototype, "midPosition", {
        get: function () {
            if (!this._size && this.mainElement)
                this._size = Vector2.fromHTMLElementComputedStyleSize(this.mainElement);
            if (this.node && this.node.minMaxState == 1 /* minimized */) {
                var nodeRect = this.node.rect;
                if (this.kind == NfConnectorKind.Input) {
                    return new Vector2(nodeRect.left, nodeRect.top + nodeRect.height * 0.5);
                } else {
                    return new Vector2(nodeRect.right, nodeRect.top + nodeRect.height * 0.5);
                }
            }
            return Vector2.plus(this.position, Vector2.mul(.5, this._size));
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfConnector.prototype, "tangent", {
        get: function () {
            var result = new Vector2();
            if (!this.nodeFlow.useSplines)
                return result;

            if (this === NfConnector.draggingLooseConnector) {
                // animate the goal tangent for dragged link
                var goalTangent = new Vector2();
                var previousDraggingTangent = NfConnector._draggingTangent;
                if (NfConnector._draggingEndConnector && NfConnector.draggingEndConnector._isAccepted)
                    goalTangent = NfConnector._draggingEndConnector.tangent;
                NfConnector._draggingTangent = Vector2.lerp(NfConnector._draggingTangent, goalTangent, NfConnector._draggingTangentAlpha);
                NfConnector.isDraggingTangentDirty = !Vector2.equals(previousDraggingTangent, NfConnector._draggingTangent);
                return NfConnector._draggingTangent;
            }

            if (this.node) {
                var fanout = Vector2.normalize(Vector2.minus(Vector2.minus(this.midPosition, this.node.position), this.node.connectorRelativeMid));
                var straight = this.straightTangent;
                var alpha = this.nodeFlow.connectorFanout;
                result = Vector2.lerp(fanout, straight, alpha);

                //Vector2.plus(Vector2.mul(alpha, fanout), Vector2.mul((1 - alpha), straight));
                result = Vector2.mul(this.nodeFlow.splineBulge, Vector2.normalize(result));
            }

            if (this === NfConnector.draggingEndConnector && NfConnector.draggingLooseConnector) {
                var dist = Vector2.dist(NfConnector.draggingLooseConnector.midPosition, NfConnector.draggingEndConnector.midPosition);
                var distNormalized = (1 - Math.max(Math.min(dist / NfConnector.detectionMagnetSize, 1), 0)) * 0.5 + 0.5;
                result = Vector2.mul(distNormalized, result);
            }

            return result;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfConnector.prototype, "straightTangent", {
        get: function () {
            var tangent = new Vector2();
            var delta = Vector2.minus(this.midPosition, this.node.mid);
            if (Math.abs(delta.x) >= Math.abs(delta.y))
                tangent.x = (delta.x < 0) ? -1 : 1;
            else
                tangent.y = (delta.y < 0) ? -1 : 1;
            return tangent;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfConnector.prototype, "connectorAction", {
        // the current node action the connector is in
        get: function () {
            return this._connectorAction;
        },
        set: function (value) {
            if (this._connectorAction == value)
                return;
            this._connectorAction = value;
            switch (this._connectorAction) {
                case 0 /* none */:
                    NfConnector.draggingEndConnector = null;
                    this.destroyDraggingLooseConnector();
                    break;
                case 1 /* dragLink */:
                    break;
            }
        },
        enumerable: true,
        configurable: true
    });

    NfConnector.prototype.destroyDraggingLooseConnector = function () {
        if (NfConnector.draggingLooseConnector) {
            var temp = NfConnector.draggingLooseConnector;
            temp.lightUpAllStartConnectorHints(false);
            NfConnector.draggingLooseConnector = null;
            temp.cleanup();
        }
    };

    //#endregion
    //#region public Methods
    NfConnector.prototype.isHit = function (position) {
        var cs = getComputedStyle(this.mainElement);
        var width = parseInt(cs.width);
        var size = Math.max(width, NfConnector.detectionMagnetSize);
        return (Vector2.sqrDist(position, this.midPosition) <= size * size);
    };

    // should a link with another connector be accepted?
    NfConnector.prototype.isAccepted = function (other, ignoreOneExistingLink, onError) {
        if (typeof ignoreOneExistingLink === "undefined") { ignoreOneExistingLink = false; }
        if (!other || !other.node)
            return false;
        other._isAccepted = false;
        if (other === this) {
            if (onError)
                onError("no loopbacks allowed");
            return false;
        }
        if (other.node === this.node) {
            if (onError)
                onError("both belong to same node");
            return false;
        }
        if (other.kind & NfConnectorKind.Input && this.kind & NfConnectorKind.Input) {
            if (onError)
                onError("both are inputs");
            return false;
        }
        if (other.kind & NfConnectorKind.Output && this.kind & NfConnectorKind.Output) {
            if (onError)
                onError("both are outputs");
            return false;
        }

        if (!this.nodeFlow.allowCycles && this.detectCycle(other)) {
            if (onError)
                onError("cycle not allowed");
            return false;
        }

        // if the other cannot accept any more links, reject
        if (other.links.length >= other.maxLinks + (ignoreOneExistingLink ? 1 : 0)) {
            if (NfConnector.allowReplaceLinks) {
                other.markLinksForDeletion(true);
                other._isAccepted = true;
                return true;
            }
            if (onError)
                onError("max # links reached");
            return false;
        }

        // accept!
        other._isAccepted = true;
        return true;
    };

    NfConnector.prototype.detectCycle = function (other) {
        if (this.kind & NfConnectorKind.Input)
            return other.node.isConnected(this, true);
        else if (this.kind & NfConnectorKind.Output)
            return other.node.isConnected(this, false);
        else
            return false;
    };

    NfConnector.prototype.markLinksForDeletion = function (value) {
        var links = this.links;
        if (!links)
            return;
        var len = links.length;
        for (var t = 0; t < len; t++)
            links[t].isMarkedForDeletion = value;
    };

    NfConnector.prototype.removeLinksMarkedForDeletion = function () {
        var linksToRemove = this.links;
        if (linksToRemove) {
            var t = linksToRemove.length;
            while (--t >= 0) {
                var link = linksToRemove[t];
                if (link.isMarkedForDeletion)
                    this.nodeFlow.removeLink(link);
            }
        }
    };

    NfConnector.prototype.updatePosition = function () {
        if (this.node) {
            if (!this.invalidReason || this.invalidReason == "null")
                this._invalidReasonLabel.style.display = "none";
            else {
                var cs = getComputedStyle(this._invalidReasonLabel);
                var csw = parseInt(cs.width, 10);

                var mcs = getComputedStyle(this.mainElement);
                var width = parseInt(cs.width);
                var top = parseInt(mcs.top);

                this._invalidReasonLabel.style.left = width + "px";
                this._invalidReasonLabel.style.top = top + "px";
                this._invalidReasonLabel.style.display = "inline";
            }
            this.connectorHintLabel.style.display = (!this.connectorHint || this.connectorHint == "null") ? "none" : "inline";
        }

        for (var l in this.links)
            this.links[l].update();
    };

    //#endregion
    NfConnector.prototype.startDraggingLinks = function (localMousePosition, disconnectExistingLinks) {
        if (typeof disconnectExistingLinks === "undefined") { disconnectExistingLinks = false; }
        var otherConnectors = [];
        if (disconnectExistingLinks) {
            var t = this.links.length;
            while (--t >= 0) {
                var link = this.links[t];
                var otherConnector = link.theOtherConnector(this);
                otherConnectors.push(otherConnector);
                this.nodeFlow.removeLink(link);
            }
        }

        window.addEventListener("mousemove", this._mousemoveEventHandler);
        window.addEventListener("mouseup", this._mouseupEventHandler);

        this.connectorAction = 1 /* dragLink */;
        this.destroyDraggingLooseConnector();
        NfConnector.draggingLooseConnector = new NfConnector(null, { left: "0", top: "0" }, "connect me ;-)", 0 /* Any */, 1, this.nodeFlow);
        NfConnector.draggingLooseConnector.position = localMousePosition;
        NfConnector.draggingLooseConnector.mainElement.className = "connector loose";

        var linkCaps = 0 /* hasBezier */;
        if ((this.kind & NfConnectorKind.Input) || (this.kind & NfConnectorKind.Output))
            linkCaps |= NfLinkCaps.hasArrow;

        var len = otherConnectors.length;
        if (len <= 0)
            this.nodeFlow.addLink(new NfLink(this, NfConnector.draggingLooseConnector, linkCaps));
        else
            for (var c in otherConnectors)
                this.nodeFlow.addLink(new NfLink(otherConnectors[c], NfConnector.draggingLooseConnector, linkCaps), false);

        NfConnector.draggingEndConnector = null;
    };

    NfConnector.prototype.dragToPosition = function (localMousePosition, isFromMouseMove) {
        if (typeof isFromMouseMove === "undefined") { isFromMouseMove = false; }
        if (!NfConnector.draggingLooseConnector)
            return;

        // position the loose connector to the mouse
        NfConnector.draggingLooseConnector.position = localMousePosition;
        NfConnector.draggingEndConnector = this.nodeFlow.getClosestHitConnector(localMousePosition);

        // light up all start connector hints
        NfConnector.draggingLooseConnector.lightUpAllStartConnectorHints(true);

        // update the dragging link(s)' position
        NfConnector.draggingLooseConnector.updateLinks();
    };

    NfConnector.prototype.lightUpAllStartConnectorHints = function (value) {
        var draggingLinks = this.links;
        var len = draggingLinks.length;
        for (var t = 0; t < len; t++) {
            var link = draggingLinks[t];
            var startConn = link.theOtherConnector(this);
            if (startConn) {
                if (value && !startConn.isShowingConnectorHint)
                    startConn.connectorHint = startConn.name;
                else if (!value)
                    startConn.resetConnectorHint();
            }
        }
    };

    NfConnector.prototype.updateLinks = function () {
        var links = this.links;
        var len = links.length;
        for (var t = 0; t < len; t++)
            links[t].update();
    };

    NfConnector.prototype.stopDraggingLink = function (localMousePosition) {
        if (NfConnector.draggingLooseConnector && localMousePosition) {
            NfConnector.draggingLooseConnector.position = localMousePosition;
            NfConnector.draggingEndConnector = this.nodeFlow.getClosestHitConnector(localMousePosition);
            var links = NfConnector.draggingLooseConnector.links;
            var t = links.length;
            var madeLinks = [];
            while (--t >= 0) {
                var link = links[t];
                var startConnector = link.theOtherConnector(NfConnector.draggingLooseConnector);
                startConnector.resetConnectorHint();
                if (startConnector.isAccepted(NfConnector.draggingEndConnector)) {
                    if (NfConnector.allowReplaceLinks && NfConnector.draggingEndConnector)
                        NfConnector.draggingEndConnector.removeLinksMarkedForDeletion();
                    link.connectorB = NfConnector.draggingEndConnector;
                    if ((NfConnector.draggingEndConnector.kind & NfConnectorKind.Input) || (NfConnector.draggingEndConnector.kind & NfConnectorKind.Output))
                        link.caps |= NfLinkCaps.hasArrow;
                    madeLinks.push(link);
                } else
                    this.nodeFlow.removeLink(link);
            }

            // now normalize the links
            t = madeLinks.length;
            while (--t >= 0) {
                var link = madeLinks[t];
                if (link) {
                    link.normalizeConnectors();
                    link.canDelete = true;
                    link.update();
                    this.nodeFlow._updateTopology(link, 1 /* Add */);
                }
            }
        }

        this.connectorAction = 0 /* none */;
    };

    //#region event handlers
    //public handleMouseLeave(e: MouseEvent) {
    //    console.log("mouse leave at " + e.clientX + ", " + e.clientY);
    //    this.mainElement.removeEventListener("mouseleave", this._mouseleaveEventHandler);
    //}
    NfConnector.prototype.handleMouseDown = function (e) {
        switch (e.button) {
            case 0:
                switch (this.connectorAction) {
                    case 0 /* none */:
                        e.stopPropagation();
                        e.preventDefault();
                        var isCtrlPressed = NodeFlow.isControlPressed(e);
                        var isInputConnector = !!(this.kind & NfConnectorKind.Input);
                        var isOutputConnector = !!(this.kind & NfConnectorKind.Output);
                        var localMousePosition = this.nodeFlow.getClientMousePosition(e);

                        //this.mainElement.addEventListener("mouseleave", this._mouseleaveEventHandler);
                        if (isInputConnector && (this.links.length > 0))
                            this.links[0].startDragging(this, localMousePosition);
                        else
                            this.startDraggingLinks(localMousePosition, isCtrlPressed && isOutputConnector);
                        break;
                }
                break;
        }
    };

    NfConnector.prototype.handleMouseMove = function (e) {
        switch (e.button) {
            case 0:
                switch (this.connectorAction) {
                    default:
                        break;
                    case 1 /* dragLink */:
                        e.stopPropagation();
                        e.preventDefault();
                        this.dragToPosition(this.nodeFlow.getClientMousePosition(e), true);
                        break;
                }
                break;
            default:
                this.destroyDraggingLooseConnector();
                break;
        }
    };

    NfConnector.prototype.handleMouseUp = function (e) {
        switch (e.button) {
            case 0:
                switch (this.connectorAction) {
                    default:
                        break;
                    case 1 /* dragLink */:
                        window.removeEventListener("mousemove", this._mousedownEventHandler);
                        window.removeEventListener("mouseup", this._mouseupEventHandler);
                        this.stopDraggingLink(this.nodeFlow.getClientMousePosition(e));
                        e.stopPropagation();
                        e.preventDefault();
                        break;
                }
                break;
        }
        this.destroyDraggingLooseConnector();
    };

    //private _mouseleaveEventHandler = e => this.handleMouseLeave(e);
    NfConnector.prototype.registerEventHandlers = function (addOrRemove) {
        var registrar = addOrRemove ? HTMLElement.prototype.addEventListener : HTMLElement.prototype.removeEventListener;
        registrar.call(this.mainElement, "mousedown", this._mousedownEventHandler);
    };

    //#endregion
    NfConnector.prototype.cleanup = function () {
        this.lightUpAllStartConnectorHints(false);
        this.connectorAction = 0 /* none */;
        if (this.node) {
            this.registerEventHandlers(false);
            this.node = null;
        }
        if (this.mainElement) {
            this.mainElement.removeChild(this._invalidReasonLabel);
            this.mainElement.removeChild(this.connectorHintLabel);
            this._invalidReasonLabel = null;
            this.connectorHintLabel = null;
            if (this.mainElement.parentElement)
                this.mainElement.parentElement.removeChild(this.mainElement);
            this.mainElement = null;
        }
        this.nodeFlow = null;
    };

    NfConnector.prototype.setToolTip = function (msg) {
        if (this.mainElement)
            this.mainElement.title = msg;
    };
    NfConnector._draggingTangentAlpha = 0.1;
    NfConnector._draggingTangent = new Vector2(0, 0);

    NfConnector.detectionMagnetSize = 30;
    NfConnector.allowReplaceLinks = true;
    NfConnector.isDraggingTangentDirty = false;
    return NfConnector;
})();
//# sourceMappingURL=NfConnector.js.map
