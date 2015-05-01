class TimedCaller {
    private _refreshHandle: number;
    private _intervalFPS: number;
    private _callback: Function;

    public cleanup() {
        clearInterval(this._refreshHandle);
        this._refreshHandle = null;
        this._intervalFPS = null;
        this._callback = null;
    }

    constructor(intervalFPS: number, callback: Function) {
        this._intervalFPS = intervalFPS;
        this._callback = callback;
        this._refreshHandle = setInterval(() => this._callback(), 1000 / Math.max(0.00001, this._intervalFPS));
    }
} 