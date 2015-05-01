var TimedCaller = (function () {
    function TimedCaller(intervalFPS, callback) {
        var _this = this;
        this._intervalFPS = intervalFPS;
        this._callback = callback;
        this._refreshHandle = setInterval(function () {
            return _this._callback();
        }, 1000 / Math.max(0.00001, this._intervalFPS));
    }
    TimedCaller.prototype.cleanup = function () {
        clearInterval(this._refreshHandle);
        this._refreshHandle = null;
        this._intervalFPS = null;
        this._callback = null;
    };
    return TimedCaller;
})();
//# sourceMappingURL=TimedCaller.js.map
