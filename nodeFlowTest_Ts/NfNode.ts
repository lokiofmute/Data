///<reference path="Vector2.ts" />
///<reference path="Rect.ts" />
///<reference path="NfConnector.ts" />
///<reference path="NfLink.ts" />
///<reference path="ShakeDetector.ts" />
///<reference path="ProgressIndicator.ts" />

// possible actions an NfNode can be performing
enum NfNodeAction {
    none = 0,
    dragHeader,
    resizing,
}

enum NfNodeState {
    none = 0,
    isSelected = 1 << 0,
    isPassThrough = 1 << 1,
    isController = 1 << 2,
    isInvalid = 1 << 3,
    isVisible = 1 << 4,
}

enum NfMinMaxState {
    normal = 0,
    minimized,
    maximized,
}

// possible capabilities of an NfNode
enum NfNodeCaps {
    none = 0,
    hasCloseButton = 1 << 0,
    askCloseConfirm = 1 << 1,
    hasPassThroughButton = 1 << 2,
    hasMaximizeButton = 1 << 3,
    showProgressIndicator = 1 << 4,
    showBusyIndicator = 1 << 5,
    hasControllerButton = 1 << 6,

    // the default caps combination
    defaultCaps = none | hasCloseButton | hasPassThroughButton | hasMaximizeButton
}

// an NfNode is a NodeFlow Node, it represents a single block on the NodeFlow.
class NfNode {
    //#region private Data Members
    private _caps: NfNodeCaps;
    private _headerGroup: HTMLElement;
    private _closeButton: HTMLElement;
    private _passThroughButton: HTMLElement;
    private _controllerButton: HTMLElement;
    private _maximizeButton: HTMLElement;
    private _progressIndicator: ProgressIndicator;
    private _resizer: HTMLElement;
    private _header: HTMLElement;
    private _renameEditBox: HTMLInputElement;
    private _nfConnectors: NfConnector[] = [];
    private _autoPanTimedCaller: TimedCaller;
    private _previousAutoPanVector: Vector2 = new Vector2(-9999, -9999);
    private _unSelectedBackgroundColor: string;
    private _passThroughOverlay: HTMLElement;
    private _normalRect: Rect = new Rect(0, 0, 0, 0);
    private _originalRect: Rect = new Rect(0, 0, 0, 0);
    private _normalCaps: NfNodeCaps = NfNodeCaps.defaultCaps;
    private _preMinimizeRect: Rect = new Rect(0, 0, 0, 0);
    private _preMinimizeCaps: NfNodeCaps = NfNodeCaps.defaultCaps;
    //#endregion

    // runtime members
    private _localDragOffset: Vector2;
    private _nodeAction: NfNodeAction;
    private _draggingHitLink: NfLink;
    private _shakeDetector: ShakeDetector;
    private _state: NfNodeState = NfNodeState.none;
    private _minMaxState: NfMinMaxState = NfMinMaxState.normal;
    private _previousMinMaxState: NfMinMaxState = NfMinMaxState.normal;
    private _resizeStartOffset: Vector2 = new Vector2();
    //#endregion

    //#region public Data members

    // the main pimGroup to addstuff to
    public nodeFlow: NodeFlow;
    public mainElement: HTMLElement;
    public mainBody: HTMLElement;
    public options: {};
    public connectorRelativeMid: Vector2 = new Vector2();
    public defaultMinimalNodeSize: Vector2 = new Vector2(115, 25);
    //#endregion

    //#region Properties
    // the node's name
    public get name(): string { return this._header.innerHTML; }
    public set name(value: string) { this._header.innerHTML = value; }

    // the capabilities of the node
    public get caps(): NfNodeCaps { return this._caps; }
    public set caps(value: NfNodeCaps) {
        if (this._caps == value)
            return;
        this._caps = value;

        var hasCloseButton = (this._caps & NfNodeCaps.hasCloseButton);
        pimGui.merge(this._closeButton, undefined, {
            visibility: hasCloseButton ? "visible" : "collapse",
            display: hasCloseButton ? "inline" : "none",                // note: we need this in Chrome, since 'visibility' callapsed does not work as expected (it works like 'hidden', which is wrong)
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
    }

    // get all connectors that are attached to this node
    public get connectors(): NfConnector[] { return this._nfConnectors; }
    public get connectorCount(): number { return this._nfConnectors ? this._nfConnectors.length : 0; }

    // get all links that are attached to this node's connectors
    public get links(): NfLink[] {
        var arr: NfLink[] = [];
        for (var c in this.connectors) {
            var cl = this.connectors[c].links;
            for (var l in cl)
                arr.push(cl[l]);
        }
        return arr;
    }

    public get hasLinks(): boolean {
        for (var c in this.connectors)
            if (this.connectors[c].links.length > 0)
                return true;
        return false;
    }

    // is the node connected to the given connector somehow upstream?
    public isConnected(connector: NfConnector, upStream: boolean) {
        for (var c in this.connectors) {
            var conn = this.connectors[c];
            if (conn === connector)
                return true;
            if ((upStream && conn.kind & NfConnectorKind.Input) ||
                (!upStream && conn.kind & NfConnectorKind.Output)) {
                for (var l in conn.links) {
                    var otherConn = conn.links[l].theOtherConnector(conn);
                    if (otherConn.node && otherConn.node.isConnected(connector, upStream))
                        return true;
                }
            }
        }
        return false;
    }

    // get all incoming links that are attached to this node
    public get incomingLinks(): NfLink[] { return this.nodeFlow.links.filter(link => link.connectorB.node === this); }

    // get all incoming links that are attached to this node
    public get outgoingLinks(): NfLink[] { return this.nodeFlow.links.filter(link => link.connectorA.node === this); }

    private setClassName(element: HTMLElement, baseName: string) {
        var className = baseName;
        if (this.isPassThrough)
            className += " passthrough";
        if (this.isController)
            className += " controller";
        if (this.isInvalid)
            className += " invalid";
        if (this.isSelected)
            className += " selected";
        if (this.minMaxState == NfMinMaxState.minimized)
            className += " minimized";
        if (this.minMaxState == NfMinMaxState.maximized)
            className += " maximized";
        element.className = className;
    }

    private setClassNames() {
        this.setClassName(this._header, "nodeHeader");
        this.setClassName(this.mainElement, "nodeBody");
    }

    private getStateFlag(state: NfNodeState) { return !!(this._state & state); }
    private setStateFlag(state: NfNodeState, value: boolean) {
        var oldState = this._state;
        this._state = value ? (this._state | state) : (this._state & (~state));
        if (oldState != this._state)
            this.setClassNames();
    }
    public get isSelected(): boolean { return this.getStateFlag(NfNodeState.isSelected); }
    public set isSelected(value: boolean) {
        value = this.isPassThrough ? false : value;
        if (value == this.isSelected)
            return;
        this.setStateFlag(NfNodeState.isSelected, value);
        this.nodeFlow._updateTopology(this, NfUpdateReason.SelectionChanged);
    }

    // the current node action the node is in
    public get nodeAction(): NfNodeAction { return this._nodeAction; }
    public set nodeAction(value: NfNodeAction) {
        if (this._nodeAction === value)
            return;
        this._nodeAction = value;
        switch (this._nodeAction) {
            case NfNodeAction.none:
                this.setDownShakeDetector();
                break;
            case NfNodeAction.dragHeader:
                this.setupShakeDetector();
                break;
        }
    }

    private get isAutoPanning() { return this.nodeFlow && this.nodeFlow.isAutoPanning; }
    private set isAutoPanning(value: boolean) {
        this.nodeFlow.setAutoPanning(value, (): boolean => {
            if (!this.nodeFlow)
                return false;
            var nfRect = Rect.contract(this.nodeFlow.clientRect, Vector2.mul(2, this.nodeFlow.autoPanMargin));
            var ourViewRect = this.rect;
            var so = this.nodeFlow.scrollOffset;
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

            if (Vector2.isNearZero(panVector) || Vector2.isNearZero(Vector2.minus(this._previousAutoPanVector, panVector)))
                return false;

            this._previousAutoPanVector = panVector;
            this.nodeFlow.pan(panVector);
            return true;
        });
    }

    public setProgress(value: any) {
        if (value === true) {
            this._progressIndicator.isBusy = true;
            this.caps |= NfNodeCaps.showBusyIndicator;
        }
        else if (value === false || isNaN(value))
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
    }

    // is the node hit at the given location?
    public isHit(position: Vector2): boolean { return this.rect.contains(position); }

    //#region location, size, rect, etc.
    // the node's rectangle, local to the NodeFlow
    public get rect(): Rect { return Rect.fromHTMLElementStyle(this.mainElement); }
    public set rect(value: Rect) {
        value.setToHTMLElementStyle(this.mainElement);
        this.raiseOnSizeChanged();
    }

    // get the rectangle spanning all connectors
    public get connectorRect(): Rect {
        var l = this.connectors.length;
        var nodeRect = this.rect;
        if (l <= 1)
            return nodeRect;
        var rect = new Rect(Number.MAX_VALUE, Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
        for (var t = 0; t < l; t++) {
            var cm = this.connectors[t].midPosition;
            if (cm.x < rect.x) rect.x = cm.x;
            if (cm.x > rect.width) rect.width = cm.x;
            if (cm.y < rect.y) rect.y = cm.y;
            if (cm.y > rect.height) rect.height = cm.y;
        }
        if (nodeRect.x < rect.x) rect.x = nodeRect.x;
        if (nodeRect.right > rect.width) rect.width = nodeRect.right;
        rect.width -= rect.x;
        rect.height -= rect.y;
        return rect;
    }

    // the mid of the connectorRect, relative to the node position
    public calculateConnectorRelativeMid() {
        this.connectorRelativeMid = Vector2.minus(this.connectorRect.mid, this.position);
    }

    // the node's position, local to the NodeFlow
    public get mid(): Vector2 { return this.rect.mid; }

    public get position(): Vector2 { return new Vector2(this.x, this.y); }
    public set position(value: Vector2) {
        pimGui.merge(this.mainElement, undefined, { left: Math.max(value.x, 0) + "px", top: Math.max(value.y, 0) + "px" });
        this.raiseOnSizeChanged();
    }

    // the node's size
    public get size(): Vector2 { return new Vector2(this.width, this.height); }
    public set size(value: Vector2) {
        pimGui.merge(this.mainElement, undefined, { width: value.x + "px", height: value.y + "px" });
        this.raiseOnSizeChanged();
    }

    // the node's x position, local to the NodeFlow
    public get x(): number { return parseInt(getComputedStyle(this.mainElement).left, 10); }
    public set x(value: number) {
        this.mainElement.style.left = Math.max(value, 0) + "px";
        this.raiseOnSizeChanged();
    }

    // the node's y position, local to the NodeFlow
    public get y(): number { return parseInt(getComputedStyle(this.mainElement).top, 10); }
    public set y(value: number) {
        this.mainElement.style.top = Math.max(value, 0) + "px";
        this.raiseOnSizeChanged();
    }

    // the node's width
    public get width(): number { return parseInt(getComputedStyle(this.mainElement).width, 10); }
    public set width(value: number) {
        this.mainElement.style.width = value + "px";
        this.raiseOnSizeChanged();
    }

    // the node's height
    public get height(): number { return parseInt(getComputedStyle(this.mainElement).height, 10); }
    public set height(value: number) {
        this.mainElement.style.height = value + "px";
        this.raiseOnSizeChanged();
    }

    // the node's left (and alias for x)
    public get left(): number { return this.x; }
    public set left(value: number) { this.x = value; }

    // the node's top (and alias for y)
    public get top(): number { return this.y; }
    public set top(value: number) { this.y = value; }

    // the node's right
    public get right(): number { return this.x + this.width; }
    public set right(value: number) { this.width = value - this.x; }

    // the node's bottom
    public get bottom(): number { return this.y + this.height; }
    public set bottom(value: number) { this.height = value - this.y; }

    // the indication of an invalid node
    public get isInvalid() { return this.getStateFlag(NfNodeState.isInvalid); }
    public set isInvalid(value: boolean) { if (this.isInvalid != value) this.setStateFlag(NfNodeState.isInvalid, value); }

    public resetInvalid(pinIndex?: number) {
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
    }
    public makeInvalid(pinIndex: number, reason: string) {
        this.isInvalid = true;
        var conn = this.connectors[pinIndex];
        if (conn) {
            conn.invalidReason = reason;
            conn.updatePosition();
        }
    }

    private resetAllConnectorHints() {
        for (var t = 0; t < this.connectors.length; t++)
            this.connectors[t].resetConnectorHint();
    }

    public get isVisible() { return this.getStateFlag(NfNodeState.isVisible); }
    public set isVisible(value: boolean) {
        this.setStateFlag(NfNodeState.isVisible, value);
        this.mainElement.style.visibility = value ? "visible" : "collapse";
        this.mainElement.style.display = value ? "inline" : "none";
        for (var l in this.connectors)
            this.connectors[l].isVisible = value;
    }


    public get isPassThrough() { return this.getStateFlag(NfNodeState.isPassThrough); }
    public set isPassThrough(value: boolean) {
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
    }

    public get isController() { return this.getStateFlag(NfNodeState.isController); }
    public set isController(value: boolean) {
        this.setStateFlag(NfNodeState.isController, value);
        this._controllerButton.className = this.isController ? "nodeControllerButton pressed" : "nodeControllerButton";
    }

    public get minimumSize() { return new Vector2(Math.min(this._normalRect.width, this.defaultMinimalNodeSize.x), this.defaultMinimalNodeSize.y); }

    public get minMaxState() { return this._minMaxState; }
    public set minMaxState(value: NfMinMaxState) {
        this._previousMinMaxState = this._minMaxState;
        if (this._minMaxState == value)
            return;
        if (this._minMaxState == NfMinMaxState.normal) {
            this._normalRect = this.rect;
            this._normalCaps = this.caps;
        }
        switch (value) {
            case NfMinMaxState.normal:
                this._maximizeButton.className = "nodeMaximizeButton";
                this._maximizeButton.innerHTML = "-";
                this.nodeFlow.maximizedNode = null;
                if (this._normalRect) {
                    this.rect = this._normalRect;
                    this.caps = this._normalCaps;
                }
                this.showHideResizer(true);
                break;
            case NfMinMaxState.minimized:
                this._maximizeButton.className = "nodeMaximizeButton minimized";
                this._maximizeButton.innerHTML = "+";

                this.caps = this.caps & (~NfNodeCaps.hasCloseButton);
                var minSize = this.minimumSize;
                this.rect = new Rect(this._normalRect.x, this._normalRect.y, minSize.x, minSize.y);
                this.nodeFlow.maximizedNode = null;
                this.showHideResizer(false);
                break;
            case NfMinMaxState.maximized:
                this._maximizeButton.className = "nodeMaximizeButton maximized";
                this._maximizeButton.innerHTML = "-";
                this.rect = this.nodeFlow.clientRect;
                this.nodeFlow.maximizedNode = this;
                this.showHideResizer(false);
                break;
        }

        this._minMaxState = value;

        var isNormal = !!(this.minMaxState == NfMinMaxState.normal || this.minMaxState == NfMinMaxState.minimized);
        for (var l in this.connectors) {
            var conn = this.connectors[l];
            conn.isVisible = isNormal;
            conn.updateLinks();
        }
        this.setClassNames();
    }

    public cycleMinMaxState(forward: boolean = true) {
        switch (this._minMaxState) {
            case NfMinMaxState.normal:
                this.minMaxState = forward ? NfMinMaxState.minimized : NfMinMaxState.maximized;
                break;
            case NfMinMaxState.minimized:
                this.minMaxState = forward ? NfMinMaxState.normal : NfMinMaxState.maximized;
                break;
            case NfMinMaxState.maximized:
                this.minMaxState = this._previousMinMaxState;
                break;
        }
        //console.log(this._minMaxState);
    }

    //#endregion
    public forEachConnector(func: Function, reverse: boolean = false) {
        var result = [];
        var l = this.connectorCount;
        if (reverse)
            while (--l >= 0)
                func(this.connectors[l]);
        else
            for (var t = 0; t < l; t++)
                func(this.connectors[l]);
    }

    private raiseOnSizeChanged() {
        //console.log("node <" + this.name + "> size changed to " + this.rect);
        for (var t in this._nfConnectors)
            this._nfConnectors[t].updatePosition();
        this.nodeFlow._updateTopology(this, NfUpdateReason.NodeSizeChanged);
        this.nodeFlow.makeDirty(NfDirtyState.nodesChanged);
    }

    //#region shake detection to unlink a node
    private setupShakeDetector() {
        this.setDownShakeDetector();
        if (this.nodeFlow.useShakeDisconnect && this.hasLinks)
            this._shakeDetector = new ShakeDetector(() => this.handleShake());
    }

    private setDownShakeDetector() {
        if (this._shakeDetector) {
            this._shakeDetector.cleanup();
            this._shakeDetector = null;
        }
    }

    private feedShakeDetector(position: Vector2) {
        if (this._shakeDetector)
            this._shakeDetector.feedPosition(position);
    }

    private handleShake() {
        if (this.isAutoPanning)         // never disconnect a node while autopanning, that's just annoying for the user
            return;
        this.unlinkOrDeleteLinks();
        this.setDownShakeDetector();
    }
    //#endregion

    //#region resize event handlers   
    private handleResizeMouseDown(e: MouseEvent) {
        switch (e.button) {
            case 0:
                if (this.minMaxState == NfMinMaxState.normal) {
                    var rect = this.rect;
                    this._resizeStartOffset = Vector2.minus(this.nodeFlow.getClientMousePosition(e), new Vector2(rect.right, rect.bottom));
                    this.nodeAction = NfNodeAction.resizing;
                    window.addEventListener("mousemove", this._resizeMousemoveEventHandler);
                    window.addEventListener("mouseup", this._resizeMouseupEventHandler);
                }
                break;
        }
    }
    private handleResizeMouseMove(e: MouseEvent) {
        switch (this.nodeAction) {
            case NfNodeAction.resizing:
                this.resizeToMouse(e);
                break;
        }
    }
    private handleResizeMouseUp(e: MouseEvent) {
        switch (this.nodeAction) {
            case NfNodeAction.resizing:
                this.nodeAction = NfNodeAction.none;
                window.removeEventListener("mousemove", this._mousemoveEventHandler);
                window.removeEventListener("mouseup", this._mouseupEventHandler);
                break;
        }
    }

    private resizeToMouse(e: MouseEvent) {
        var size = Vector2.minus(Vector2.minus(this.nodeFlow.getClientMousePosition(e), this._resizeStartOffset), this.position);
        var w = (this.options && this.options["width"]) || this._originalRect.width;
        var h = (this.options && this.options["height"]) || this._originalRect.height;
        if (size.x < w)
            size.x = w;
        if (size.y < h)
            size.y = h;
        this.size = size;
        this.nodeFlow._updateTopology(this, NfUpdateReason.NodeSizeChanged);
    }
    //#endregion

    //#region drag event handlers
    private handleMouseDown(e: MouseEvent) {
        switch (e.button) {
            case 0:
                if (this.minMaxState == NfMinMaxState.maximized)
                    break;
                var localMousePosition = this.nodeFlow.getClientMousePosition(e);
                this._localDragOffset = Vector2.minus(localMousePosition, this.position);
                this.nodeAction = NfNodeAction.dragHeader;
                if (!this.isAutoPanning)        // never detect a shake while autopanning 
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
    }

    private handleMouseMove(e: MouseEvent) {
        var localMousePosition = this.nodeFlow.getClientMousePosition(e);
        switch (this.nodeAction) {
            default:
                break;
            case NfNodeAction.dragHeader:
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
                }
                else if (this.isLinkInsertable)       // note: if control is pressed, we avoid inserting the node on a link
                    this.highlightPossibleInsertionLink();

                if (!this._draggingHitLink)
                    this.resetAllConnectorHints();

                this.isAutoPanning = true;
                e.stopPropagation();
                e.preventDefault();
                break;
        }
    }

    public insertOnLink() {
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

                var linkCaps = NfLinkCaps.hasBezier;
                if ((connectorsToLink[0].kind & NfConnectorKind.Input) || (connA.kind & NfConnectorKind.Output))
                    linkCaps |= NfLinkCaps.hasArrow;
                var freshLink = new NfLink(connA, connectorsToLink[0], linkCaps);
                this.nodeFlow.addLink(freshLink);
                freshLink.normalizeConnectors();

                linkCaps = NfLinkCaps.hasBezier;
                if ((connB.kind & NfConnectorKind.Input) || (connectorsToLink[1].kind & NfConnectorKind.Output))
                    linkCaps |= NfLinkCaps.hasArrow;
                freshLink = new NfLink(connectorsToLink[1], connB, linkCaps);
                this.nodeFlow.addLink(freshLink);
                freshLink.normalizeConnectors();
            }
            this._draggingHitLink = null;
        }
    }

    private handleMouseUp(e: MouseEvent) {
        var localMousePosition = this.nodeFlow.getClientMousePosition(e);
        this.resetAllConnectorHints();

        switch (this.nodeAction) {
            default:
                break;
            case NfNodeAction.dragHeader:
                this.position = Vector2.minus(localMousePosition, this._localDragOffset);
                this.nodeAction = NfNodeAction.none;
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
    }
    //#endregion

    //#region Link insertion
    private highlightPossibleInsertionLink() {
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
    }

    // is this node a node that is typically electable to be inserted on an existing link?
    // a) does it have at least one input and one output connection?
    // b) does it have no links attached to it yet?
    private get isLinkInsertable(): boolean {
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
    }

    // can the node actually be inserted on the given link?
    private canBeInsertedOnLink(link: NfLink): NfConnector[] {
        var resultConnectors: NfConnector[] = [null, null];
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
    }
    //#endregion

    //#region header renaming
    private handleMouseDoubleClick(e?: MouseEvent) {
        var removeRenameEditBox = () => {
            this._headerGroup.replaceChild(this._header, this._renameEditBox);
            this._renameEditBox = null;
        };
        this._renameEditBox = <HTMLInputElement>pimGui.pimEdit(this.name, e => {
            this.name = this._renameEditBox.value;
            if (e.key === "Enter")
                removeRenameEditBox();
        });
        this._renameEditBox.className = "NodeHeaderRenameEditBox";
        this._renameEditBox.onblur = () => removeRenameEditBox();
        pimGui.merge(this._renameEditBox, undefined,
            {
                width: this._header.clientWidth + "px",
                height: this._header.clientHeight + "px"
            });
        this._headerGroup.replaceChild(this._renameEditBox, this._header);
        this._renameEditBox.selectionStart = 0;
        this._renameEditBox.selectionEnd = this._renameEditBox.value.length;
    }

    private handleMaximizeMouseEnter(e?: MouseEvent) {
        if (this.minMaxState == NfMinMaxState.maximized)
            return;
        this._maximizeButton.className = "nodeMaximizeButton hovering";
        this._maximizeButton.innerHTML = "▲<br/>" + (this.minMaxState == NfMinMaxState.minimized ? "+" : "-");
        this.mainElement.appendChild(this._maximizeButton);
        this.nodeFlow.rootElement.addEventListener("mousemove", this._maximizeMouseMove);
        this._maximizeButton.addEventListener("mousedown", this._maximizeMouseDown);
    }

    private handleMaximizeMouseDown(e?: MouseEvent) {
        if (!this._maximizeButton)
            return;
        var mousePos = this.nodeFlow.getClientMousePosition(e);
        var rect = Rect.fromHTMLElementRecursivePositionComputedSize(this._maximizeButton, this.nodeFlow.rootElement);
        var rectMid = rect.y + rect.height * .5;
        if (mousePos.y <= rectMid) {
            this.minMaxState = NfMinMaxState.maximized;
            this.closeMaximizeHoverButton();
        } else {
            this.cycleMinMaxState(!e.ctrlKey);
            this.closeMaximizeHoverButton();
        }
    }

    private handleMaximizeMouseMove(e?: MouseEvent) {
        if (this._maximizeButton && !Rect.pointInRect(Rect.fromHTMLElementRecursivePositionComputedSize(this._maximizeButton, this.nodeFlow.rootElement), this.nodeFlow.getClientMousePosition(e)))
            this.closeMaximizeHoverButton();
    }

    private closeMaximizeHoverButton() {
        this._maximizeButton.innerHTML = this.minMaxState == NfMinMaxState.minimized ? "+" : "-";
        this._maximizeButton.removeEventListener("mousedown", this._maximizeMouseDown);
        this.nodeFlow.rootElement.removeEventListener("mousemove", this._maximizeMouseMove);
        this._maximizeButton.className = "nodeMaximizeButton";
        if (this._headerGroup)
            this._headerGroup.appendChild(this._maximizeButton);
    }

    private showHideResizer(showHide: boolean) {
        pimGui.merge(this._resizer, {}, { visibility: showHide ? 'visible' : 'collapse', display: showHide ? "inline" : "none" });
    }
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
    public close() {
        if (!(this._caps & NfNodeCaps.askCloseConfirm) ||
            confirm("Are you sure you want to delete node <" + this.name + "> and its links?")) {
            this.cleanup();
        }
    }

    // add an NfConnector to the NfNode
    public addConnector(connector: NfConnector): NfConnector {
        if (!connector)
            return;
        connector.node = this;
        connector.nodeFlow = this.nodeFlow;
        //this.nodeFlow.paperElement.appendChild(connector.mainElement);
        this.mainElement.appendChild(connector.mainElement);
        this._nfConnectors.push(connector);
        this.calculateConnectorRelativeMid();
        return connector;
    }

    // remove an NfConnector from the NfNode
    public removeConnector(connector: NfConnector): NfConnector {
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
    }

    // get any hit connector
    public getHitConnector(position: Vector2): NfConnector {
        var closestConnector: NfConnector = null;
        var closestSqrDistance: number = Number.MAX_VALUE;
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
    }
    //#endregion

    toString(): string { return "NfNode(" + this.name + ")"; }

    //#region add/remove event listeners
    private _mousedownEventHandler = e => this.handleMouseDown(e);
    private _mousemoveEventHandler = e => this.handleMouseMove(e);
    private _mouseupEventHandler = e => this.handleMouseUp(e);
    private _dblclickEventHandler = e => this.handleMouseDoubleClick(e);
    private _maximizeMouseEnter = e => this.handleMaximizeMouseEnter(e);
    private _maximizeMouseMove = e => this.handleMaximizeMouseMove(e);
    private _maximizeMouseDown = e => this.handleMaximizeMouseDown(e);
    private _resizeMousedownEventHandler = e => this.handleResizeMouseDown(e);
    private _resizeMousemoveEventHandler = e => this.handleResizeMouseMove(e);
    private _resizeMouseupEventHandler = e => this.handleResizeMouseUp(e);

    private registerEventHandlers(addOrRemove: boolean) {
        var registrar = addOrRemove ? HTMLElement.prototype.addEventListener : HTMLElement.prototype.removeEventListener;
        registrar.call(this._header, "mousedown", this._mousedownEventHandler);
        registrar.call(this._header, "dblclick", this._dblclickEventHandler);
        registrar.call(this._maximizeButton, "mouseenter", this._maximizeMouseEnter);
        registrar.call(this._resizer, "mousedown", this._resizeMousedownEventHandler);
    }
    //#endregion

    // unlink the node and restore the throughput link  if possible, otherwise delete all links
    // return true when something changed, false otherwise
    private unlinkOrDeleteLinks() {
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
            var generateLinkThrough = (connA.node != this && connB.node != this);           // only make the link-through, if the connectors are not ours

            // remove the old links
            this.nodeFlow.removeLink(links[1]);
            this.nodeFlow.removeLink(links[0]);

            // ..and make the connA->connB link, if accepted
            if (generateLinkThrough && connA.isAccepted(connB)) {
                var linkCaps = NfLinkCaps.hasBezier;
                if ((connB.kind & NfConnectorKind.Input) || (connA.kind & NfConnectorKind.Output))
                    linkCaps |= NfLinkCaps.hasArrow;
                var link = new NfLink(connA, connB, linkCaps)
                link.normalizeConnectors();
                this.nodeFlow.addLink(link);
            }
        }
        else {
            var ll = links.length;
            while (--ll >= 0)
                this.nodeFlow.removeLink(links[ll])     // the regular case: remove all links that are connected to the node
        }
    }

    public cleanup() {
        this.isAutoPanning = false;
        this.nodeAction = NfNodeAction.none;
        this.unlinkOrDeleteLinks();

        this.registerEventHandlers(false);
        Array.prototype.forEach.call(this._nfConnectors, connector => {
            //this.nodeFlow.paperElement.removeChild(connector.mainElement);
            this.mainElement.removeChild(connector.mainElement);
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
    }

    private makeBody() {
        var result = pimGui.merge(document.createElement("div"), { className: "pimGroup nodeGroup" });
        if (arguments)
            for (var i in arguments)
                result.appendChild((arguments[i] instanceof Array) ? pimGui.pimHGroup.apply(this, arguments[i]) : arguments[i]);
        return result;
    }

    constructor(nodeFlow: NodeFlow, rect: Rect, name: string= undefined, caps: NfNodeCaps = NfNodeCaps.defaultCaps) {
        this.nodeFlow = nodeFlow;
        this._progressIndicator = new ProgressIndicator();

        // make the dragging header (which also carries the name of the node)
        this._headerGroup = pimGui.merge(pimGui.hflex(
            this._closeButton = pimGui.merge(pimGui.pimButton("X", () => this.close()), { className: "nodeCloseButton" }),
            this._passThroughButton = pimGui.merge(pimGui.pimButton("P", () => this.isPassThrough = !this.isPassThrough), { className: "nodePassThroughButton" }),
            this._controllerButton = pimGui.merge(pimGui.pimButton("C", () => this.isController = !this.isController), { className: "nodeControllerButton" }),
            this._header = pimGui.merge(pimGui.pimLabel(name || "Node_" + nodeFlow.nodes.length), { className: "nodeHeader" }),
            this._progressIndicator.mainElement,
            this._maximizeButton = pimGui.merge(pimGui.pimButton("-", e => this.cycleMinMaxState(!e.ctrlKey)), { className: "nodeMaximizeButton" })
            ), { className: "nodeHeaderFlex" });

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
        this.nodeAction = NfNodeAction.none;
        this._unSelectedBackgroundColor = this.mainElement.style.backgroundColor;

        this.nodeFlow.unSelectAllNodes();
        this.isSelected = true;
    }
}
