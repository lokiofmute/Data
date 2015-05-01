///<reference path="Vector2.ts" />
///<reference path="Rect.ts" />
///<reference path="NfLink.ts" />

// possible actions an NfConnector can be performing
enum NfConnectorAction {
    none,
    dragLink,
}

// the kinds of connectors we know.  These flags give extra information about the connector, and are handy to determine link direction, filtering on which links are accepted or rejected between connectors, etc.
// e.g. input should be connected to output
enum NfConnectorKind {
    Any = 0,
    Input = 1 << 0,
    Output = 1 << 1,
}

class NfConnector {
    //#region Link dragging from connector to connector
    private static _draggingTangentAlpha: number = 0.1;
    private static _draggingTangent: Vector2 = new Vector2(0, 0);

    public static detectionMagnetSize: number = 30;
    public static allowReplaceLinks: boolean = true;
    public static isDraggingTangentDirty: boolean = false;
    public static _draggingEndConnector: NfConnector;

    public static draggingLooseConnector: NfConnector;

    private _isAccepted: boolean;
    public links: NfLink[] = [];

    public static get draggingEndConnector(): NfConnector { return NfConnector._draggingEndConnector; }
    public static set draggingEndConnector(value: NfConnector) {
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
                var reason: string;
                for (var t = 0; t < len; t++) {
                    var link = draggingLinks[t];
                    var startConn = link.theOtherConnector(NfConnector.draggingLooseConnector);
                    if (startConn === NfConnector._draggingEndConnector)
                        isAnyStartAndEndConnectorSame = true;
                    if (startConn.isAccepted(NfConnector._draggingEndConnector, false, (err) => reason = err)) {
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
                }
                else if (len == 1 && link) {
                    var startName = (NfConnector._draggingEndConnector.kind & NfConnectorKind.Output) ? NfConnector._draggingEndConnector.fullName : link.theOtherConnector(NfConnector.draggingLooseConnector).fullName;
                    var endName = (NfConnector._draggingEndConnector.kind & NfConnectorKind.Output) ? link.theOtherConnector(NfConnector.draggingLooseConnector).fullName : NfConnector._draggingEndConnector.fullName;
                    NfConnector.draggingLooseConnector.setToolTip((!isAccepted ? "can't " : "") + "connect " + startName + " -> " + endName + (reason ? " (" + reason + ")" : ""));
                    NfConnector.draggingLooseConnector.connectorHint = NfConnector._draggingEndConnector.name;
                    NfConnector.draggingLooseConnector.connectorHintLabel.className = "connectorHintLabel" + suffix;
                }
            }
        }
    }

    // is there an endconnector, and if so, is it currently accepted?
    public static get isEndConnectorAccepted(): boolean {
        return (NfConnector.draggingEndConnector && NfConnector.draggingEndConnector.mainElement.className === "ConnectorAccepted");
    }
    //#endregion

    //#region private Data Members
    private _size: Vector2;
    private _style: any = {};
    private _maxLinks: number = Number.MAX_VALUE;
    private _invalidReasonLabel: HTMLElement = null;
    private _isVisible: boolean = true;
    private _isInvalid: boolean = false;
    private _isShowingConnectorHint: boolean;

    // runtime members
    private _connectorAction: NfConnectorAction;
    //#endregion

    //#region public Data Members
    public nodeFlow: NodeFlow;
    public node: NfNode;
    public mainElement: HTMLElement;
    public name: string;
    public kind: NfConnectorKind = NfConnectorKind.Any;
    public connectorHintLabel: HTMLElement = null;
    //#endregion

    //#region Properties
    public get isVisible() { return this._isVisible; }
    public set isVisible(value: boolean) {
        var forced = false; 
        if (value && this.node.minMaxState != NfMinMaxState.normal) {
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
    }

    public get isInvalid(): boolean { return this._isInvalid; }
    public set isInvalid(value: boolean) {
        this._isInvalid = value;
        this._invalidReasonLabel.style.visibility = value ? "visible" : "collapse";
        this._invalidReasonLabel.style.display = value ? "inline" : "none";
    }
    public get invalidReason(): string { return this._invalidReasonLabel ? this._invalidReasonLabel.innerHTML : null; }
    public set invalidReason(value: string) { if (this._invalidReasonLabel) this._invalidReasonLabel.innerHTML = value; this.isInvalid = true; }
    public resetInvalidReason() { if (this._invalidReasonLabel) { this._invalidReasonLabel.innerHTML = null; this.isInvalid = false; this.updatePosition(); } }

    public get isShowingConnectorHint(): boolean { return this._isShowingConnectorHint; }
    public set isShowingConnectorHint(value: boolean) {
        this._isShowingConnectorHint = value;
        this.connectorHintLabel.style.visibility = value ? "visible" : "collapse";
        this.connectorHintLabel.style.display = value ? "inline" : "none";
    }
    public get connectorHint(): string { return this.connectorHintLabel ? this.connectorHintLabel.innerHTML : null; }
    public set connectorHint(value: string) { if (this.connectorHintLabel) this.connectorHintLabel.innerHTML = value; this.isShowingConnectorHint = true; }
    public resetConnectorHint() {
        if (this.connectorHintLabel) {
            this.connectorHintLabel.innerHTML = null; this.isShowingConnectorHint = false;
            this.connectorHintLabel.className = "connectorHintLabel";
            this.updatePosition();
        }
    }
    public showConnectorHint(value: boolean) { if (value) this.connectorHint = this.name; else this.resetConnectorHint(); }

    public get fullName() { return (this.node ? this.node.name : "<noNode>") + "." + this.name; }

    public addLink(link: NfLink) { this.links.push(link); }
    public removeLink(link: NfLink) {
        var index = this.links.indexOf(link);
        if (index >= 0)
            this.links.splice(index, 1);
    }
    public get maxLinks() { return this._maxLinks; }
    public set maxLinks(value: number) {
        this._maxLinks = Math.max(Math.min(value, Number.MAX_VALUE), 1);
    }
    public get position(): Vector2 {
        return (this.mainElement && this.nodeFlow && this.nodeFlow.rootElement)
            ? Vector2.fromHTMLElementOffsetRecursive(this.mainElement, this.nodeFlow.rootElement)
            : new Vector2();
    }
    public set position(value: Vector2) {
        this.mainElement.style.left = value.x + "px";
        this.mainElement.style.top = value.y + "px";
    }
    public get midPosition(): Vector2 {
        if (!this._size && this.mainElement)
            this._size = Vector2.fromHTMLElementComputedStyleSize(this.mainElement);
        if (this.node && this.node.minMaxState == NfMinMaxState.minimized) {
            var nodeRect = this.node.rect;
            if (this.kind == NfConnectorKind.Input) {
                return new Vector2(nodeRect.left, nodeRect.top + nodeRect.height * 0.5);
            } else {
                return new Vector2(nodeRect.right, nodeRect.top + nodeRect.height * 0.5);
            }
        }
        return Vector2.plus(this.position, Vector2.mul(.5, this._size));
    }

    public get tangent(): Vector2 {
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
    }

    private get straightTangent(): Vector2 {
        var tangent = new Vector2();
        var delta = Vector2.minus(this.midPosition, this.node.mid);
        if (Math.abs(delta.x) >= Math.abs(delta.y))
            tangent.x = (delta.x < 0) ? -1 : 1;
        else
            tangent.y = (delta.y < 0) ? -1 : 1;
        return tangent;
    }

    // the current node action the connector is in
    public get connectorAction(): NfConnectorAction { return this._connectorAction; }
    public set connectorAction(value: NfConnectorAction) {
        if (this._connectorAction == value)
            return;
        this._connectorAction = value;
        switch (this._connectorAction) {
            case NfConnectorAction.none:
                NfConnector.draggingEndConnector = null;
                this.destroyDraggingLooseConnector();
                break;
            case NfConnectorAction.dragLink:
                break;
        }
    }

    private destroyDraggingLooseConnector() {
        if (NfConnector.draggingLooseConnector) {
            var temp = NfConnector.draggingLooseConnector;
            temp.lightUpAllStartConnectorHints(false);
            NfConnector.draggingLooseConnector = null;
            temp.cleanup();
        }
    }
    //#endregion

    //#region public Methods
    public isHit(position: Vector2): boolean {
        var cs = getComputedStyle(this.mainElement);
        var width = parseInt(cs.width);
        var size = Math.max(width, NfConnector.detectionMagnetSize);
        return (Vector2.sqrDist(position, this.midPosition) <= size * size);
    }

    // should a link with another connector be accepted?
    public isAccepted(other: NfConnector, ignoreOneExistingLink: boolean= false, onError?: Function): boolean {
        if (!other || !other.node)              // if the other connector is invalid reject
            return false;
        other._isAccepted = false;
        if (other === this) {                     // reject connecting to ourself
            if (onError)
                onError("no loopbacks allowed");
            return false;
        }
        if (other.node === this.node) {         // if both connectors belong to the same node, reject
            if (onError)
                onError("both belong to same node");
            return false;
        }
        if (other.kind & NfConnectorKind.Input && this.kind & NfConnectorKind.Input) {            // if both are input connectors, reject
            if (onError)
                onError("both are inputs");
            return false;
        }
        if (other.kind & NfConnectorKind.Output && this.kind & NfConnectorKind.Output) {          // if both are output connectors, reject
            if (onError)
                onError("both are outputs");
            return false;
        }

        if (!this.nodeFlow.allowCycles && this.detectCycle(other)) {            // let's not accept circular connections
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
    }

    private detectCycle(other: NfConnector): boolean {
        if (this.kind & NfConnectorKind.Input)                // hunt for ourself recursively upstream
            return other.node.isConnected(this, true);
        else if (this.kind & NfConnectorKind.Output)        // hunt for ourself recursively downstream
            return other.node.isConnected(this, false);
        else
            return false;
    }

    private markLinksForDeletion(value: boolean) {
        var links = this.links;
        if (!links)
            return;
        var len = links.length;
        for (var t = 0; t < len; t++)
            links[t].isMarkedForDeletion = value;
    }

    private removeLinksMarkedForDeletion() {
        var linksToRemove = this.links;
        if (linksToRemove) {
            var t = linksToRemove.length;
            while (--t >= 0) {
                var link = linksToRemove[t];
                if (link.isMarkedForDeletion)
                    this.nodeFlow.removeLink(link);
            }
        }
    }

    public updatePosition() {
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
    }
    //#endregion

    public startDraggingLinks(localMousePosition: Vector2, disconnectExistingLinks: boolean = false) {
        var otherConnectors: NfConnector[] = [];
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

        this.connectorAction = NfConnectorAction.dragLink;
        this.destroyDraggingLooseConnector();
        NfConnector.draggingLooseConnector = new NfConnector(null, { left: "0", top: "0" }, "connect me ;-)", NfConnectorKind.Any, 1, this.nodeFlow);
        NfConnector.draggingLooseConnector.position = localMousePosition;
        NfConnector.draggingLooseConnector.mainElement.className = "connector loose";

        var linkCaps = NfLinkCaps.hasBezier;
        if ((this.kind & NfConnectorKind.Input) || (this.kind & NfConnectorKind.Output))
            linkCaps |= NfLinkCaps.hasArrow;

        var len = otherConnectors.length;
        if (len <= 0)
            this.nodeFlow.addLink(new NfLink(this, NfConnector.draggingLooseConnector, linkCaps));
        else
            for (var c in otherConnectors)
                this.nodeFlow.addLink(new NfLink(otherConnectors[c], NfConnector.draggingLooseConnector, linkCaps), false);

        NfConnector.draggingEndConnector = null;
    }

    private dragToPosition(localMousePosition: Vector2, isFromMouseMove: boolean= false) {
        if (!NfConnector.draggingLooseConnector)
            return;

        // position the loose connector to the mouse
        NfConnector.draggingLooseConnector.position = localMousePosition;
        NfConnector.draggingEndConnector = this.nodeFlow.getClosestHitConnector(localMousePosition);

        // light up all start connector hints
        NfConnector.draggingLooseConnector.lightUpAllStartConnectorHints(true);

        // update the dragging link(s)' position
        NfConnector.draggingLooseConnector.updateLinks();
    }

    private lightUpAllStartConnectorHints(value: boolean) {
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
    }

    public updateLinks() {
        var links = this.links;
        var len = links.length;
        for (var t = 0; t < len; t++)
            links[t].update();
    }

    public stopDraggingLink(localMousePosition?: Vector2) {
        if (NfConnector.draggingLooseConnector && localMousePosition) {
            NfConnector.draggingLooseConnector.position = localMousePosition;
            NfConnector.draggingEndConnector = this.nodeFlow.getClosestHitConnector(localMousePosition);
            var links = NfConnector.draggingLooseConnector.links;
            var t = links.length;
            var madeLinks: NfLink[] = [];
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
                }
                else
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
                    this.nodeFlow._updateTopology(link, NfUpdateReason.Add);
                }
            }
        }

        this.connectorAction = NfConnectorAction.none;
    }

    //#region event handlers
    //public handleMouseLeave(e: MouseEvent) {
    //    console.log("mouse leave at " + e.clientX + ", " + e.clientY);

    //    this.mainElement.removeEventListener("mouseleave", this._mouseleaveEventHandler);
    //}

    public handleMouseDown(e: MouseEvent) {
        switch (e.button) {
            case 0:
                switch (this.connectorAction) {
                    case NfConnectorAction.none:
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
    }

    public handleMouseMove(e: MouseEvent) {
        switch (e.button) {
            case 0:
                switch (this.connectorAction) {
                    default:
                        break;
                    case NfConnectorAction.dragLink:
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
    }

    public handleMouseUp(e: MouseEvent) {
        switch (e.button) {
            case 0:
                switch (this.connectorAction) {
                    default:
                        break;
                    case NfConnectorAction.dragLink:
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
    }

    //#endregion

    //#region add/remove event listeners
    private _mousedownEventHandler = e => this.handleMouseDown(e);
    private _mousemoveEventHandler = e => this.handleMouseMove(e);
    private _mouseupEventHandler = e => this.handleMouseUp(e);
    //private _mouseleaveEventHandler = e => this.handleMouseLeave(e);

    private registerEventHandlers(addOrRemove: boolean) {
        var registrar = addOrRemove ? HTMLElement.prototype.addEventListener : HTMLElement.prototype.removeEventListener;
        registrar.call(this.mainElement, "mousedown", this._mousedownEventHandler);
    }
    //#endregion

    public cleanup() {
        this.lightUpAllStartConnectorHints(false);
        this.connectorAction = NfConnectorAction.none;
        if (this.node) {
            this.registerEventHandlers(false)
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
    }

    private setToolTip(msg: string) {
        if (this.mainElement)
            this.mainElement.title = msg;
    }

    constructor(node: NfNode, style: any, name?: string, kind: NfConnectorKind = NfConnectorKind.Any, maxLinks: number= Number.MAX_VALUE, nodeFlow: NodeFlow = undefined, className?: any) {
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
            node.addConnector(this);                                        // node-bound connector
            this.registerEventHandlers(true);
        } else {
            this.nodeFlow.rootElement.appendChild(this.mainElement);        // loose connector
        }

        this.connectorAction = NfConnectorAction.none;
        this.resetInvalidReason();
        this.resetConnectorHint();
    }
}