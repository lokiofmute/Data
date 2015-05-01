// A little 'shake detector' class.. no fancy stuff here, but just some heuristics that seem to work rather well, 'farmer logic' style ;-)
// Create the object, and feed it with coordinates (usually mouse positions of some kind)
// on construction, a callback function is given, which will be called when a full shake is detected.
// The settings define how sensitive the detection will be, and mostly, after how many significant directional changes a shake is reported.
// Roughly, it works by detecting +/- opposite-direction changes in the positions feed, within a certain time span from eachother, with enough speed to be worthwile.
// The detector then counts these direction changes, and triggers your callback when 'full'
var ShakeDetector = (function () {
    function ShakeDetector(callbackOnShake) {
        //#region settings
        this._shakeThreshold = 3;
        this._speedThreshold = 1100;
        this._shakeTimeThresholdInSeconds = 0.1;
        this._angleThreshold = 150 * Math.PI / 180;
        this._directionChangeCounter = 0;
        this._callbackOnShake = callbackOnShake;
        //console.log("shakeDetector started");
    }
    //#endregion
    // feed your sequence of positions into this method
    ShakeDetector.prototype.feedPosition = function (position) {
        var time = new Date().getTime() / 1000;
        if (this._previousPosition != undefined) {
            var deltaPos = Vector2.minus(position, this._previousPosition);
            var velocity = Vector2.mag(Vector2.div(deltaPos, time - this._lastTime));

            //console.log("velocity = " + velocity);
            if (velocity >= this._speedThreshold) {
                var angle = Math.atan2(deltaPos.y, deltaPos.x);
                if (this._previousAngle != undefined) {
                    var deltaAngle = Math.abs(angle - this._previousAngle);

                    //console.log("deltaAngle = " + (deltaAngle * 180 / Math.PI));
                    if (deltaAngle >= this._angleThreshold) {
                        // if the direction change does not happen quickly enough since last detection, it doesn't count to build up the shake, and the counter is reset... you have to move faster or make your movement shorter, dear user!
                        var deltaTime = time - this._lastDirectionChangeTime;
                        if (deltaTime < this._shakeTimeThresholdInSeconds) {
                            this._directionChangeCounter++;

                            //console.log("direction change : " + this._directionChangeCounter);
                            if (this._directionChangeCounter > this._shakeThreshold) {
                                //console.log("Shaken!");
                                this.raiseCallbackOnShake();
                                return;
                            }
                        } else {
                            this._directionChangeCounter = 0;
                            //console.log("direction change reset!");
                        }
                        this._lastDirectionChangeTime = time;
                    }
                }
                this._previousAngle = angle;
            }
        } else
            this._lastDirectionChangeTime = new Date().getTime() / 1000;
        this._previousPosition = position;
        this._lastTime = time;
    };

    // helper method to raise the callback
    ShakeDetector.prototype.raiseCallbackOnShake = function () {
        if (this._callbackOnShake)
            this._callbackOnShake();
        this._directionChangeCounter = 0; // reset for next run, if any
    };

    // call this on destruction
    ShakeDetector.prototype.cleanup = function () {
        this._callbackOnShake = null;
        //console.log("shakeDetector cleanup");
    };
    return ShakeDetector;
})();
//# sourceMappingURL=ShakeDetector.js.map
