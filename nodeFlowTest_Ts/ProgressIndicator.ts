///<reference path="Vector2.ts" />
///<reference path="Rect.ts" />
///<reference path="pim.d.ts" />

class ProgressIndicator {
    private _isVisible: boolean = undefined;
    private _cycle: number = 0;
    private _isBusy: boolean = false;
    private _progress: number = 0;
    private _progressPercentage: number;

    public mainElement: HTMLCanvasElement;
    public radius: number = 0.43;
    public lineWidth: number = 1.5;
    public strokeColor: string = "black";
    public textCenter: Vector2 = new Vector2(.2, .675);
    public busyBlinkSpeed: number = 0.25;

    public get progress() { return this._progress; }
    public set progress(value: number) {
        this._isBusy = false;
        this._progress = Math.max(Math.min(value, 1), 0);
        this.refresh();
    }

    public get isBusy() { return this._isBusy; }
    public set isBusy(value: boolean) {
        this._isBusy = value;
        if (this.isVisible)
            this.refresh();
    }

    public get isVisible() { return this._isVisible; }
    public set isVisible(value: boolean) {
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
    }

    private refresh() {
        var cs = getComputedStyle(this.mainElement);
        var w = parseInt(cs.width);
        var h = parseInt(cs.height);

        if (this.mainElement.width != w)
            this.mainElement.width = w;

        if(this.mainElement.height != h)
            this.mainElement.height = h;

        if (this.isBusy) {
            var ctx = this.mainElement.getContext("2d");
            this._cycle += this.busyBlinkSpeed;
            var c = Math.floor((Math.sin(this._cycle) + 1) * 127);
            ctx.fillStyle = "rgb(" + c + "," + c + "," + c + ")";
            ctx.fillRect(4, 4, w - 8, h - 8);
            ctx.strokeRect(2, 2, w - 4, h - 4);
        }
        else {
            var percentage = Math.floor(this._progress * 100);
            if (this._progressPercentage == percentage)
                return;
            this._progressPercentage = percentage;
            var startAngle = -Math.PI / 2;
            var endAngle = startAngle + Math.PI * this._progressPercentage / 50;
            var ctx = this.mainElement.getContext("2d");
            ctx.fillStyle = cs.backgroundColor;
            ctx.fillRect(0,0,w,h);
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
    }

    public cleanup() {
        this.mainElement = null;
    }

    constructor() {
        this.mainElement = pimGui.merge(document.createElement("canvas"), { className: "ProgressIndicatorCanvas" });
    }
}