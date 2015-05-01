///<reference path="NodeFlow.ts" />
// base class to provide mouse capturing for onMouseMove in NodeFlow environment
var NfMouseCaptureElement = (function () {
    function NfMouseCaptureElement() {
    }
    Object.defineProperty(NfMouseCaptureElement.prototype, "isMouseCaptured", {
        //#endregion
        //#region Properties
        get: function () {
            return this.nodeFlow && this.nodeFlow.mouseCaptureElement === this;
        },
        set: function (value) {
            if (this.nodeFlow)
                this.nodeFlow.mouseCaptureElement = value ? this : null;
        },
        enumerable: true,
        configurable: true
    });

    //#endregion
    // override this method to handle mousedown with mouseCapture abilities
    NfMouseCaptureElement.prototype.handleMouseDown = function (e) {
        // console.log("Handling mouseDown for " + this);
    };

    // override this method to handle mousemove with mouseCapture abilities
    NfMouseCaptureElement.prototype.handleMouseMove = function (e) {
        // console.log("Handling mouseMove for " + this);
    };

    // override this method to handle mouseup with mouseCapture abilities
    NfMouseCaptureElement.prototype.handleMouseUp = function (e) {
        // console.log("Handling mouseUp for " + this);
    };
    return NfMouseCaptureElement;
})();
//# sourceMappingURL=NfMouseCaptureElement.js.map
