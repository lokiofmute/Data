// helper class for a little event queue
var EventQueue = (function () {
    function EventQueue() {
        this._eventQueue = [];
    }
    EventQueue.prototype.addEvent = function (ev) {
        this._eventQueue.push(ev);
    };
    EventQueue.prototype.raiseEvent = function () {
        for (var t in this._eventQueue)
            this._eventQueue[t]();
    };
    return EventQueue;
})();

// the ResizeSensor can detect resize changes in a HTMLElement
var ResizeSensor = (function () {
    function ResizeSensor(element, callback, callOnCreation) {
        if (typeof callOnCreation === "undefined") { callOnCreation = true; }
        this.element = element;
        this.callback = callback;
        this._resizeAttachedEventName = "resizedAttached";
        this._resizeSensorName = "resizeSensorName";
        this.attachResizeEvent(element, callback);
        if (callOnCreation)
            callback();
    }
    ResizeSensor.prototype.getComputedStyle = function (element, propertyName) {
        if (element.currentStyle)
            return element.currentStyle[propertyName];
        else if (window.getComputedStyle)
            return window.getComputedStyle(element).getPropertyValue(propertyName);
        else
            return element.style[propertyName];
    };

    ResizeSensor.prototype.attachResizeEvent = function (element, resized) {
        var _this = this;
        if (!element[this._resizeAttachedEventName])
            element[this._resizeAttachedEventName] = new EventQueue();

        if (element[this._resizeAttachedEventName])
            element[this._resizeAttachedEventName].addEvent(resized);

        element[this._resizeSensorName] = document.createElement('div');
        element[this._resizeSensorName].className = 'resize-sensor';
        var style = 'position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: scroll; z-index: -1; visibility: hidden;';
        var styleChild = 'position: absolute; left: 0; top: 0;';

        element[this._resizeSensorName].style.cssText = style;
        element[this._resizeSensorName].innerHTML = '<div class="resize-sensor-expand" style="' + style + '">' + '<div style="' + styleChild + '"></div>' + '</div>' + '<div class="resize-sensor-shrink" style="' + style + '">' + '<div style="' + styleChild + ' width: 200%; height: 200%"></div>' + '</div>';
        element.appendChild(element[this._resizeSensorName]);

        element.style.position = "relative";

        var expand = element[this._resizeSensorName].childNodes[0];
        var expandChild = expand.childNodes[0];
        var shrink = element[this._resizeSensorName].childNodes[1];
        var shrinkChild = shrink.childNodes[0];

        var lastWidth, lastHeight;

        var reset = function () {
            expandChild.style.width = expand.offsetWidth + 10 + 'px';
            expandChild.style.height = expand.offsetHeight + 10 + 'px';
            expand.scrollLeft = expand.scrollWidth;
            expand.scrollTop = expand.scrollHeight;
            shrink.scrollLeft = shrink.scrollWidth;
            shrink.scrollTop = shrink.scrollHeight;
            lastWidth = element.offsetWidth;
            lastHeight = element.offsetHeight;
        };

        reset();

        var changed = function () {
            if (element[_this._resizeAttachedEventName])
                element[_this._resizeAttachedEventName].raiseEvent();
        };

        var addEvent = function (el, name, cb) {
            if (el.attachEvent)
                el.attachEvent("on" + name, cb);
            else
                el.addEventListener(name, cb);
        };

        addEvent(expand, "scroll", function () {
            if (element.offsetWidth > lastWidth || element.offsetHeight > lastHeight)
                changed();
            reset();
        });

        addEvent(shrink, "scroll", function () {
            if (element.offsetWidth < lastWidth || element.offsetHeight < lastHeight)
                changed();
            reset();
        });
    };

    ResizeSensor.prototype.detach = function (element) {
        if (element[this._resizeSensorName]) {
            element.removeChild(element[this._resizeSensorName]);
            delete element[this._resizeSensorName];
            delete element[this._resizeAttachedEventName];
        }
    };
    return ResizeSensor;
})();
//# sourceMappingURL=ResizeSensor.js.map
