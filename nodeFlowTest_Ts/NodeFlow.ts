///<reference path="pim.d.ts" />

///<reference path="Vector2.ts" />
///<reference path="TimedCaller.ts" />
///<reference path="Rect.ts" />
///<reference path="NfNode.ts" />
///<reference path="NfConnector.ts" />
///<reference path="NfLink.ts" />
///<reference path="NfSettler.ts" />

// possible actions a NodeFlow can be performing
enum NodeFlowAction {
    none,
    panning,
}

enum NfDirtyState {
    none,
    nodesChanged = 1 << 0,
    linksChanged = 1 << 1,
}

enum NfUpdateReason {
    none,
    Add,
    Remove,
    NodeSizeChanged,
    SelectionChanged,
    NodeClose,
}

class NodeFlow {
    //#region private Data members
    private _wasPanning: boolean = false;
    private _nodeFlowAction = NodeFlowAction.none;
    private _refreshTimedCaller: TimedCaller;
    private _refreshFPS: number = 20;
    private _startPanMouseOffset: Vector2 = new Vector2();
    private _updateHandler: Function;
    private _miniatureView: MiniatureView;
    private _autoPanTimedCaller: TimedCaller;
    private _panTarget: Vector2;
    private _isPanTargetSet: boolean = false;
    private _maximizedNode: NfNode = null;
    private _preMaximizeScroll: Vector2 = new Vector2();
    private _preMaximizeOverflow: string = "scroll";
    private _connectorFanout: number = 1.0;
    private _splineBulge: number = 1;
    private _useSplines: boolean = true;
    private _dirtyState: NfDirtyState = NfDirtyState.none;
    private _toggleNodeMinMaxState: boolean = false;
    //#endregion

    //#region public Data members
    public useCustomLinkIntersection: boolean = true;
    public maximumSplineBulge: number = 1.5;
    public xmlns = "http://www.w3.org/2000/svg";
    public scrollingLeeway: Vector2 = new Vector2(500, 500);
    public allowCycles: boolean = false;
    public rootElement: HTMLElement;
    public paperElement: HTMLElement;
    public svgElement: HTMLElement;

    public miniatureViewRect: Rect = new Rect(-25, 5, 100, 100);
    public autoPanMargin: Vector2 = new Vector2(20, 20);
    public defaultAutoPanSpeed: number = .3;
    public autoPanSpeed: number = this.defaultAutoPanSpeed;
    public useAutoPan: boolean = true;
    public panMarginFractionOfView: number = 0.65;
    public panSpeed: number = 0.05;
    public useShakeDisconnect: boolean = true;
    public nodes: NfNode[] = [];
    public links: NfLink[] = [];
    //#endregion

    // helper methods
    public static isControlPressed(e: MouseEvent): boolean { return (e.getModifierState && e.getModifierState("Control")) || e.ctrlKey; }

    //#region properties
    public makeDirty(flag: NfDirtyState) { this._dirtyState |= flag; }

    private updateAllLinks() {
        for (var l in this.links)
            this.links[l].update();
    }

    public get useSplines(): boolean { return this._useSplines; }
    public set useSplines(value: boolean) {
        if (this._useSplines == value)
            return;
        this._useSplines = value;
        this.updateAllLinks();
    }

    public get splineBulge(): number { return this._splineBulge; }
    public set splineBulge(value: number) {
        var value = Math.max(Math.min(value, 2), 0);
        if (this._splineBulge == value)
            return;
        this._splineBulge = value;
        this.updateAllLinks();
    }

    public get connectorFanout(): number { return this._connectorFanout; }
    public set connectorFanout(value: number) {
        var value = Math.max(Math.min(value, 1), 0);
        if (this._connectorFanout == value)
            return;
        this._connectorFanout = value;
        this.updateAllLinks();
    }

    public get scrollOffset(): Vector2 { return new Vector2(this.rootElement.scrollLeft, this.rootElement.scrollTop); }
    public set scrollOffset(value: Vector2) {
        this.rootElement.scrollLeft = value.x;
        this.rootElement.scrollTop = value.y;
    }

    public get maximizedNode() { return this._maximizedNode; }
    public set maximizedNode(value: NfNode) {
        var updateTopologyElement = value || this.maximizedNode;
        if (value) {
            if (!this.maximizedNode) {
                this._preMaximizeScroll = this.scrollOffset;
                this._preMaximizeOverflow = this.rootElement.style.overflow;
            }
            this.rootElement.style.overflow = "hidden";
            this.scrollOffset = new Vector2();
            this.rootElement.style.width = this.rootElement.style.height = this.paperElement.style.width = this.paperElement.style.height = "100%";
        }
        else {
            this.rootElement.style.overflow = this._preMaximizeOverflow;
            this.rootElement.style.width = this.rootElement.style.height = this.paperElement.style.width = this.paperElement.style.height = null;
            this.scrollOffset = this._preMaximizeScroll;
        }
        this._maximizedNode = value;
        pimGui.merge(this.svgElement, undefined, {
            visibility: this._maximizedNode ? "collapse" : "visible",
            display: this._maximizedNode ? "none" : "inline",                // note: we need this in Chrome, since 'visibility' callapsed does not work as expected (it works like 'hidden', which is wrong)
        });

        this.isMiniatureViewVisible = (!this._maximizedNode) && (this.nodes.length > 0);
        this.forEach(this.nodes, node => { if (node != this._maximizedNode) node.isVisible = !this._maximizedNode; });
        this.minimizePaper();
        this.refresh();
    }

    // the refresh rate interval (in Frames Per Second)
    private get refreshFPS(): number { return this._refreshFPS; }
    private set refreshFPS(value: number) {
        this._refreshFPS = value;

        // clear out any pending handler
        if (this._refreshTimedCaller) {
            this._refreshTimedCaller.cleanup();
            this._refreshTimedCaller = null;
        }

        // install the fresh handler
        if (this._refreshFPS > 0)
            this._refreshTimedCaller = new TimedCaller(this._refreshFPS, () => {
                if (this._isPanTargetSet)
                    this.handlePanTarget();
                if (this._dirtyState != NfDirtyState.none)
                    this.refresh();
                if (NfConnector.isDraggingTangentDirty && NfConnector.draggingLooseConnector)
                    NfConnector.draggingLooseConnector.updateLinks();
            });
    }

    // the nodeFlow's local rect (= always (0,0,width,height))
    public get clientRect(): Rect {
        var cs = getComputedStyle(this.rootElement);
        return new Rect(0, 0, parseInt(cs.width, 10), parseInt(cs.height, 10));
    }
    public get paperRect(): Rect {
        var cs = getComputedStyle(this.paperElement);
        return new Rect(0, 0, parseInt(cs.width, 10), parseInt(cs.height, 10));
    }

    // the leeway we give a the sides for panning
    public get panMargin(): Vector2 {
        var cs = getComputedStyle(this.paperElement);
        return new Vector2(parseInt(cs.width, 10) * this.panMarginFractionOfView,
            parseInt(cs.height, 10) * this.panMarginFractionOfView);
    }

    public get isAutoPanning() { return !!this._autoPanTimedCaller; }
    public setAutoPanning(value: boolean, func?: Function) {
        if (this._autoPanTimedCaller) {
            this._autoPanTimedCaller.cleanup();
            this._autoPanTimedCaller = null;
        }

        if (this.useAutoPan && value && func && func())
            this._autoPanTimedCaller = new TimedCaller(50, () => { if (!func()) this.setAutoPanning(false); });
    }

    //#region public methods
    // add an NfNode to the NodeFlow
    public addNode(node: NfNode, triggerUpdate: boolean = true): NfNode {
        if (!node)
            return;
        this.paperElement.appendChild(node.mainElement);
        this.nodes.push(node);
        node.nodeFlow = this;
        this.makeDirty(NfDirtyState.nodesChanged);
        this.isMiniatureViewVisible = true;
        if (triggerUpdate)
            this._updateTopology(node, NfUpdateReason.Add);
        return node;
    }

    // remove an NfNode from the NodeFlow
    public removeNode(node: NfNode, triggerUpdate: boolean = true): NfNode {
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
            this._updateTopology(node, NfUpdateReason.Remove);
        if (this.nodes.length <= 0)
            this.minimizePaper();
        this.makeDirty(NfDirtyState.nodesChanged);
        return node;
    }

    public addLink(link: NfLink, triggerUpdate: boolean = true): NfLink {
        if (!link)
            return;
        this.links.push(link);
        link.nodeFlow = this;
        if (triggerUpdate)
            this._updateTopology(link, NfUpdateReason.Add);
        return link;
    }

    public removeLink(link: NfLink, triggerUpdate: boolean = true): NfLink {
        if (!link)
            return;
        var index = this.links.indexOf(link);
        if (index < 0)
            return;
        this.links.splice(index, 1);
        link.cleanup();
        if (triggerUpdate)
            this._updateTopology(link, NfUpdateReason.Remove);
        return link;
    }

    public getClosestHitConnector(position: Vector2): NfConnector {
        var closestConnector: NfConnector = null;
        var closestSqrDistance: number = Number.MAX_VALUE;
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
    }

    public getClientMousePosition(e: MouseEvent): Vector2 {
        var cr = this.rootElement.getBoundingClientRect();
        var cs = getComputedStyle(this.rootElement);
        var borderLeft = parseInt(cs.borderLeftWidth, 10);
        var borderTop = parseInt(cs.borderTopWidth, 10);
        var so = this.scrollOffset;
        return new Vector2(e.clientX + so.x - cr.left - 4 - borderLeft, e.clientY + so.y - cr.top - 4 - borderTop);
    }

    public getClientMousePositionUnScrolled(e: MouseEvent): Vector2 {
        var rectObject = this.rootElement.getBoundingClientRect();
        return new Vector2(e.clientX - rectObject.left + 5, e.clientY - rectObject.top + 5);
    }
    //#endregion

    //#region private methods
    private refresh() {
        if (this.maximizedNode)
            return;
        // update miniatureview if the nodes changed
        if (this._miniatureView && this.isMiniatureViewVisible && (this._dirtyState & NfDirtyState.nodesChanged))
            this._miniatureView.refresh();
        this._dirtyState = NfDirtyState.none;
    }

    public minimizePaper() {
        var allRect = this.allRect;
        this.paperElement.style.width = allRect.width + "px";
        this.paperElement.style.height = allRect.height + "px";
    }

    public pan(deltaPos: Vector2, setDirect: boolean = false): boolean {
        if (Vector2.isZero(deltaPos) || this.maximizedNode)
            return false;

        if (setDirect) {
            this.scrollOffset = Vector2.minus(this.scrollOffset, deltaPos);
            if (this._miniatureView)
                this._miniatureView.refresh();
            this._panTarget = this.scrollOffset;
        }
        else
            this._panTarget = Vector2.minus(this.scrollOffset, deltaPos);
        this._isPanTargetSet = !setDirect;
        this.updateAllLinks();
        return true;
    }

    private handlePanTarget() {
        var oldScrollOffset = this.scrollOffset
        this.scrollOffset = Vector2.lerp(this.scrollOffset, this._panTarget, this.autoPanSpeed);
        if (Vector2.equals(oldScrollOffset, this.scrollOffset))        // if there was no actual movement anymore, stop panning to the target
            this._isPanTargetSet = false;
        if (this._miniatureView)
            this._miniatureView.refresh();
    }

    // get the total bounding rectangle of all nodes
    public get allNodesRect(): Rect {
        var count = this.nodes.length;
        if (count <= 0)
            return new Rect(0, 0, 0, 0);
        var rect = this.nodes[0].rect;
        for (var t = 1; t < count; t++)
            rect = Rect.union(rect, this.nodes[t].rect);
        return rect;
    }

    public get allRect(): Rect {
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
    }

    public getHitLinkByRect(rect: Rect): NfLink {
        for (var t in this.links)
            if (this.links[t].isCurveHitByRect(rect))
                return this.links[t];
        return null;
    }

    // return the hitnode at the given position, if any
    public getHitNode(position: Vector2): NfNode {
        for (var t in this.nodes)
            if (this.nodes[t].isHit(position))
                return this.nodes[t];
        return null;
    }

    //#region event listeners
    private _doubleClickEventHandler = e => {
        if (!NfConnector.draggingLooseConnector && !this.maximizedNode && !this.getHitNode(this.getClientMousePosition(e))) {
            this._toggleNodeMinMaxState = !this._toggleNodeMinMaxState;
            console.log("this._toggleNodeMinMaxState = " + this._toggleNodeMinMaxState);
            for (var n in this.nodes)
                this.nodes[n].minMaxState = this._toggleNodeMinMaxState ? NfMinMaxState.minimized : NfMinMaxState.normal;
        }
    }

    private _mousedownEventHandler = e => {
        if (NfConnector.draggingLooseConnector || this.maximizedNode)         // if the user is currently dragging a link or has a node maximized, leave early
            return;
        var mousePos = this.getClientMousePosition(e);
        var hitNode = this.getHitNode(mousePos);
        //console.log("hit node: " + (hitNode != null ? hitNode.name : "none"));
        if (!hitNode) {
            var hitElement = <HTMLElement>document.elementFromPoint(mousePos.x, mousePos.y);
            //console.log("hit element at " + mousePos + ": <" + (hitElement ? hitElement.nodeName : "none") + ">");
            if (!hitElement || hitElement.nodeName.toLowerCase() != "div") {
                this._nodeFlowAction = NodeFlowAction.panning;
                this._wasPanning = false;
                this._startPanMouseOffset = Vector2.minus(mousePos, this.scrollOffset);
                this.rootElement.style.cursor = "all-scroll";
                window.addEventListener("mousemove", this._mousemoveEventHandler);
                window.addEventListener("mouseup", this._mouseupEventHandler);
                e.stopPropagation();
                e.preventDefault();
            }
        }
    }

    private _mousemoveEventHandler = e => {
        if (NfConnector.draggingLooseConnector)         // if the user is currently dragging a link, leave early
            return;
        switch (this._nodeFlowAction) {
            case NodeFlowAction.none:
                break;
            case NodeFlowAction.panning:
                var mousePos = this.getClientMousePosition(e);
                var oldScrollOffset = this.scrollOffset;
                var delta = Vector2.minus(Vector2.minus(mousePos, this._startPanMouseOffset), oldScrollOffset);
                if (this._wasPanning = this.pan(delta, true))
                    this._startPanMouseOffset = Vector2.minus(this._startPanMouseOffset, Vector2.minus(this.scrollOffset, oldScrollOffset));
                this.setAutoPanning(false);
                e.stopPropagation();
                e.preventDefault();
                break;
        }
    }
    private _mouseupEventHandler = e => {
        if (NfConnector.draggingLooseConnector)         // if the user is currently dragging a link, leave early
            return;
        switch (this._nodeFlowAction) {
            case NodeFlowAction.none:
                break;
            case NodeFlowAction.panning:
                if (!this._wasPanning)
                    this.unSelectAllNodes();
                this.rootElement.style.cursor = "default";

                window.removeEventListener("mousemove", this._mousemoveEventHandler);
                window.removeEventListener("mouseup", this._mouseupEventHandler);

                e.stopPropagation();
                e.preventDefault();
                break;
        }
        this._nodeFlowAction = NodeFlowAction.none;
    }

    private registerEventHandlers(addOrRemove: boolean) {
        this.rootElement[addOrRemove ? "addEventListener" : "removeEventListener"]("mousedown", this._mousedownEventHandler);
        this.rootElement[addOrRemove ? "addEventListener" : "removeEventListener"]("dblclick", this._doubleClickEventHandler);
    }
    //#endregion

    //#endregion

    private forEach(arr: any[], func: Function, reverse: boolean = false) {
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
    }

    public unSelectAllNodes() { this.forEach(this.nodes, node => node.isSelected = false); }

    // call this method internally if the nodeflow's topology is dirty
    public _updateTopology(item: any, updateReason: NfUpdateReason) {
        if (this._updateHandler)
            this._updateHandler(item, updateReason);
    }

    public get isMiniatureViewVisible() { return !!this._miniatureView; }
    public set isMiniatureViewVisible(value: boolean) {
        if (value == this.isMiniatureViewVisible)
            return
        if (value)
            this._miniatureView = new MiniatureView(this, this.miniatureViewRect);
        else {
            this._miniatureView.cleanup();
            this._miniatureView = null;
        }
    }

    public cleanup() {
        this.refreshFPS = 0;
        this.setAutoPanning(false);
        this._updateHandler = null;
        this.isMiniatureViewVisible = false;
        this.forEach(this.links, link => { link.cleanup(); delete link; }, true);
        this.forEach(this.nodes, node => { node.cleanup(); delete node; }, true);
        this.registerEventHandlers(false);
        this.rootElement.removeChild(this.paperElement);
        this.svgElement = null;
        this.paperElement = null;
        document.body.removeChild(this.rootElement);
        this.rootElement = null;
    }

    constructor(updateHandler?: Function) {
        this.rootElement = pimGui.merge(document.createElement("div"), { id: "root" },
            {
                "background-color": "rgb(150,150,150)",
                border: "1px solid rgba(50,50,50,0.4)",
                overflow: "auto",
            });
        this.paperElement = pimGui.merge(document.createElement("div"), { id: "paper" },
            {
                border: "0px",
                position: "relative",
            });
        this.rootElement.appendChild(this.paperElement);

        this.svgElement = <any>document.createElementNS(this.xmlns, "svg");
        this.paperElement.appendChild(this.svgElement);

        document.body.appendChild(this.rootElement);

        this.registerEventHandlers(true);
        this._updateHandler = updateHandler;

        this.refreshFPS = this.refreshFPS;          // note: we update here, to kick in the event handler

        console.log("The NodeFlow elements on this page are controlled by nodeFlowJS 0.0.23. ©2015 Walrus Graphics.");
    }
}

