
// helper class for a little event queue
class EventQueue {
    private _eventQueue = [];
    private addEvent(ev: any) {this._eventQueue.push(ev);}
    private raiseEvent() {for (var t in this._eventQueue)this._eventQueue[t]();}
}

// the ResizeSensor can detect resize changes in a HTMLElement
class ResizeSensor {
    private _resizeAttachedEventName = "resizedAttached";
    private _resizeSensorName = "resizeSensorName";

    private getComputedStyle(element: HTMLElement, propertyName: string) {
        if (element.currentStyle)
            return element.currentStyle[propertyName];
        else if (window.getComputedStyle)
            return window.getComputedStyle(element).getPropertyValue(propertyName);
        else
            return element.style[propertyName];
    }

    private attachResizeEvent(element: HTMLElement, resized: Function) {
        if (!element[this._resizeAttachedEventName])
            element[this._resizeAttachedEventName] = new EventQueue();

        if (element[this._resizeAttachedEventName])
            element[this._resizeAttachedEventName].addEvent(resized);

        element[this._resizeSensorName] = document.createElement('div');
        element[this._resizeSensorName].className = 'resize-sensor';
        var style = 'position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: scroll; z-index: -1; visibility: hidden;';
        var styleChild = 'position: absolute; left: 0; top: 0;';

        element[this._resizeSensorName].style.cssText = style;
        element[this._resizeSensorName].innerHTML =
        '<div class="resize-sensor-expand" style="' + style + '">' +
        '<div style="' + styleChild + '"></div>' +
        '</div>' +
        '<div class="resize-sensor-shrink" style="' + style + '">' +
        '<div style="' + styleChild + ' width: 200%; height: 200%"></div>' +
        '</div>';
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

        var changed = () => {
            if (element[this._resizeAttachedEventName])
                element[this._resizeAttachedEventName].raiseEvent();
        };

        var addEvent = (el:any, name:String, cb:any) => {
            if (el.attachEvent)
                el.attachEvent("on" + name, cb);
            else
                el.addEventListener(name, cb);
        };

        addEvent(expand, "scroll", () => {
            if (element.offsetWidth > lastWidth || element.offsetHeight > lastHeight) 
                changed();
            reset();
        });

        addEvent(shrink, "scroll", () => {
            if (element.offsetWidth < lastWidth || element.offsetHeight < lastHeight)
                changed();
            reset();
        });
    }

    public detach(element: HTMLElement) {
        if (element[this._resizeSensorName]) {
            element.removeChild(element[this._resizeSensorName]);
            delete element[this._resizeSensorName];
            delete element[this._resizeAttachedEventName];
        }
    }

    constructor(public element: HTMLElement, public callback: Function, callOnCreation:boolean=true) {
        this.attachResizeEvent(element, callback);
        if (callOnCreation)
            callback();
    }
}