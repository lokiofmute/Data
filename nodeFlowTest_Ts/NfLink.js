///<reference path="pim.d.ts" />
///<reference path="Vector2.ts" />
///<reference path="NfConnector.ts" />
var CSOutcode;
(function (CSOutcode) {
    CSOutcode[CSOutcode["INSIDE"] = 0] = "INSIDE";
    CSOutcode[CSOutcode["LEFT"] = 1 << 0] = "LEFT";
    CSOutcode[CSOutcode["RIGHT"] = 1 << 1] = "RIGHT";
    CSOutcode[CSOutcode["BOTTOM"] = 1 << 2] = "BOTTOM";
    CSOutcode[CSOutcode["TOP"] = 1 << 3] = "TOP";
})(CSOutcode || (CSOutcode = {}));

var SvgPathAbstraction = (function () {
    function SvgPathAbstraction(element, nodeFlow, updateFunc) {
        this.element = element;
        this.nodeFlow = nodeFlow;
        this.updateFunc = updateFunc;
        this._nCachedHitDetectionPoints = 20;
        this.controlPoints = [];
        this.updatePath();
    }
    Object.defineProperty(SvgPathAbstraction.prototype, "className", {
        set: function (value) {
            this.element.setAttribute("class", value);
        },
        enumerable: true,
        configurable: true
    });

    SvgPathAbstraction.prototype.toString = function (maxControlPointIndex) {
        if (typeof maxControlPointIndex === "undefined") { maxControlPointIndex = -1; }
        var result = "";
        var count = (maxControlPointIndex < 0) ? this.controlPoints.length : Math.min(maxControlPointIndex, this.controlPoints.length);
        for (var t = 0; t < count; t++)
            result += this.controlPoints[t] + " ";
        return result;
    };

    SvgPathAbstraction.prototype.updatePath = function () {
        this.element.setAttributeNS(null, 'd', this.toString());
    };

    Object.defineProperty(SvgPathAbstraction.prototype, "A", {
        // direct access to the individual controlpoints by name
        get: function () {
            return new Vector2(this.controlPoints[1], this.controlPoints[2]);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SvgPathAbstraction.prototype, "At", {
        get: function () {
            return new Vector2(this.controlPoints[4], this.controlPoints[5]);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SvgPathAbstraction.prototype, "B", {
        get: function () {
            return new Vector2(this.controlPoints[8], this.controlPoints[9]);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SvgPathAbstraction.prototype, "Bt", {
        get: function () {
            return new Vector2(this.controlPoints[6], this.controlPoints[7]);
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(SvgPathAbstraction.prototype, "allControlPointVectors", {
        // a simple array of all controlpoints
        get: function () {
            return [this.A, this.At, this.B, this.Bt];
        },
        enumerable: true,
        configurable: true
    });

    // a simple hash of all controlpoints
    SvgPathAbstraction.prototype.hash = function (a) {
        return (a * 2654435761) % (2 ^ 32);
    };
    SvgPathAbstraction.prototype.hashV = function (a) {
        return this.hash(a.x) + this.hash(a.y);
    };
    Object.defineProperty(SvgPathAbstraction.prototype, "controlPointsHash", {
        get: function () {
            var acp = this.allControlPointVectors;
            var hash = 0;
            for (var v in acp)
                hash += this.hashV(acp[v]);
            return hash;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(SvgPathAbstraction.prototype, "boundingBox", {
        get: function () {
            var allCPV = this.allControlPointVectors;
            var len = allCPV.length;
            var bbox = new Rect(Number.MAX_VALUE, Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
            for (var c = 0; c < len; c++) {
                var pt = allCPV[c];
                if (pt.x < bbox.x)
                    bbox.x = pt.x;
                if (pt.x > bbox.width)
                    bbox.width = pt.x;
                if (pt.y < bbox.y)
                    bbox.y = pt.y;
                if (pt.y > bbox.height)
                    bbox.height = pt.y;
            }
            bbox.width -= bbox.x;
            bbox.height -= bbox.y;
            return bbox;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(SvgPathAbstraction.prototype, "cachedHitDetectionPoints", {
        get: function () {
            var newHash = this.controlPointsHash;
            if (!this._hitDetectionPoints || newHash != this._hitDetectionPointsControlPointsHash) {
                //console.log("cpomputed hash for link " + this.toString());
                this._hitDetectionPointsControlPointsHash = newHash;

                if (!this._hitDetectionPoints || this._hitDetectionPoints.length != this._nCachedHitDetectionPoints)
                    this._hitDetectionPoints = new Array(this._nCachedHitDetectionPoints);

                var curveTotalLength = parseFloat(this.element.getTotalLength());
                for (var t = 0; t < this._nCachedHitDetectionPoints; t++)
                    this._hitDetectionPoints[t] = this.element.getPointAtLength(curveTotalLength * t / this._nCachedHitDetectionPoints);
            }
            return this._hitDetectionPoints;
        },
        enumerable: true,
        configurable: true
    });

    // calculate the Cohen-Sutherland outcode, see http://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm
    SvgPathAbstraction.prototype.calculateOutCode = function (rect, v) {
        var code = 0 /* INSIDE */;
        if (v.x < rect.left)
            code |= CSOutcode.LEFT;
        else if (v.x > rect.right)
            code |= CSOutcode.RIGHT;
        if (v.y < rect.top)
            code |= CSOutcode.TOP;
        else if (v.y > rect.bottom)
            code |= CSOutcode.BOTTOM;
        return code;
    };

    SvgPathAbstraction.prototype.isBBoxHitByRect = function (rect) {
        if (!this.controlPoints)
            return false;
        var bbox = this.boundingBox;
        if (Rect.intersectsWith(bbox, rect))
            return true;
        return false;
    };

    //private isPtInRectRecursive(cachedPoints: Vector2[], rect: Rect, index: number, ourRange:Vector2, otherRange?:Vector2): boolean {
    //    if (Rect.pointInRect(rect, cachedPoints[index]))
    //        return true;
    //    if (!otherRange) {
    //        if (this.isPtInRectRecursive(cachedPoints, rect, Math.floor((ourRange.x + ourRange.y) / 2))
    //    }
    //    return false;
    //}
    SvgPathAbstraction.prototype.isSplineSampledPointsHitByRect = function (rect, result) {
         {
            var cachedPoints = this.cachedHitDetectionPoints;
            var pt;
            for (var t = 0; t < this._nCachedHitDetectionPoints; t++) {
                if (Rect.pointInRect(rect, pt = cachedPoints[t])) {
                    if (result) {
                        result.x = pt.x;
                        result.y = pt.y;
                    }
                    return true;
                }
            }
        }
        return false;
    };

    SvgPathAbstraction.prototype.isSplineHitByRect = function (rect, result) {
        var cachedPoints = this.cachedHitDetectionPoints;
        var previousPoint;
        var previousOutCode;
        var currentOutCode;
        for (var t = 0; t < this._nCachedHitDetectionPoints; t++) {
            var currentPoint = cachedPoints[t];
            currentOutCode = this.calculateOutCode(rect, currentPoint);
            if (previousPoint) {
                var accept = false;
                var outcode0 = previousOutCode;
                var outcode1 = currentOutCode;
                var x0 = previousPoint.x;
                var y0 = previousPoint.y;
                var x1 = currentPoint.x;
                var y1 = currentPoint.y;
                while (true) {
                    if (!(outcode0 | outcode1)) {
                        accept = true;
                        break;
                    } else if (outcode0 & outcode1) {
                        break;
                    } else {
                        // failed both tests, so calculate the line segment to clip from an outside point to an intersection with clip edge
                        var x, y;

                        // At least one endpoint is outside the clip rectangle; pick it.
                        var outcodeOut = outcode0 ? outcode0 : outcode1;

                        // Now find the intersection point; use formulas y = y0 + slope * (x - x0), x = x0 + (1 / slope) * (y - y0)
                        if (outcodeOut & CSOutcode.BOTTOM) {
                            x = x0 + (x1 - x0) * (rect.bottom - y0) / (y1 - y0);
                            y = rect.bottom;
                        } else if (outcodeOut & CSOutcode.TOP) {
                            x = x0 + (x1 - x0) * (rect.top - y0) / (y1 - y0);
                            y = rect.top;
                        } else if (outcodeOut & CSOutcode.RIGHT) {
                            y = y0 + (y1 - y0) * (rect.right - x0) / (x1 - x0);
                            x = rect.right;
                        } else if (outcodeOut & CSOutcode.LEFT) {
                            y = y0 + (y1 - y0) * (rect.left - x0) / (x1 - x0);
                            x = rect.left;
                        }

                        // Now we move outside point to intersection point to clip and get ready for next pass.
                        if (outcodeOut == outcode0) {
                            x0 = x;
                            y0 = y;
                            outcode0 = this.calculateOutCode(rect, new Vector2(x0, y0));
                        } else {
                            x1 = x;
                            y1 = y;
                            outcode1 = this.calculateOutCode(rect, new Vector2(x1, y1));
                        }
                    }
                }
                if (accept) {
                    if (result && result.length >= 2) {
                        result[0] = new Vector2(x0, y0);
                        result[1] = new Vector2(x1, y1);
                    }
                    return true;
                }
            }
            previousOutCode = currentOutCode;
            previousPoint = currentPoint;
        }

        return false;
    };

    // main entry point for hit detection.. will cascade over (boundingBox -> sampledPoints -> sampledLines) hit detection for optimal performance
    SvgPathAbstraction.prototype.isHitByRect = function (rect) {
        return (this.isBBoxHitByRect(rect) && (this.isSplineSampledPointsHitByRect(rect) || this.isSplineHitByRect(rect)));
    };

    SvgPathAbstraction.prototype.cleanup = function () {
        if (this.element) {
            this.nodeFlow.svgElement.removeChild(this.element);
            this.element = null;
        }
        this.updateFunc = null;
        this.controlPoints = null;
    };
    return SvgPathAbstraction;
})();

var NfLinkCaps;
(function (NfLinkCaps) {
    NfLinkCaps[NfLinkCaps["hasBezier"] = 0] = "hasBezier";
    NfLinkCaps[NfLinkCaps["hasArrow"] = 1 << 1] = "hasArrow";

    // the default caps combination
    NfLinkCaps[NfLinkCaps["defaultCaps"] = NfLinkCaps.hasBezier | NfLinkCaps.hasArrow] = "defaultCaps";
})(NfLinkCaps || (NfLinkCaps = {}));

var NfLink = (function () {
    function NfLink(connectorA, connectorB, caps) {
        if (typeof caps === "undefined") { caps = NfLinkCaps.defaultCaps; }
        this.nodeFlow = (connectorA && connectorA.node && connectorA.node.nodeFlow) || (connectorB && connectorB.node && connectorB.node.nodeFlow);
        this._paper = this.nodeFlow.svgElement;
        this.connectorA = connectorA;
        this.connectorB = connectorB;
        this.caps = caps;
        this.canDelete = (connectorA && connectorB && !!connectorA.node && !!connectorB.node);
    }
    Object.defineProperty(NfLink.prototype, "connectorA", {
        //#endregion
        //#region Properties
        get: function () {
            return this._connectorA;
        },
        set: function (value) {
            if (this._connectorA == value)
                return;
            if (this._connectorA) {
                this._connectorA.removeLink(this);
                if (this._connectorA.node)
                    this._connectorA.node.resetInvalid(this._connectorA.node.connectors.indexOf(this._connectorA));
            }
            this._connectorA = value;
            if (this._connectorA)
                this._connectorA.addLink(this);
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfLink.prototype, "connectorB", {
        get: function () {
            return this._connectorB;
        },
        set: function (value) {
            if (this._connectorB == value)
                return;
            if (this._connectorB) {
                this._connectorB.removeLink(this);
                if (this._connectorB.node)
                    this._connectorB.node.resetInvalid(this._connectorB.node.connectors.indexOf(this._connectorB));
            }
            this._connectorB = value;
            if (this._connectorB)
                this._connectorB.addLink(this);
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfLink.prototype, "isMarkedForDeletion", {
        get: function () {
            return this._isMarkedForDeletion;
        },
        set: function (value) {
            if (this._isMarkedForDeletion == value)
                return;
            this._isMarkedForDeletion = value;
            this._curve.className = this._isMarkedForDeletion ? NfLink.curveClassNameMarkedForDeletion : NfLink.curveClassName;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfLink.prototype, "caps", {
        // the capabilities of the link
        get: function () {
            return this._caps;
        },
        set: function (value) {
            var _this = this;
            if (this._caps === value)
                return;

            this._caps = value;
            this.clearElements();

            var path = document.createElementNS(this.nodeFlow.xmlns, "path");
            this._paper.appendChild(path);

            this._curve = new SvgPathAbstraction(path, this.nodeFlow, function (element) {
                return _this.updateCurve(element);
            });
            this._curve.className = NfLink.curveClassName;

            this.canDelete = this._canDelete;
            this.update();
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfLink.prototype, "canDelete", {
        get: function () {
            return this._canDelete;
        },
        set: function (value) {
            var _this = this;
            if (this._curve) {
                this._curve.element.onmspointerenter = null;
                this._curve.element.onmspointerleave = null;
                this._curve.element.onmousemove = null;
                this._curve.element.onclick = null;
            }
            this._canDelete = value;
            if (this._curve && this._canDelete) {
                this._curve.element.onmspointerenter = function (e) {
                    return _this.handleMouseEnter(e);
                };
                this._curve.element.onmspointerleave = function (e) {
                    return _this.handleMouseLeave(e);
                };
                this._curve.element.onmousemove = function (e) {
                    return _this.handleMouseMove(e);
                };
                this._curve.element.onmousedown = function (e) {
                    return _this.handleMouseDown(e);
                };
            }
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(NfLink.prototype, "isHighlighted", {
        get: function () {
            return this._isHighlighted;
        },
        set: function (value) {
            if (this._isHighlighted == value)
                return;
            this._isHighlighted = value;
            if (!value)
                this.showConnectorHints(false);
            this._curve.className = this._isHighlighted ? NfLink.curveClassNameHighlight : NfLink.curveClassName;
        },
        enumerable: true,
        configurable: true
    });

    //#endregion
    //#region curve building
    NfLink.prototype.updateCurve = function (element) {
        var midA = (NfConnector.isEndConnectorAccepted && this.connectorA === NfConnector.draggingLooseConnector) ? NfConnector.draggingEndConnector.midPosition : this.connectorA.midPosition;
        var midB = (NfConnector.isEndConnectorAccepted && this.connectorB === NfConnector.draggingLooseConnector) ? NfConnector.draggingEndConnector.midPosition : this.connectorB.midPosition;
        var dist = Math.min(Vector2.mag(Vector2.minus(midA, midB)) * .5, 150);
        var tanA = Vector2.plus(midA, Vector2.mul(dist, this.connectorA.tangent));
        var tanB = Vector2.plus(midB, Vector2.mul(dist, this.connectorB.tangent));

        // update bezier controlpoints
        element.controlPoints = element.controlPoints.slice(0, 10);
        var controlPoints = element.controlPoints;
        controlPoints[0] = "M";
        controlPoints[1] = midA.x;
        controlPoints[2] = midA.y;
        controlPoints[3] = "C";
        controlPoints[4] = tanA.x;
        controlPoints[5] = tanA.y;
        controlPoints[6] = tanB.x;
        controlPoints[7] = tanB.y;
        controlPoints[8] = midB.x;
        controlPoints[9] = midB.y;

        element.updatePath();

        // update arrow controlpoints
        if (this._caps & NfLinkCaps.hasArrow) {
            //var curvePathString = this._curve.toString(10);
            var curveTotalLength = parseFloat(this._curve.element.getTotalLength());

            var pointA = this._curve.element.getPointAtLength(curveTotalLength * (NfLink.arrowNormalizedIntersectionOnBezier - 0.01));
            var pointB = this._curve.element.getPointAtLength(curveTotalLength * (NfLink.arrowNormalizedIntersectionOnBezier + 0.01));

            var delta = (this.connectorA.kind & NfConnectorKind.Output) ? Vector2.minus(pointA, pointB) : Vector2.minus(pointB, pointA);
            var size = Math.max(Math.min(Vector2.mag(delta) * 2, NfLink.maxArrowSize), NfLink.minArrowSize);
            var angle = Math.atan2(delta.y, delta.x);
            var degToRad = Math.PI / 180;

            controlPoints[10] = "M";
            controlPoints[11] = pointA.x;
            controlPoints[12] = pointA.y;
            var index = 13;

            for (var angleSubdivisions = 1; angleSubdivisions < NfLink.angleSubdivisions; angleSubdivisions++) {
                var subDividedAngle = NfLink.arrowAngle * angleSubdivisions * Math.PI / (NfLink.angleSubdivisions * 180);
                var a0 = angle + subDividedAngle;
                var a1 = angle - subDividedAngle;
                controlPoints[index++] = "L";
                controlPoints[index++] = pointA.x + Math.cos(a0) * size;
                controlPoints[index++] = pointA.y + Math.sin(a0) * size;
                controlPoints[index++] = "L";
                controlPoints[index++] = pointA.x + Math.cos(a1) * size;
                controlPoints[index++] = pointA.y + Math.sin(a1) * size;
                controlPoints[index++] = "L";
                controlPoints[index++] = pointA.x;
                controlPoints[index++] = pointA.y;
            }
        }

        element.updatePath();
    };

    //#endregion
    //#region disconnect handling
    NfLink.prototype.handleMouseEnter = function (e) {
        if (NfConnector.draggingLooseConnector)
            return;
        this._isDisconnectCursorVisible = true;
        this._disconnectCursorPosition = this.nodeFlow.getClientMousePosition(e);
        if (this._curve) {
            this._curve.className = NfLink.curveClassNameDelete;
            this._curve.updateFunc(this._curve);
        }
    };

    NfLink.prototype.handleMouseLeave = function (e) {
        if (NfConnector.draggingLooseConnector)
            return;
        this._isDisconnectCursorVisible = false;
        if (this._curve) {
            this._curve.className = NfLink.curveClassName;
            this._curve.updateFunc(this._curve);
        }

        e.stopPropagation();
        e.preventDefault();
    };

    NfLink.prototype.handleMouseMove = function (e) {
        if (NfConnector.draggingLooseConnector)
            return;
        this._disconnectCursorPosition = this.nodeFlow.getClientMousePosition(e);
        if (this._curve) {
            this._curve.className = NfLink.curveClassNameDelete;
            this._curve.updateFunc(this._curve);
        }

        e.stopPropagation();
        e.preventDefault();
    };

    NfLink.prototype.handleMouseDown = function (e) {
        e.stopPropagation();
        e.preventDefault();

        var localMousePosition = this.nodeFlow.getClientMousePosition(e);
        var closestConnector = this.getClosestConnector(localMousePosition);
        if (closestConnector)
            this.startDragging(closestConnector, localMousePosition);
    };

    NfLink.prototype.theOtherConnector = function (connector) {
        if (connector === this.connectorA)
            return this.connectorB;
        else if (connector === this.connectorB)
            return this.connectorA;
        return null;
    };

    NfLink.prototype.startDragging = function (closestConnector, localMousePosition) {
        var startConnector = this.theOtherConnector(closestConnector);
        if (startConnector) {
            this.nodeFlow.removeLink(this);
            startConnector.startDraggingLinks(localMousePosition);
        }
    };

    NfLink.prototype.showConnectorHints = function (value) {
        if (this.connectorA && this.connectorA != NfConnector.draggingLooseConnector) {
            this.connectorA.showConnectorHint(value);
            this.connectorA.connectorHintLabel.className = "connectorHintLabel accepted";
        }
        if (this.connectorB && this.connectorB != NfConnector.draggingLooseConnector) {
            this.connectorB.showConnectorHint(value);
            this.connectorB.connectorHintLabel.className = "connectorHintLabel accepted";
        }
    };

    //#endregion
    NfLink.prototype.getClosestConnector = function (position) {
        if (!this.connectorA || !this.connectorB)
            return null;
        var distSqrA = Vector2.sqrDist(position, this.connectorA.midPosition);
        var distSqrB = Vector2.sqrDist(position, this.connectorB.midPosition);
        return distSqrA < distSqrB ? this.connectorA : this.connectorB;
    };

    NfLink.prototype.makeSvgRect = function (r) {
        var svgRect = this._paper.createSVGRect();
        svgRect.x = r.x;
        svgRect.y = r.y;
        svgRect.width = r.width;
        svgRect.height = r.height;
        return svgRect;
    };

    NfLink.prototype.isCurveHitByRect = function (rect) {
        // here, we need to make a choice: let the browser SVG handle the intersectionchecking,or not?
        // the thing is: In IE11, it works fine with svg.getIntersectionList()
        // on Chrome, it is implemented as a bounding box... sonot complete
        // on Firefox,it is not implemented at all..
        // .. so until further notice, we roll our own
        if (this.nodeFlow.useCustomLinkIntersection) {
            return this._curve.isHitByRect(rect);
        } else if (this._paper.getIntersectionList) {
            // relyon the browser to do svg intersection for collision detection to the incoming rect
            var svgRect = this.makeSvgRect(rect);
            var intersections = this._paper.getIntersectionList(svgRect, this._paper);
            if (!intersections || intersections.length <= 0)
                return false;
            for (var i in intersections) {
                var isect = intersections[i];
                if (isect === this._curve.element)
                    return true;
            }
        }
        return false;
    };

    // make sure the connectors are A==Output, B==Input, if the order is not OK
    NfLink.prototype.normalizeConnectors = function () {
        if ((this._connectorA && !!(this._connectorA.kind & NfConnectorKind.Input)) || (this._connectorB && !!(this._connectorB.kind & NfConnectorKind.Output))) {
            var temp = this._connectorA;
            this._connectorA = this._connectorB;
            this._connectorB = temp;
            //console.log("swapped connectors! A = " + this.connectorA.name + ", B = " + this.connectorB.name);
        }
    };

    NfLink.prototype.clearElements = function () {
        this.canDelete = false;
        if (this._curve) {
            this._curve.cleanup();
            this._curve = null;
        }
    };

    NfLink.prototype.update = function () {
        this._curve.updateFunc(this._curve);
    };

    NfLink.prototype.cleanup = function () {
        this.connectorA = null;
        this.connectorB = null;
        this.nodeFlow = null;
        this.clearElements();
    };
    NfLink.curveClassName = "LinkCurve";
    NfLink.curveClassNameHighlight = "LinkCurve highlight";
    NfLink.curveClassNameMarkedForDeletion = "LinkCurve markedForDeletion";
    NfLink.curveClassNameDelete = "LinkCurve delete";

    NfLink.minArrowSize = 15;
    NfLink.maxArrowSize = 25;
    NfLink.arrowAngle = 20;
    NfLink.angleSubdivisions = 3;
    NfLink.arrowNormalizedIntersectionOnBezier = 0.55;
    return NfLink;
})();
//# sourceMappingURL=NfLink.js.map
