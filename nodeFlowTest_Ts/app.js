// early context so we can have scoped nodes.
var myDir = new pimDirector({ showLoader: false, antialias: true }), nodeFlow, pWidth = 1280, pHeight = 720, globalTime = 0, globalfps = 25, isPlaying = false, generatorNodesBar, skrim, buffersUsed = 0, sceneButton;

// shorthand.
var m = pimGui.merge;

// helpers for glsl nodes.
function glslNode(name, source, args, options, db, chan2) {
    if (!options) options = {}; options.sink = function (node) { return pimGui.pimCheck('show on preview', function (onoff) { node.sink = onoff; nodeFlow._updateTopology(); }); };
    source = source.replace('void main', (args || []).map(function (x) {
        return "uniform float " + x + ";";
    }).join('\n') + '\nvoid main');
    return pimGui.merge(eval([
        "(function " + name + "(" + (chan2 ? ["img", "img2"] : ["img"]).concat(args || []).join(',') + ") {",
        "  if (this.isPassThrough) return img;",
        "  if (!img) return; var o=this.options;",
        "  if (o.ctx == undefined || o.ctx.width != (pWidth||img.width||img.videoWidth) || o.ctx.height != (pHeight||img.height||img.videoHeight)) {",
        "    if (o.ctx) this.delete(); var width=pWidth||img.width||img.videoWidth,height=pHeight||img.height||img.videoHeight;",
        (!db) ? "o.ctx = myDir.scene.createOffScreen(myDir.gl, width, height); buffersUsed++;" : "o.ctx = myDir.scene.createOffScreen(myDir.gl, width, height);o.ctx2 = myDir.scene.createOffScreen(myDir.gl, width, height);buffersUsed+=2;",
        "    this.delete=function(o){o.ctx.delete(); buffersUsed--; if (!o.ctx2) return; o.ctx2.delete(); buffersUsed--; }.bind(this,o);",
        "    o.ctx.quad = pimStream.quad([-1, -1, 0.0], [1, 1, 0.0]);",
        (!(db || chan2)) ? "pimGui.merge(o.ctx.quad.surfaces[0],{doublesided:true,luminosity:1,diffuse:0,channels:[{ enabled: true, type: 'COLR', opacity: 0, texunit: 0, map:img}],fragmentShaderSource:'" + source.replace(/\n/g, '\\\n') + "'});" : "pimGui.merge(o.ctx.quad.surfaces[0],{doublesided:true,luminosity:1,diffuse:0,channels:[{enabled:true,type:'COLR',texunit:0,map:img},{enabled:true,type:'COLR',texunit:0,map:img}],fragmentShaderSource:'" + source.replace(/\n/g, '\\\n') + "'});",
        "  }; if (img.onlyLoad===true) return;",
        (args || []).map(function (a, i) {
            return "  o.ctx.quad.surfaces[0].pimShaderExt." + a + "=this.floatParam(" + i + "," + a + ",this.options." + a + ")";
        }).join('\n') || '',
        "  if (!o.ctx.quad.loaded) pimObjectInstance.prototype.driverLoad.call({ obj: o.ctx.quad, bones: [] }, myDir.gl, undefined, { lights: [] });",
        "  if (o.count==undefined) o.count=0; else o.count++;",
        (!db) ? "var dest=o.ctx;" : "var dest=(o.count%2)?o.ctx:o.ctx2, src=(o.count%2)?o.ctx2:o.ctx;",
        "  dest.bind();",
        (!(db || chan2)) ? "o.ctx.quad.surfaces[0].channels[0].map = img;" : "o.ctx.quad.surfaces[0].channels[0].map = img;o.ctx.quad.surfaces[0].channels[1].map = " + (chan2 ? "img2" : "src;"),
        "  myDir.gl.viewport(0, 0, pWidth || img.width || img.videoWidth, pHeight || img.videoHeight || img.height);",
        "  myDir.gl.scissor(0, 0, pWidth || img.videoWidth || img.width, pHeight || img.videoHeight || img.height);",
        "  var m = mat4.identity();",
        "  pimObjectInstance.prototype.driverRenderSurface.call({inst: { selected: 0, evaluateMatrix: function (x) { return x; }.bind(this, m) }, obj: o.ctx.quad, loaded: 1,camPos: [0, 0, 0]}, myDir.gl, m, m, [], o.ctx.quad, o.ctx.quad.surfaces[0], 0, false);",
        "  dest.unbind(false);",
        "  return dest;",
        "})"].join('\n')), { options: options || {} });
}
function pixelNode(name, code, args, options, db, chan2) {
    return glslNode(name, '\nprecision mediump float;\nvarying vec2 texcoord0;\nuniform sampler2D pim_texture0;\nuniform sampler2D pim_texture1;\nvoid main() {\n' + code + '}', args, options, db, chan2);
}

// saveas helper
function toBlob(dataURL) {
    var BASE64_MARKER = ';base64,';
    if (dataURL.indexOf(BASE64_MARKER) == -1) {
        var parts = dataURL.split(',');
        var contentType = parts[0].split(':')[1];
        var raw = decodeURIComponent(parts[1]);

        return new Blob([raw], { type: contentType });
    }
    var parts = dataURL.split(BASE64_MARKER);
    var contentType = parts[0].split(':')[1];
    var raw = window.atob(parts[1]);
    var rawLength = raw.length;

    var uInt8Array = new Uint8Array(rawLength);

    for (var i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
}

// given an input pin, and an edit control, figure out the input value to use and return as given type.
// given an input pin, and an edit control, figure out the input value to use and return as given type.
NfNode.prototype["floatParam"] = function (pin, value, edit, def) {
    if (value == undefined) value = (edit.value && parseFloat(edit.value)) || (edit.value == '' && (def || 0.0));
    else if (typeof value != 'number') return this.makeInvalid(pin, 'Needs number'), def || 0;
    else { edit.value = value; this.resetInvalid(pin); }
    return value;
};
NfNode.prototype["anyParam"] = function (pin, value, edit, def) {
    if (value == undefined) value = (edit.value && parseFloat(edit.value)) || edit.value || (edit.value == '' && (def || 0.0));
    else if (typeof value != 'number' && typeof value != 'string' && typeof value != 'boolean') this.makeInvalid(pin, 'Needs number or string or boolean');
    else { edit.value = value; this.resetInvalid(pin); }
    return value;
};

// default regex augmented input boxes.
function numEdit(name, def) { return pimGui.pimEdit.bind(pimGui, (def == undefined) ? '' : def, undefined, name || 'number', /^$|^[0-9\-\+\.]*$/); };
function anyEdit(name, def) { return pimGui.pimEdit.bind(pimGui, (def == undefined) ? '' : def, undefined, name || 'number/text', /.*/); };

function secondsToTimeCode(seconds, fps) {
    var hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    var minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    var s = Math.floor(seconds);
    seconds -= s;
    if (fps == undefined)
        fps = globalfps;
    var frames = Math.floor(seconds * fps).toString();
    var t = fps.toString().length - frames.length;
    while (--t >= 0)
        frames = '0' + frames;
    return hours + ':' + minutes + ':' + s + "." + frames;
}

function detectInternetExplorer() { return !(window.ActiveXObject) && "ActiveXObject" in window; }

var generatorNodes = [
    m(function number() { return parseFloat(this.options.value.value) || 0.0; }, { options: { caps: 77, width:130, value: numEdit()} }),
    detectInternetExplorer() ? {} : m(function sound() {
        if (!this.options.data) return [0,0,0,0];
        var out = [0, 0, 0, 0], g = this.options.graph, y = g.lasty = ((g.lasty || 0) + 1) % g.height, dt = new Uint32Array(g.data.data.buffer);
        this.options.analyser.getByteFrequencyData(this.options.data);
        for (var i = 0; i < this.options.analyser.frequencyBinCount; i++) this.options.data[i] = this.options.data[i] * this.options.data[i] / 256;
        for (var d, i = 0; d = this.options.data[i] | 0, i < Math.min(255, this.options.analyser.frequencyBinCount) ; i++) dt[y * 256 + i] = 255 * 0x1000000 + d * 0x10000 + d * 0x100 + d;
        g.ctx.putImageData(g.data, 0, -y, 0, y + 1, 256, 128 - y);
        g.ctx.putImageData(g.data, 0, 128 - y, 0, 0, 256, y);
        var bins = [[1, 3], [100, 100], [200, 100], [300, 200]];
        bins.forEach(function (bin, i) { out[i] = 0; for (var j = 0; j < bin[1]; j++) out[i] += this.options.data[j + bin[0]] / (256 * bin[1]); }.bind(this));
        this.options.s1.style.width = out[0] * 100 + '%';
        this.options.s2.style.width = out[1] * 100 + '%';
        this.options.s3.style.width = out[2] * 100 + '%';
        this.options.s4.style.width = out[3] * 100 + '%';
        return out;
    }, {
        output: ['a0', 'a1', 'a2', 'a3'], options: {
            caps: 77,
            analyser: myDir.audio.createAnalyser(),
            s1: function () { return pimGui.merge(document.createElement('div'), {}, { background: '#000', minHeight: '10px', width: '0%' }); },
            s2: function () { return pimGui.merge(document.createElement('div'), {}, { background: '#000', minHeight: '10px', width: '0%' }); },
            s3: function () { return pimGui.merge(document.createElement('div'), {}, { background: '#000', minHeight: '10px', width: '0%' }); },
            s4: function () { return pimGui.merge(document.createElement('div'), {}, { background: '#000', minHeight: '10px', width: '0%' }); },
            width: 256,
            height: 160 + 60,
            graph: function () { var c; return pimGui.merge(c = document.createElement('canvas'), { width: 256, height: 128, ctx: c = c.getContext('2d'), data: c.createImageData(256, 128) }, { backgroundColor: 'black' }); },
            play: function (node) {
                return pimGui.pimHGroup(pimGui.pimButton('play', function () {
                    var no = node.options;
                    if (no.data) return;
                    no.sound = myDir.audio.createBufferSource();
                    pimGui.merge(no.analyser, { fftSize: 2048, smoothingTimeConstant: 0 });
                    pimGui.merge(no.sound, { buffer: node.options.bufferSource, loop: 1 });
                    no.sound.connect(no.analyser);
                    no.analyser.connect(myDir.audio.destination);
                    no.sound.start(0);
                    no.data = new Uint8Array(no.analyser.frequencyBinCount);
                }), pimGui.pimButton('stop', function () {
                    node.options.sound.stop(0);
                    node.options.data = undefined;
                }));
            }
        }
    }),
    m(function text() { return this.options.value.value || ''; }, { options: { caps: 77, width: 200, value: anyEdit() } }),
    m(function bool(a) { return !!a || this.options.isOn; }, { options: { caps: 77, width: 100, isOn: false, a: function (node) { return pimGui.pimCheck('on/off', function (e) { node.options.isOn = e; }); } } }),
];

var generalNodes = [
    m(function settings() { }, {
        output: [],
        options:
            {
                caps: 9,        // NfNodeCaps.hasCloseButton | NfNodeCaps.hasMaximizeButton  (but nothing else)
                width: 200,
                height: 150,
                tabs: function(node) { var a,b,c,d,res=pimGui.pimTabs(['Nodeflow','Project'],[
                  pimGui.vflex(
                    pimGui.pimSlider('Spline Bulge',function(x){node.nodeFlow.splineBulge=x*node.nodeFlow.maximumSplineBulge}),
                    pimGui.pimSlider('Connector fanOut',function(x){node.nodeFlow.connectorFanout=x;}),
                    a=pimGui.pimCheck('Use splines for links', function (x) { node.nodeFlow.useSplines = x | 0; }),
                    b=pimGui.pimCheck('Use shake disconnect', function (x) { node.nodeFlow.useShakeDisconnect = !!x; }),
                    c=pimGui.pimCheck('Use auto panning', function (x) { node.nodeFlow.useAutoPan = !!x; })
                  ),
                  pimGui.vflex(
                    pimGui.pimEdit(pWidth == 1280 ? '' : pWidth, function (x) { pWidth = parseInt(this.value) || 1280; myDir.scene.byName('cube1').inst.zs = 4.6 * pWidth / pHeight; myDir.scene.byName('cube1').inst.changed = 1; }, 'project width [1280]'),
                    pimGui.pimEdit(pHeight == 720 ? '' : pHeight, function (x) { pHeight = parseInt(this.value) || 720; myDir.scene.byName('cube1').inst.zs = 4.6 * pWidth / pHeight; myDir.scene.byName('cube1').inst.changed = 1; }, 'project height [720]'),
                    pimGui.pimEdit(globalfps == 25 ? '' : globalfps, function (x) { globalfps = this.value && parseInt(this.value) || 25; }, 'Time FPS [25]', /^$|^[0-9\-\+\.]*$/)
                  )
                ],function(){}); 
                a.firstChild.checked=node.nodeFlow.useSplines|0; 
                b.firstChild.checked=node.nodeFlow.useShakeDisconnect; 
                c.firstChild.checked=node.nodeFlow.useAutoPan; 
                res.firstChild.style.borderBottom='1px solid black'; 
                res.style.marginTop='3px'; 
                return res;
                },
            }
    }),
    m(function show(a) { return this.options.value.innerHTML = a; }, { options: { caps:73, value: pimGui.pimLabel.bind(pimGui, ' ', undefined) } }),
    m(function time() { myDir.running = 0; this.options.value.innerHTML = 'TC [' + secondsToTimeCode(globalTime, globalfps) + '] (' + globalTime.toFixed(3) + 's @ ' + globalfps + 'fps)'; return globalTime; },
        { options: { caps: 77, width: 220, value: function (node) { return pimGui.pimLabel(''); } } }),
    m(function fps() { return this.options.value.innerHTML = '<SPAN STYLE="font-size:30px">' + myDir.scene.fps + '</SPAN><SMALL STYLE="font-size:14px">fps<BR>Buffers:' + buffersUsed + '<BR>' + (buffersUsed * pWidth * pHeight * 4 * myDir.scene.fps / 1024 / 1024 / 1024).toFixed(1) + 'Gb/s</SMALL>'; }, { options: { caps: 73, width: 100, height: 110, value: pimGui.pimLabel.bind(pimGui, ' ', undefined) } }),
        m(function ticker(offset, stepSize, modulo) {
            var o = this.options;
            if (this.options.isrunning) o.value = (o.value + this.floatParam(1, stepSize, o.stepSize, 1.0));
            o.value = o.value % this.floatParam(2, modulo, o.modulo, o.value + 1);
            return this.floatParam(0, offset, o.offset) + o.value;
        }, { options: { caps:73, value: 0, isrunning: false, offset: numEdit('offset'), stepSize: numEdit('step size'), modulo: numEdit('modulo'), reset: function (node) { node.height += 25; return pimGui.pimButton('reset', function () { node.options.value = 0; }); }, running: function (node) { node.height += 25; return pimGui.pimCheck('running', function (e) { node.options.isrunning = e; }); } } }),
    m(function autoScale(a, frames, smooth) {
        var o = this.options, x, v = o.values;
        v.push(x = this.floatParam(0, a, o.a, 0.0));
        while (v.length > this.floatParam(1, frames, o.frames, 20)) v.shift();
        var min = Math.min.apply(Math, v), max = Math.max.apply(Math, v), smooth = this.floatParam(2, smooth, o.smooth, 0.4);
        return o.preview.style.width = (o.lastval = o.lastval * smooth + (1 - smooth) * (x - min) / ((max - min) || 1)) * 100 + 'px', o.lastval;
    }, { options: { caps: 9, lastval: 0, values: [], a: numEdit('input'), frames: numEdit('#frames history [20]'), smooth: numEdit('smoothing [0.4]'), preview: function (n) { n.height += 20; return m(document.createElement('div'), {}, { width: '0px', height: '20px', backgroundColor: 'black' }); } } }),
    m(function graph(x) {
        var g = this.options.graph;
        if (g.lastx == undefined) g.lastx = 0;
        var z = (255 - (g.lastx++ % g.width));
        for (var i = 0, j; j = (127 - i) * 1024 + z * 4, i < 128; i++) { g.data.data[j] = (i >= Math.floor((x || 0) * 128)) ? 0 : 255; g.data.data[j + 3] = 255; }
        return g.ctx.putImageData(g.data, -z, 0, z, 0, 256 - z, 128), g.ctx.putImageData(g.data, 256 - z, 0, 0, 0, z, 128), x;
    }, { options: { caps: 77, graph: function (node) { m(node, { width: 256, height: 160 }); var c; return m(c = document.createElement('canvas'), { width: 256, height: 128, ctx: c = c.getContext('2d'), data: c.createImageData(256, 128) }, { backgroundColor: '#000' }); } } }),
    m(function spline(x) {
        return (x == undefined) ? this.options.spline.th.splines[0] : (this.options.spline.setTime(x), this.options.spline.th.splines[0].evaluate(x));
    }, { options: { spline: function (node) { node.rescale = function () { node.options.spline.th.redraw() }; m(node, { width: 300, height: 300 }); var res = m(pimGui.pimSpliner(function () { }), {}, { minHeight: '280px', width: '100%', height: '100%' }); setTimeout(function () { res.addSpline(new pimSpline().addKey(0, 0)); }, 0); return res; } } })
];

var scalarNodes = [
    m(function math(a, b) {
        o = this.options.o;
        if (o<8) {
          a = this.floatParam(0, a, this.options.a, (o >= 2) ? 1 : 0);
          b = this.floatParam(1, b, this.options.b, (o >= 2) ? 1 : 0);
        } else {
          a = this.anyParam(0, a, this.options.a, (o >= 2) ? 1 : 0);
          b = this.anyParam(1, b, this.options.b, (o >= 2) ? 1 : 0);
        }
        var res;
        switch (o) {
            case 0: res = a + b; break;
            case 1: res = a - b; break;
            case 2: res = a * b; break;
            case 3: res = a / b; break;
            case 4: res = a % b; break;
            case 5: res = Math.pow(a, b); break;
            case 6: res = Math.min(a, b); break;
            case 7: res = Math.max(a, b); break;
            case 8: res = a & b; break;
            case 9: res = a | b; break;
            case 10: res = ~a; break;
            case 11: res = a ^ b; break;
            case 12: res = a << b; break;
            case 13: res = a >> b; break;
        }
        if (this.options.round) return Math.round(res);
        if (this.options.floor) return Math.floor(res);
        if (this.options.ceil) return Math.ceil(res);
        if (typeof a=='boolean' && typeof b=='boolean') res=!!res;
        return res;
    }, {
        options: {
            o: 0, round: false, floor: false, ceil: false, normal: true,
            a: numEdit(), b: numEdit(),
            width: 250, height: 140,
            oper: function (node) {
                return pimGui.vflex(m(pimGui.pimHGroup(
                    m(pimGui.pimSelectable(pimGui.pimButton('+', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 0 })), { title: 'output the sum of a and b', className: 'pimButton pimSelectable pimSelected' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('-', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 1 })), { title: 'output b subtracted from a' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('*', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 2 })), { title: 'output a multiplied width b' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('/', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 3 })), { title: 'output a divided by b' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('%', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 4 })), { title: 'output a modulo b' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('^', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 5 })), { title: 'output a to the power of b' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('<', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 6 })), { title: 'output smallest number' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('>', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 7 })), { title: 'output biggest number' }, { textAlign: 'center' })
                   ), {}, { borderTop: '1px solid rgba(0,0,0,0.8)', maxHeight: '24px' }),
                   m(pimGui.pimHGroup(
                    m(pimGui.pimSelectable(pimGui.pimButton('&', function ()   { [].slice.call(this.parentElement.previousSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 8  })), { title: 'output a AND b' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('|', function ()   { [].slice.call(this.parentElement.previousSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 9  })), { title: 'output a OR b' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('~', function ()   { [].slice.call(this.parentElement.previousSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 10 })), { title: 'output NOT(a)' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('xor', function () { [].slice.call(this.parentElement.previousSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 11 })), { title: 'output a XOR b' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('<<', function ()  { [].slice.call(this.parentElement.previousSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 12 })), { title: 'output a << b' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('>>', function ()  { [].slice.call(this.parentElement.previousSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 13 })), { title: 'output a >> b' }, { textAlign: 'center' })
                  ), {}, { borderTop: '1px solid rgba(0,0,0,0.8)', maxHeight: '24px' }),
                  m(pimGui.pimHGroup(
                    m(pimGui.pimSelectable(pimGui.pimButton('round', function () { node.options.round = !!this.className.match(/pimSelected/); if (node.options.round) { node.options.floor = false; node.options.ceil = false; } })), {}, { textAlign: 'center', borderRadius: 0 }),
                    m(pimGui.pimSelectable(pimGui.pimButton('floor', function () { node.options.floor = !!this.className.match(/pimSelected/); if (node.options.floor) { node.options.round = false; node.options.ceil = false; } })), {}, { textAlign: 'center', borderRadius: 0 }),
                    m(pimGui.pimSelectable(pimGui.pimButton('ceil', function () { node.options.ceil = !!this.className.match(/pimSelected/); if (node.options.ceil) { node.options.round = false; node.options.floor = false; } })), {}, { textAlign: 'center', borderRadius: 0 }),
                    m(pimGui.pimSelectable(pimGui.pimButton('normal', function () { node.options.normal = !!this.className.match(/pimSelected/); if (node.options.normal) { node.options.floor = false; node.options.ceil = false; node.options.round = false; } })), {}, { textAlign: 'center', borderRadius: 0 })
                  ), {}, { borderTop: '1px solid rgba(0,0,0,0.8)', borderBottom: '1px solid rgba(0,0,0,0.8)', maxHeight: '24px' })
                )
            }
        }
    }),
    m(function trig(a) {
        o = this.options.o;
        a = this.floatParam(0, a, this.options.a, (o >= 2) ? 1 : 0);
        var res;
        switch (o) {
            case 0: res = Math.sin(a); break;
            case 1: res = Math.cos(a); break;
            case 2: res = Math.tan(a); break;
            case 3: res = Math.asin(a); break;
            case 4: res = Math.acos(a); break;
            case 5: res = Math.atan(a); break;
        }
        return res;
    }, {
        options: {
            o: 0,
            a: numEdit(),
            width: 250, height: 96,
            oper: function (node) {
                return pimGui.vflex(m(pimGui.pimHGroup(
                    m(pimGui.pimSelectable(pimGui.pimButton('sin', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 0 })), { title: 'output sin of a radians', className: 'pimButton pimSelectable pimSelected' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('cos', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 1 })), { title: 'output cos of a radians' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('tan', function () { [].slice.call(this.parentElement.nextSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 2 })), { title: 'output tan of a radians' }, { textAlign: 'center' })
                   ), {}, { borderTop: '1px solid rgba(0,0,0,0.8)', maxHeight: '24px' }),
                   m(pimGui.pimHGroup(
                    m(pimGui.pimSelectable(pimGui.pimButton('asin', function ()   { [].slice.call(this.parentElement.previousSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 8  })), { title: 'output asin of a in radians' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('acos', function ()   { [].slice.call(this.parentElement.previousSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 9  })), { title: 'output acos of a in radians' }, { textAlign: 'center' }),
                    m(pimGui.pimSelectable(pimGui.pimButton('atan', function ()   { [].slice.call(this.parentElement.previousSibling.children).map(function(e){e.className=e.className.replace(/ pimSelected/i,'')}); node.options.o = 10 })), { title: 'output atan of a in radians' }, { textAlign: 'center' })
                  ), {}, { borderTop: '1px solid rgba(0,0,0,0.8)', borderBottom: '1px solid rgba(0,0,0,0.8)', maxHeight: '24px' })
                )
            }
        }
    }),
    m(function random(x, y) { var min = this.floatParam(0, x, this.options.rangeMin, 0); var max = this.floatParam(1, y, this.options.rangeMax, 1); var result = Math.random() * (max - min) + min; return this.options.isInteger ? Math.floor(result) : result; },
        { options: { rangeMin: numEdit('rangeMin [0.0]'), rangeMax: numEdit('rangeMax [1.0]'), isInteger: false, integer: function (node) { node.height += 10; return pimGui.pimCheck('integer', function (e) { node.options.isInteger = e; }); } } }),
    m(function abs(a) { return Math.abs(this.floatParam(0, a, this.options.a)); }, { options: { a: numEdit() } })
];

var colorNodes = [
    m(function color(r, g, b) { return [this.floatParam(0, r, this.options.r), this.floatParam(1, g, this.options.g), this.floatParam(2, b, this.options.b)]; }, { output: ['0red', '1green', '2blue'], options: { r: numEdit('red'), g: numEdit('green'), b: numEdit('blue') } }),
    m(function colorPick() { return this.options.color.style.backgroundColor.match(/\((.*?)\)/)[1].split(',').map(function (x) { return parseFloat(x) / 256; }); }, { output: ['0red', '1green', '2blue'], options: { caps: 77, height:85, color: function (n) { return m(pimGui.pimColor('', function () { }), {}, { minHeight: '60px' }); } } })
];

var baseShader = glslNode('base', '', []);
var imgNodes = [
    m(function img(time) {
        if (time != undefined && this.options.files) {
            var frame = Math.round(time * globalfps) % this.options.files.length;
            //    console.log('ask',frame);
            if (this.options.cache == undefined) {
                //        console.log('created cache');
                this.options.cache = [document.createElement('img'), document.createElement('img'), document.createElement('img'), document.createElement('img'), document.createElement('img'), document.createElement('img'), document.createElement('img')];
                this.options.cache[1].src = URL.createObjectURL(this.options.files[frame]);
                this.options.cache[2].src = URL.createObjectURL(this.options.files[frame + 1]);
                this.options.cache[3].src = URL.createObjectURL(this.options.files[frame + 2]);
                this.options.cache[4].src = URL.createObjectURL(this.options.files[frame + 3]);
                this.options.cache[5].src = URL.createObjectURL(this.options.files[frame + 4]);
                this.options.cache[6].src = URL.createObjectURL(this.options.files[frame + 5]);
            }
            if (this.options.lastframe == frame) return [this.options.cache[0],frame/globalfps];
            if (this.options.lastframe == frame - 1) {
                this.options.cache.push(this.options.cache.shift());
                this.options.cache[6].onload = undefined;
            } else {
                this.options.cache[0].src = URL.createObjectURL(this.options.files[frame]);
                this.options.cache[1].src = URL.createObjectURL(this.options.files[frame + 1]);
                this.options.cache[2].src = URL.createObjectURL(this.options.files[frame + 2]);
                this.options.cache[3].src = URL.createObjectURL(this.options.files[frame + 3]);
                this.options.cache[4].src = URL.createObjectURL(this.options.files[frame + 4]);
                this.options.cache[5].src = URL.createObjectURL(this.options.files[frame + 5]);
            }
            //        console.log('adding ',frame+2);
            this.options.cache[6].src = URL.createObjectURL(this.options.files[frame + 6]);
            //          console.log('cache[0].complete',this.options.cache[0].complete);
            //          console.log(this.options.cache[0].complete, this.options.cache[1].complete, this.options.cache[2].complete);
            this.options.lastframe = frame;
            this.options.cache[0].onload = undefined;
            if (this.options.cache[0].complete) {
                //            setTimeout(function(x){
                this.options.cache[0].uploaded = false; //console.log(this.options.img.complete);
                //             x();
                //             }.bind(this,this.nodeFlow.waiter.link()),0);
                return [this.options.cache[0],frame/globalfps];
            }
            else this.options.cache[0].onload = function (x) {
                console.log('unlock');
                this.options.cache[0].uploaded = false; //console.log(this.options.img.complete);
                x();
            }.bind(this, this.nodeFlow.waiter.link());
            return [this.options.cache[0],frame/globalfps];


            if (this.options.lastframe == frame) return [this.options.img, frame/globalfps];
            this.options.img.src = URL.createObjectURL(this.options.files[frame]);
            this.options.lastframe = frame;
            this.options.img.onload = function (x) {
                this.options.img.uploaded = false; //console.log(this.options.img.complete);
                x();
            }.bind(this, this.nodeFlow.waiter.link());
            this.setProgress((Math.round(time * globalfps) % this.options.files.length) / this.options.files.length);
            this.options.img.style.visibility = (isPlaying) ? 'hidden' : 'visible';
            return [this.options.img,frame/globalfps];
        }
        if (time != undefined && this.options.img instanceof HTMLVideoElement && Math.abs(this.options.img.currentTime - time) > 1 / 100) {
            this.options.img.currentTime = time;
            this.setProgress(true);
            this.options.img.onseeked = function (x) {
                this.setProgress(false);
                this.options.img.framesUploaded--;
                x();
            }.bind(this, nodeFlow.waiter.link());
        } return [this.options.img,time||this.options.img.currentTime];
    }, { options: { caps: 77 } }),
    m(function save(img) {
        if (!img) return;
        //  console.log(this.options.enabled);
        if (this.options.ctx == undefined || (this.options.c.width != (this.options.c.width != img.width || img.videoWidth)) || (this.options.c.height != img.height || img.videoHeight)) {
            this.options.c = document.createElement('canvas');
            this.options.c.width = img.width || img.videoWidth;
            this.options.c.height = img.height || img.videoHeight;
            this.options.ctx = this.options.c.getContext('2d');
            this.options.d = this.options.ctx.createImageData(img.width || img.videoWidth, img.height || img.videoHeight);
        }
        if (!this.options.enabled) return img;
        if (img.bind) {
            img.bind();
            img.unbind(new Uint8Array(this.options.d.data.buffer));
            this.options.ctx.putImageData(this.options.d, 0, 0)
        } else {
            this.options.ctx.drawImage(img, 0, 0);
        }
        this.options.frame = Math.round(globalTime * globalfps)
        var formats = [['jpg', 'image/jpeg'], ['png', 'image/png']][this.options.format];
        if (this.options.enabled) saveAs(toBlob(this.options.c.toDataURL(formats[1])), this.options.name + (this.options.frame++) + '.' + formats[0]);
        return img;
    }, { options: { height: 100, frame: 0, format: 0, name: 'frame', enabled: false, fname: function (n) { return pimGui.pimEdit('frame', function (x) { n.options.name = this.value; }); }, formatc: function (n) { return pimGui.pimCombo(['jpg', 'png'], function () { n.options.format = this.selectedIndex; }) }, enabledc: function (node) { return pimGui.pimCheck('enabled', function (onoff) { node.options.enabled = onoff; }); } } }),
    pixelNode('greyScale', 'vec3 c=texture2D(pim_texture0,texcoord0).rgb; gl_FragColor.rgba = vec4(mix(vec3(dot( vec3(0.2126, 0.7152, 0.0722), c.rgb )),c.rgb,pim_1),1.0);', ['pim_1'], { pim_1: numEdit('passthrough [0]') }),
    pixelNode('gamma', 'vec3 c=texture2D(pim_texture0,texcoord0).rgb; c.r=pow(c.r,pim_gamma); c.g=pow(c.g,pim_gamma); c.b=pow(c.b,pim_gamma); gl_FragColor.rgba = vec4((c-vec3(0.5))*(1.0+pim_contrast)+vec3(0.5+pim_brightness),1.0);', ['pim_gamma', 'pim_contrast', 'pim_brightness'], { pim_gamma: numEdit('gamma [1.0]', 1.0), pim_contrast: numEdit('contrast [0]'), pim_brightness: numEdit('brightness [0]') }),
    pixelNode('invert', 'gl_FragColor.rgba = vec4(1.0-texture2D(pim_texture0,texcoord0).rgb,1.0);'),
    pixelNode('posterise', 'gl_FragColor.rgba = vec4(texture2D(pim_texture0,floor(texcoord0 * pim_res)/(pim_res)).rgb,1.0);', ["pim_res"], { pim_res: numEdit('resolution [32]', 32) }),
    pixelNode('feedback', 'gl_FragColor.rgba = vec4(texture2D(pim_texture0,texcoord0).rgb+pim_a*texture2D(pim_texture1,(texcoord0-vec2(0.5,0.5))*pim_s+vec2(0.5,0.5)).rgb,1.0);', ["pim_a", "pim_s"], { pim_a: numEdit('amount', 0.5), pim_s: numEdit('scale', 0.99) }, true),
    pixelNode('merge_add', 'gl_FragColor.rgba = vec4(pim_blend1*texture2D(pim_texture0,texcoord0).rgb+pim_blend2*texture2D(pim_texture1,texcoord0).rgb,1.0);', ["pim_blend1", "pim_blend2"], { pim_blend1: numEdit('blend A', 1), pim_blend2: numEdit('blend B', 1) }, false, true),
    pixelNode('merge_screen', 'gl_FragColor.rgba = vec4(1.0-((1.0-pim_blend1*texture2D(pim_texture0,texcoord0).rgb)*(1.0-pim_blend2*texture2D(pim_texture1,texcoord0).rgb)),1.0);', ["pim_blend1", "pim_blend2"], { pim_blend1: numEdit('blend A', 1), pim_blend2: numEdit('blend B', 1) }, false, true),
    pixelNode('merge_multiply', 'gl_FragColor.rgba = vec4(pim_blend1*texture2D(pim_texture0,texcoord0).rgb*pim_blend2*texture2D(pim_texture1,texcoord0).rgb,1.0);', ["pim_blend1", "pim_blend2"], { pim_blend1: numEdit('blend A', 1), pim_blend2: numEdit('blend B', 1) }, false, true),
    pixelNode('merge_alpha', 'gl_FragColor.rgba = vec4(texture2D(pim_texture0,texcoord0).rgb*length(texture2D(pim_texture1,texcoord0).rgb),1.0);', [], {}, false, true),
    pixelNode('blur', [
        'gl_FragColor.rgba  = 0.11111*texture2D(pim_texture0,texcoord0);',
        'gl_FragColor.rgba += 0.11111*texture2D(pim_texture0,texcoord0 + vec2( 1.0, 1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += 0.11111*texture2D(pim_texture0,texcoord0 + vec2( 0.0, 1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += 0.11111*texture2D(pim_texture0,texcoord0 + vec2(-1.0, 1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += 0.11111*texture2D(pim_texture0,texcoord0 + vec2( 1.0, 0.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += 0.11111*texture2D(pim_texture0,texcoord0 + vec2(-1.0, 0.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += 0.11111*texture2D(pim_texture0,texcoord0 + vec2( 1.0,-1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += 0.11111*texture2D(pim_texture0,texcoord0 + vec2( 0.0,-1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += 0.11111*texture2D(pim_texture0,texcoord0 + vec2(-1.0,-1.0)*pim_size/1024.0);'
    ].join('\n'), ['pim_size'], { pim_size: numEdit('blur size', 1) }),
    pixelNode('sobel', [
        'gl_FragColor.rgba  = -1.0*texture2D(pim_texture0,texcoord0 + vec2(-1.0, -1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += -2.0*texture2D(pim_texture0,texcoord0 + vec2(-1.0,  0.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += -1.0*texture2D(pim_texture0,texcoord0 + vec2(-1.0,  1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba +=  1.0*texture2D(pim_texture0,texcoord0 + vec2( 1.0, -1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba +=  2.0*texture2D(pim_texture0,texcoord0 + vec2( 1.0,  0.0)*pim_size/1024.0);',
        'gl_FragColor.rgba +=  1.0*texture2D(pim_texture0,texcoord0 + vec2( 1.0,  1.0)*pim_size/1024.0);'
    ].join('\n'), ['pim_size'], { pim_size: numEdit('sobel size', 1) }),
    pixelNode('Laplace', [
        'gl_FragColor.rgba  =  4.0*texture2D(pim_texture0,texcoord0 + vec2( 0.0,  0.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += -1.0*texture2D(pim_texture0,texcoord0 + vec2(-1.0,  0.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += -1.0*texture2D(pim_texture0,texcoord0 + vec2( 0.0,  1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += -1.0*texture2D(pim_texture0,texcoord0 + vec2( 0.0, -1.0)*pim_size/1024.0);',
        'gl_FragColor.rgba += -1.0*texture2D(pim_texture0,texcoord0 + vec2( 1.0,  0.0)*pim_size/1024.0);'
    ].join('\n'), ['pim_size'], { pim_size: numEdit('Laplace size', 1) }),
    pixelNode('BleachByPass', [
        "vec4 base = texture2D( pim_texture0, texcoord0 );",
        "vec3 lumCoeff = vec3( 0.25, 0.65, 0.1 );",
        "float lum = dot( lumCoeff, base.rgb );",
        "vec3 blend = vec3( lum );",
        "float L = min( 1.0, max( 0.0, 10.0 * ( lum - 0.45 ) ) );",
        "vec3 result1 = 2.0 * base.rgb * blend;",
        "vec3 result2 = 1.0 - 2.0 * ( 1.0 - blend ) * ( 1.0 - base.rgb );",
        "vec3 newColor = mix( result1, result2, L );",
        "float A2 = pim_strength * base.a;",
        "vec3 mixRGB = A2 * newColor.rgb;",
        "mixRGB += ( ( 1.0 - A2 ) * base.rgb );",
        "gl_FragColor = vec4( mixRGB, base.a );",
    ].join("\n"), ['pim_strength'], { pim_strength: numEdit('opacity', 1) }),
    pixelNode('Vignette', [
        "vec4 texel = texture2D( pim_texture0, texcoord0 );",
        "vec2 uv = ( texcoord0 - vec2( 0.5 ) ) * vec2( pim_scale );",
        "gl_FragColor = vec4( mix( texel.rgb, vec3( 1.0 - pim_darkness ), dot( uv, uv ) ), texel.a );",
    ].join('\n'), ['pim_darkness', 'pim_scale'], { pim_darkness: numEdit('darkness', 1.0), pim_scale: numEdit('scale', 1.0) }),
    pixelNode('Kaleido', [
        'vec2 p = texcoord0.xy - 0.5;',
        'float a = atan(p.y, p.x) + pim_angle;',
        'float tau = 2.0 * 3.1416 ;',
        'a = mod(a,tau/pim_sides);',
        'a = abs(a-tau/pim_sides/2.0) ;',
        'p = length(p)*vec2(cos(a), sin(a));',
        'gl_FragColor = texture2D(pim_texture0, p + 0.5);',
    ].join('\n'), ['pim_sides', 'pim_angle'], { pim_sides: numEdit('sides', 8), pim_angle: numEdit('angle') }),
    m(function hsb(img, h, s, b) {
        if (this.isPassThrough) return img;
        if (!img) return;
        if (!this.options.ctx) baseShader.call(this, pimGui.merge(img, { onlyLoad: true }));
        img.onlyLoad = false;
        h = this.floatParam(1, h, this.options.h);
        s = this.floatParam(2, s, this.options.s, 1);
        b = this.floatParam(3, b, this.options.b, 1);
        var m = this.options.ctx.quad.surfaces[0].pimShaderExt;
        this.options.ctx.quad.surfaces[0].defines = '\n#define PIM_HSB\n';
        m.PIM_HSB = mat4.create();
        mat4.rotate(mat4.identity(), h, [1, 1, 1], m.PIM_HSB);
        mat4.multiply(mat4.transpose([(1 - s) * 0.3086 + s, (1 - s) * 0.3086, (1 - s) * 0.3086, 0, (1 - s) * 0.6094, (1 - s) * 0.6094 + s, (1 - s) * 0.6094, 0, (1 - s) * 0.0820, (1 - s) * 0.0820, (1 - s) * 0.0820 + s, 0, 0, 0, 0, 1]), m.PIM_HSB, m.PIM_HSB);
        mat4.scale(m.PIM_HSB, [b, b, b]);
        return baseShader.call(this, img);
    }, { options: { h: numEdit('hue'), s: numEdit('saturation'), b: numEdit('brightness'), sink: function (node) { return pimGui.pimCheck('show on preview', function (onoff) { node.sink = onoff; nodeFlow._updateTopology(); }); } } }),
    m(function paint_mask() {
        var o=this.options;
        if (o.ctx == undefined || o.ctx.width != (pWidth || img.width || img.videoWidth) || o.ctx.height != (pHeight||img.height||img.videoHeight)) {
            o.ctx.width  = (pWidth || img.width || img.videoWidth);
            o.ctx.height = (pHeight||img.height||img.videoHeight);
            console.log('resize canvas paint',o.ctx.width,o.ctx.height);
        }
        return o.ctx;
    },{
        output : ['img'],
        options: {
            caps: 77,
            width : 320, height:245,
            ctx : function(node) {
                var c = document.createElement('canvas');
                node.capture=c;
                pimGui.merge(c,{width:1280,height:720},{maxWidth:'100%',maxHeight:'100%',cursor:'crosshair'});
                c.ctx = c.getContext('2d');
                c.ctx.globalCompositeOperation = 'screen';
                c.brush = new Image();
                c.brush.src= "data:image/png;base64,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";
                c.brush2 = new Image();
                c.brush2.src= "data:image/png;base64,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";
                c.ctx.fillStyle="rgb(0,0,0)";
                c.ctx.fillRect ( 0 , 0 , c.width, c.height );
                c.ctx.drawsize = 64;
                c.onmousedown = function(e,d,x) {
                    c.ctx.globalCompositeOperation = (e.button==0)?'screen':'multiply';
                    c.uploaded=false;
                    var s=getComputedStyle(d||c);c.rw = parseInt(s.width);c.rh = parseInt(s.height);
                    c.ctx.drawImage((e.button==0)?c.brush:c.brush2, Math.floor((x||e.offsetX)/c.rw*c.width)-c.ctx.drawsize/2, Math.floor(e.offsetY/c.rh*c.height)-c.ctx.drawsize/2,c.ctx.drawsize,c.ctx.drawsize);
                }
                c.oncontextmenu = function(e) {
                    e.preventDefault();
                }
                c.onmousemove = function(e,d,x) {
                    if (!e.which) return;
                    c.ctx.drawImage((e.which==1)?c.brush:c.brush2, Math.floor((x||e.offsetX)/c.rw*c.width)-c.ctx.drawsize/2, Math.floor(e.offsetY/c.rh*c.height)-c.ctx.drawsize/2,c.ctx.drawsize,c.ctx.drawsize);
                    c.uploaded=false;
                }
                return c;
            },
            brushSize : function(node){ return pimGui.pimSlider('brush size', function(x){node.options.ctx.ctx.drawsize = x*128}); },
            opacity   : function(node){ return pimGui.pimSlider('opacity', function(x){node.options.ctx.ctx.globalAlpha = x}); }
        }
    }),
    m(function pano(img, h, p, b, fov) {
        if (this.isPassThrough) return img;
        var o = this.options;
        if (!img) return;
        if (o.ctx == undefined || o.ctx.width != (pWidth || img.width || img.videoWidth) || o.ctx.height != (pHeight||img.height||img.videoHeight)) {
            if (o.ctx) this.delete();
            var width = pWidth || img.width || img.videoWidth, height = pHeight || img.height || img.videoHeight;
            o.ctx = o.scene.createOffScreen(myDir.gl, width, height);
            buffersUsed++;
            this.delete = function(ctx) {ctx.delete(); buffersUsed--}.bind(this,o.ctx);
        }
        o.ctx.bind();
        o.scene.width = pWidth || img.width || img.videoWidth;
        o.scene.height = pHeight || img.height || img.videoHeight;
        myDir.gl.clear(myDir.gl.DEPTH_BUFFER_BIT);
        o.scene.objects[0].obj.surfaces[0].reflectionImage2 = img;
        o.scene.cameras[0].inst.rotation = [Math.PI / 2 + this.floatParam(1, h, this.options.h), this.floatParam(2, p, this.options.p), Math.PI + this.floatParam(3, b, this.options.b)];
        o.scene.cameras[0].vFov = this.floatParam(4, fov, this.options.fov, 70);
        o.scene.render(o.ctx, myDir.gl);
        o.ctx.unbind(false);
        return o.ctx;
    }, {
        options: {
            h: numEdit('heading'), p: numEdit('pitching'), b: numEdit('banking'), fov: function (node) {
                var no = node.options;
                no.scene = new pimScene();
                no.scene.phase2Cull = false;
                var cam = no.scene.addCamera();
                cam.vFov = 90;
                cam.inst.position = [0, 0, 0];
                var cube = no.scene.addObject(pimStream.cube(-5), new pimInstance('pano'));
                cube.obj.surfaces[0].defines = '#define PIM_SKYBOX\n#define PIM_TEXTURE_REFLECTIONMAP2\n';
                cube.obj.surfaces[0].pimShaderExt.pim_ibl_strength = 0.5;
                cube.obj.surfaces[0].pimShaderExt.pim_ibl_refl = 1;
                return pimGui.pimEdit('', function () { }, 'Field of view [70]');
            }, sink: function (node) { return pimGui.pimCheck('sink', function (onoff) { node.sink = onoff; nodeFlow._updateTopology(); }); }
        }
    }),
    m(function pano2(img, h, p, b, fov) {
        if (this.isPassThrough || this.options.scene.objects.length==0) return img;
        var o = this.options;
        if (!img) return;
        if (o.ctx == undefined || o.ctx.width != (pWidth || img.width || img.videoWidth) || o.ctx.height != (pHeight||img.height||img.videoHeight)) {
            if (o.ctx) this.delete();
            var width = pWidth || img.width || img.videoWidth, height = pHeight || img.height || img.videoHeight;
            o.ctx = o.scene.createOffScreen(myDir.gl, width, height);
            buffersUsed++;
            this.delete = function(ctx) {ctx.delete(); buffersUsed--}.bind(this,o.ctx);
        }
        o.ctx.bind();
        o.scene.width = pWidth || img.width || img.videoWidth;
        o.scene.height = pHeight || img.height || img.videoHeight;
        myDir.gl.clear(myDir.gl.DEPTH_BUFFER_BIT);
        o.scene.objects[0].obj.surfaces[0].channels[0].map = img;
        o.scene.cameras[0].inst.rotation = [Math.PI / 2 + this.floatParam(1, h, this.options.h), this.floatParam(2, p, this.options.p), Math.PI + this.floatParam(3, b, this.options.b)];
        o.scene.cameras[0].vFov = this.floatParam(4, fov, this.options.fov, 70);
        o.scene.render(o.ctx, myDir.gl);
        o.ctx.unbind(false);
        return o.ctx;
    }, {
        options: {
            h: numEdit('heading'), p: numEdit('pitching'), b: numEdit('banking'), fov: function (node) {
                var no = node.options;
                no.scene = new pimScene();
                no.scene.phase2Cull = false;
                var cam = no.scene.addCamera();
                cam.vFov = 90;
                cam.inst.position = [0, 0, 0];
                pimLWO2.load( 'semicross.lwo', 0, function(obj) {
                    no.scene.addObject(obj, new pimInstance('pano'));
                    console.log('object added', obj.surfaces[0]);
                });
                return pimGui.pimEdit('', function () { }, 'Field of view [70]');
            }, sink: function (node) { return pimGui.pimCheck('sink', function (onoff) { node.sink = onoff; nodeFlow._updateTopology(); }); }
        }
    }),
    m(function scene(img, h, p, b, fov) {
        if (this.isPassThrough || this.options.scene.objects.length==0) return img;
        var o = this.options;
        if (!o.scene.cameras.length) return;
        if (o.ctx == undefined) { // || o.ctx.width != (pWidth || img.width || img.videoWidth) || o.ctx.height != (pHeight||img.height||img.videoHeight)) {
            /*  if (o.ctx) this.delete();
              var width = pWidth || img.width || img.videoWidth, height = pHeight || img.height || img.videoHeight;
              o.ctx = o.scene.createOffScreen(myDir.gl, width, height);
              buffersUsed++;
              this.delete = function(ctx) {ctx.delete(); buffersUsed--}.bind(this,o.ctx);*/
            o.ctx = myDir.gl.createTexture(); 
            
            o.tree.populate(o.scene);    
            
            var floor = pimStream.cube(-50,[0,-1,0]);
            floor.surfaces[0].color=[0.3,0.3,0.3];
            var floor=o.scene.addObject(floor, new pimInstance('floor'));
            floor.inst.rayTransparent=1;
            
            var map = {
                diff : "chanc_env.jpg",
                refl : "chanc_2k.jpg",
                min : "-9.5,0.0,-9.5",
                max : "9.5,19.0,9.5",
                pos : "0.0,1.4,0.0",
                size: 19
            }
            if (map.diff) {        
                o.scene.objects.forEach(function(myObj){
                    myObj.obj.surfaces.forEach(function(s){
                        s.reflectionImage = pimUtils.loadImage(map.refl); 
                        s.reflectionImage2=pimUtils.loadImage(map.diff);
                        s.defines = '\n#define PIM_SKYBOX_MIN '+map.min+'\n#define PIM_SKYBOX_MAX '+map.max+'\n#define PIM_SKYBOX_POS '+map.pos+'\n';
                        if (s.pimShaderExt.pim_ibl_strength === undefined) s.pimShaderExt.pim_ibl_strength=0.5
                        if (s.pimShaderExt.pim_ibl_refl === undefined) s.pimShaderExt.pim_ibl_refl=s.name.match(/window/i)?1:0;
                        if (s.pimShaderExt.pim_ibl_aofi === undefined) s.pimShaderExt.pim_ibl_aofi=0.5;
                        if (s.pimShaderExt.pim_ibl_refract === undefined) s.pimShaderExt.pim_ibl_refract=0.0;
                        s.luminosity=0;
        
                    });
                });
                //    floor=o.scene.byName('floor');
                floor.obj = pimStream.cube((map.size instanceof Array)?map.size: -map.size/2 );
                floor.obj.surfaces[0].defines = '\n#define PIM_SKYBOX\n#define PIM_SKYBOX_MIN '+map.min+'\n#define PIM_SKYBOX_MAX '+map.max+'\n#define PIM_SKYBOX_POS '+map.pos+'\n';
                floor.obj.surfaces[0].reflectionImage2=pimUtils.loadImage(map.refl);
                floor.obj.surfaces[0].pimShaderExt.pim_ibl_strength=1;
                floor.obj.surfaces[0].pimShaderExt.pim_ibl_refl=0.5;
                floor.obj.loaded=0;
                floor.inst.y=(map.size/2||(-map.size[1]))-1;
                floor.inst.changed=1;
            }
        }
        var ci=o.scene.cameras[0].inst,changed=0;
        var oldpos = ci.position;
        if (myDir.keymap[keyCharToCode.Up]   ||myDir.keymap[keyCharToCode.W]) changed=ci.translate(0,0,0.01,ci.h,0,0),1;
        if (myDir.keymap[keyCharToCode.Down] ||myDir.keymap[keyCharToCode.S]) changed=ci.translate(0,0,-0.01,ci.h,0,0),1;
        if (myDir.keymap[keyCharToCode.Left] ||myDir.keymap[keyCharToCode.A]) changed=ci.translate(0.01,0,0,ci.h,0,0),1;
        if (myDir.keymap[keyCharToCode.Right]||myDir.keymap[keyCharToCode.D]) changed=ci.translate(-0.01,0,0,ci.h,0,0),1;
        if (changed) {
            var dist=ci.raytrace( o.scene, 0, -1, 0);
            if (!dist) ci.position=oldpos;
            else ci.y = ci.y + 0.54 - dist;
        }
        //        o.ctx.bind();
        if (o.scene.backdropColor) myDir.gl.clearColor(o.scene.backdropColor[0],o.scene.backdropColor[1],o.scene.backdropColor[2], o.scene.backdropColor[3]);
        o.scene.width = myDir.canvas.width;// pWidth || img.width || img.videoWidth;
        o.scene.height =myDir.canvas.height; // pHeight || img.height || img.videoHeight;
        myDir.gl.clear(myDir.gl.DEPTH_BUFFER_BIT);
        //        o.scene.objects[0].obj.surfaces[0].channels[0].map = img;
        o.scene.cameras[0].inst.rotation = [this.floatParam(1, h, this.options.h), this.floatParam(2, p, this.options.p), Math.PI + this.floatParam(3, b, this.options.b)];
        o.scene.cameras[0].vFov = this.floatParam(4, fov, this.options.fov, 70);
        o.scene.render({height:myDir.canvas.height,width:myDir.canvas.height*16/9}/*myDir.canvas*/, myDir.gl);
        myDir.gl.bindTexture(myDir.gl.TEXTURE_2D, o.ctx);
        myDir.gl.copyTexImage2D(myDir.gl.TEXTURE_2D,0,myDir.gl.RGB,0,0,myDir.canvas.height*16/9,myDir.canvas.height,0);
        myDir.gl.texParameteri(myDir.gl.TEXTURE_2D, myDir.gl.TEXTURE_WRAP_S, myDir.gl.CLAMP_TO_EDGE);
        myDir.gl.texParameteri(myDir.gl.TEXTURE_2D, myDir.gl.TEXTURE_WRAP_T, myDir.gl.CLAMP_TO_EDGE);
        myDir.gl.texParameteri(myDir.gl.TEXTURE_2D, myDir.gl.TEXTURE_MAG_FILTER, myDir.gl.LINEAR);
        myDir.gl.texParameteri(myDir.gl.TEXTURE_2D, myDir.gl.TEXTURE_MIN_FILTER, myDir.gl.LINEAR); //_MIPMAP_LINEAR);
        //       o.ctx.unbind(false);
        return { colorTexture: o.ctx };
    }, {
        options: {
            spacer : function(n){
                n.height+=210; n.width+=100;
                var res=m(document.createElement('div'),{innerHTML:''},{minHeight:'20px'}); 
                n.capture=res;
                res.onmousemove = function(e,d,x) {
                    if (!e.which) return;
                    if (n.options.scene.cameras[0]) {
                        n.options.h.value = n.options.scene.cameras[0].inst.h - myDir.mousemx / 200;
                        n.options.p.value = n.options.scene.cameras[0].inst.p + myDir.mousemy / 200;
                        n.options.b.value = 0;
                    }
                    myDir.mousemx=myDir.mousemy=0;
                }
              
                return res;
            },
            h: numEdit('heading'), p: numEdit('pitching'), b: numEdit('banking'), fov: function (node) {
                var no = node.options;
                no.scene = new pimScene();
                no.scene.phase2Cull = false;
                return pimGui.pimEdit('', function () { }, 'Field of view [70]');
            }, 
            tree: function (node) { return pimGui.merge(pimGui.pimTree(['name'],[],function(){}),{},{minHeight:'200px'})},
            sink: function (node) { return pimGui.pimCheck('sink', function (onoff) { node.sink = onoff; nodeFlow._updateTopology(); }); }
        }
    })
];

function getFunctionName(f) { return f.Name || f.toString().match(/ ([^ (]+)/)[1]; }

for (var f in generalNodes) window[getFunctionName(generalNodes[f])] = generalNodes[f];
for (var f in generatorNodes) window[getFunctionName(generatorNodes[f])] = generatorNodes[f];
for (var f in scalarNodes) window[getFunctionName(scalarNodes[f])] = scalarNodes[f];
for (var f in colorNodes) window[getFunctionName(colorNodes[f])] = colorNodes[f];
for (var f in imgNodes) window[getFunctionName(imgNodes[f])] = imgNodes[f];

// generate a button toolbar and an a node-generator object as returnvalue
function generateNodeToolbar(functionLib, nodeFlow) {
    var buttons = [];
    for (var f in functionLib)
        if (functionLib[f] instanceof Function) {
            var funcLib = functionLib[f], fstr = funcLib.toString(), fName = getFunctionName(funcLib), args = fstr.match(/\(([^)]*)\)/)[1].split(',');
            if (args.length == 1 && args[0] == '')
                args = []; // suppress empty
            var func = function (name, args, out, nodeFlow, options, _e, _x, _y, _insertOnLink) {
                if (_y == undefined) { _x = 0; _y = 0; }
                if (typeof options === "undefined")
                    options = {};
                var gotimg = 0, len = Math.max(args.length, out.length), start = 20 / (22 + len * 20);
                var so = nodeFlow.scrollOffset;
                var w = options["width"] || 150;
                var node = new NfNode(nodeFlow, new Rect((_x || 250 + so.x) - w * .5, (_y || 50 + so.y) - 10, w, options["height"] || (38 + len * 20)), name, options.caps || 13);  // 13 = default caps
                node.options = {};
                for (var o in options)
                    node.options[o] = (options[o] instanceof Function) ? node.mainBody.appendChild(options[o](node)) : options[o];
                args.forEach(function (a, ai) {
                    var c = new NfConnector(node, {
                        left: "0",
                        marginLeft: "-10px",
                        top: 26 + ai * 20 + 'px'//(((ai + 1) / (len + 1) * (1 - start) + start) * 100) + "%"
                    }, a, NfConnectorKind.Input, 1);
                    if (a.match(/img/)) { gotimg = 1; c.mainElement.style.borderRadius = 0; }
                });
                out.forEach(function (a, ai) {
                    var c = new NfConnector(node,
                        {
                            left: "100%",
                            top: 26 + ai * 20 + 'px'//(((ai + 1) / (len + 1) * (1 - start)) * 100) + "%"
                        }, a, NfConnectorKind.Output, Number.MAX_VALUE);
                    if (gotimg || a.match(/img/)) c.mainElement.style.borderRadius = 0;
                });
                if (_insertOnLink && !((_e.getModifierState && _e.getModifierState("Control")) || _e.ctrlKey)) // don't drop on link if Ctrl is pressed
                    node.insertOnLink();
                return node;
            }.bind(this, fName, args, functionLib[f].output || ["output"], nodeFlow, functionLib[f]["options"] || ((functionLib[f + '_info'] || {})["options"]));
            buttons.push(pimGui.merge(pimGui.pimButton(fName.replace(/_/g, ' '), func), { draggable: true, id: fName, ondragstart: function (fName, e) { e.dataTransfer.setData('Text', fName); }.bind(this, fName), dropFunc: function (func, e, x, y, insertOnLink) { func(e, x, y, true); }.bind(this, func) }));
        }
    return buttons; //pimGui.merge(pimGui.hflex.apply(pimGui, buttons),{},{maxHeight:'25px',minHeight:'25px'});
}

// generate a runable script from the nodeFlow
function generateScript(nodeFlow, sinkName) {
    var ordered = [],calls = [];
    function single(node, idx) {
        var nw=0;
        var i = nodeFlow.nodes.indexOf(node);
        if (ordered.indexOf(i + node.name) == -1) { ordered.unshift(i + node.name); nw = 1; }
        var res = 'res["' + i + node.name + '"]=' + node.name + '.call(' + ['nodeFlow.nodes[' + nodeFlow.nodes.indexOf(node) + ']'].concat(node.connectors.filter(function (x) {
            return (x.kind & NfConnectorKind.Input) != 0;
        }).map(function (x) {
            return (x.links[0] == undefined) ? 'undefined' : single(x.links[0].connectorA.node, (x.links[0].connectorA.name.match(/\d+/) || [])[0]);
        })).join()+')';// + (idx == undefined ? ')' : ')[' + idx + ']');
        if (nw) calls.push('nodeFlow.waiter.wait(function(res){' + res);//+'}.bind(this,res))');
        return 'res["' + i + node.name + '"]' + (idx == undefined ? '' : '[' + idx + ']');
    }
    var sinks = [];
    nodeFlow.nodes.forEach(function (n) {
        if (!n.sink) return;
        sinks.push(n);
    });
    if (sinks.length == 0) {
        for (var sink = 0; sink < nodeFlow.links.length; sink++)
            if (nodeFlow.links[sink].connectorB.node && (nodeFlow.links[sink].connectorB.node.name == (sinkName || 'sink') || (sinkName == undefined && nodeFlow.links[sink].connectorB.node.outgoingLinks.length == 0 && sinks.indexOf(nodeFlow.links[sink].connectorB.node) == -1)))
                sinks.push(nodeFlow.links[sink].connectorB.node);
        nodeFlow.nodes.forEach(function (n) {
            if (n.links.length) return;
            sinks.push(n);
        });
    }
    var inner = sinks.map(function (s) { return single(s, undefined); });
    var body = 'var res={};\n' + calls.join(';\n') + ';\nnodeFlow.waiter.wait(function(res){ var r=[' + inner + ']; complete&&complete(r); }.bind(this,res));' + new Array(calls.length + 1).join('}.bind(this,res))\n');
//    console.log(body);
    return new Function('nodeFlow', 'complete', body);
}

//////////////////////////////////////////////////////////////////////////////////////
//window.onload = function () {
//window["lastFunc"] = function () { };
window["myParticle"] = {};
//pimSound.waitAll(myDir.wait.link());
nodeFlow = new NodeFlow(function (item, action) {
    nodeFlow.waiter.wait(function () {
        skrim.parentElement.style.display=nodeFlow.nodes.length?'none':'flex';
        if (item instanceof NfLink && item.connectorB && item.connectorB.name == 'temp') return;
        window["lastFunc"] = generateScript(nodeFlow, undefined);
        if (action == 2 && item.delete) item.delete();
        if (action == 3 && item.rescale) setTimeout(item.rescale.bind(item), 10);
    });
});
nodeFlow.waiter = new countingCompleter();

skrim = document.createElement('div');
var skrimHolder = document.createElement('div');
skrimHolder.appendChild(skrim);
pimGui.merge( skrimHolder, {}, {display:'flex',alignItems:'center',position:'absolute',top:0,left:0,width:'100%',height:'100%'});
pimGui.merge(skrim, { innerHTML: "Drag images (jpg,png), videos (mp4,mov,webm) or audio (mp3,ogg) here to start ..<BR><SMALL><SMALL><SMALL><SMALL>(.. or you can drag folders with Lightwave&copy; 3D scenes, or folders with image sequences ..)</SMALL></SMALL></SMALL></SMALL>" }, { width: '100%', fontSize: '40px', textAlign: 'center', color: '#666' });
nodeFlow.rootElement.appendChild(skrimHolder);


document.body.style.position = 'absolute';
var canvas, top, left, middle, right, bottom, timeStart, timeStop, timeSlider, main = document.body.appendChild(pimGui.merge(pimGui.vflex(
  //top = pimGui.merge(pimGui.pimLabel('codename copperfield.'),{},{minHeight:'45px',maxHeight:'45px'}),
  pimGui.merge(pimGui.hflex(
    m(pimGui.grow(1, 160, 100, 400, [pimGui.merge(pimGui.vflex(
       pimGui.pimGroup.apply(pimGui, generatorNodesBar = generateNodeToolbar(generatorNodes, nodeFlow)),
       pimGui.pimGroup.apply(pimGui, generateNodeToolbar(generalNodes, nodeFlow)),
       pimGui.pimGroup.apply(pimGui, generateNodeToolbar(scalarNodes, nodeFlow)),
       pimGui.pimGroup.apply(pimGui, generateNodeToolbar(colorNodes, nodeFlow)),
       pimGui.pimGroup.apply(pimGui, sceneButton=generateNodeToolbar(imgNodes.slice(1), nodeFlow))
       ), {}, { overflowY: 'auto', display: 'block', paddingRight: '5px', position: 'absolute', right: '5px', left: '5px', height: '100%' })
    ]), { className: '' }, { paddingLeft: '10px', paddingRight: '10px', backgroundColor: '#969696', flexDirection: 'column' }),
    pimGui.merge(pimGui.vflex(
      canvas = pimGui.merge(document.createElement('canvas'), {}, { backgroundColor: '#969696' }),
      pimGui.grow(2, 500, 200, 800, [m(pimGui.vflex(nodeFlow.rootElement), { className: '' }, { position: 'absolute', top: '4px', bottom: '0px', width: '100%' })])
    ), {}, { flexGrow: '0' })

  ), {}, {}),
  pimGui.merge(pimGui.hflex(
    timeStart = pimGui.merge(pimGui.pimEdit('0'), {}, { maxWidth: '140px' }),
    timeSlider = pimGui.merge(pimGui.pimSlider('', function (x) {
        isPlaying = false;
        var start = parseInt(timeStart.value);
        var stop = parseInt(timeStop.value);
        var val = x * (stop - start) + start;
        globalTime = val / globalfps;
        timeSlider.setText(val.toFixed(2));
        if (myDir.running == 0 && !running) {
            var lf = window["lastFunc"];
            running = true;
            lf(nodeFlow, function (res) {
                running = false;
                if (res && res.length && res[0] && res[0]) {
                    var r=res[0];
                    if (r.length) r=r[0];
                    if (r instanceof HTMLVideoElement || r instanceof HTMLImageElement || r.colorTexture || r instanceof HTMLCanvasElement) {
                        var o = myDir.scene.byName(/cube/i), c = o.obj.surfaces[0].channels;
                        if (c.length == 0) { o.obj.loaded = 0; c.push({ type: 'COLR', map: r, enabled: true, texunit: 0, opacity: 0 }); };
                        c[0].map = r;
                        o.inst.changed = 1;
                        requestAnimFrame(myDir.render);
                    }
                }
            });
        }
    }, 100), {}, { minHeight: '30px' }),
    timeStop = pimGui.merge(pimGui.pimEdit('240'), {}, { maxWidth: '140px' })
  ), {}, { minHeight: '30px', maxHeight: '30px' })
), {}, { width: '100%', height: '100%', maxHeight: '100%' }));

// note to enki: why suppress a node here?  (commented it out because it disables a node for no apparent reason)
//generatorNodesBar[1].style.display = 'none';

sceneButton = sceneButton.pop();

// main canvas

// drag drop support images and videos.
window.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
});
window.addEventListener('drop', function dropper(e) {
    if (e.dataTransfer.getData) {
        var item = e.dataTransfer.getData("Text");
        if (item) document.getElementById(item).dropFunc(e, e.offsetX, e.offsetY);
    }
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    var files = [].slice.call(e.dataTransfer.files);

    if (e.dataTransfer.items && e.dataTransfer.items[0] && e.dataTransfer.items[0].webkitGetAsEntry) {
        var lx = e.offsetX, ly = e.offsetY;
        var entry = e.dataTransfer.items[0].webkitGetAsEntry();
        if (entry && entry.isDirectory) {
            var reader = entry.createReader();
            console.log('reading dir ..');
            var fileEntries = [];
            reader.readEntries(function more(e) {
                if (e.length) {
                    fileEntries = fileEntries.concat([].slice.call(e));
                    reader.readEntries(more);
                    return;
                }
                var tot = fileEntries.length;
                var done = 0;
                var nfiles = [];
                fileEntries.forEach(function (f) {
                    f.file(function (f) {
                        nfiles.push(f);
                        done++;
                        if (done == tot)
                            dropper({ offsetX: lx, offsetY: ly, dataTransfer: { files: nfiles } })
                    });
                });
            });
            return;
        }
    }
    var gotScene = files.reduce(function (last, cur) { if (cur.name.match(/.lws/)) return last + 1; return last; }, 0);
    if (gotScene) {
        var w = new pimUtils.countingCompleter();
        files.forEach(function(x){
            if (x.name.match(/\.lwo/)) {
                var reader = new FileReader();
                reader.onload = function (x,complete,fileEvent) {
                    var data = fileEvent.target.result;
                    pimUtils.fileCache[URL.createObjectURL(x).replace(/\/[^\/]*$/,'/')+x.name] = data;
                    complete();
                }.bind(this,x,w.link());
                reader.readAsArrayBuffer(x);
            }
            if (x.name.match(/\.jpg|\.png/)) {
                var n=URL.createObjectURL(x).replace(/\/[^\/]*$/,'/')+x.name;
                var i=new Image();
                i.src = URL.createObjectURL(x);
                pimUtils.imageCache[n]=i;
            }
            console.log(URL.createObjectURL(x).replace(/\/[^\/]*$/,'/')+x.name);
        });
        w.wait(function(){
            sceneButton.click();
            var lastNode = nodeFlow.nodes[nodeFlow.nodes.length-1];
            lastNode.options.scene.backdropColor=[0,0,0,1];
            pimLWS.read( lastNode.options.scene, URL.createObjectURL(files[1]), function() {});
        });

        return;
    }

    var withNrs = files.reduce(function (last, cur) { if (cur.name.match(/\d+.*\.jpg|\d+.*\.png/)) return last + 1; return last; }, 0);
    if (files.length > 1 && files.length == withNrs) {
        files.sort(function (a, b) { return a.name.match(/(\d+)/)[1] - b.name.match(/(\d+)/)[1] });
        var node = new NfNode(nodeFlow, new Rect(e.offsetX + nodeFlow.rootElement.scrollLeft, e.offsetY + nodeFlow.rootElement.scrollTop, 150 * 16 / 9, 228), 'img');
        console.log(files[0].name);
        node.options = { img: node.mainBody.appendChild(pimGui.merge(document.createElement('img'), { src: (files[0].toURL && files[0].toURL()) || URL.createObjectURL(files[0]), height: '180' })) };
        node.options.files = files;
        var c = new NfConnector(node,
            {
                left: "100%",
                top: "50%"
            }, 'out', NfConnectorKind.Output, Number.MAX_VALUE);
        node.mainBody.appendChild(pimGui.pimCheck('show on preview', function (onoff) { node.sink = onoff; nodeFlow._updateTopology(); }));
        c.mainElement.style.borderRadius = 0;
        var c = new NfConnector(node, {
            left: "0%",
            marginLeft: "-10px",
            top: "50%"
        }, 'time', NfConnectorKind.Input, Number.MAX_VALUE);
        c.mainElement.style.borderRadius = 0;
        return false;
    };


    [].slice.call(e.dataTransfer.files).forEach(function (file, fi) {
        if (file.name.match(/\.mp3|\.ogg/)) {
            console.dir(generatorNodesBar[1/*generatorNodesBar.length-1*/].click());
            var node = nodeFlow.nodes[nodeFlow.nodes.length - 1];
            node.mainElement.style.display='none';
            var reader = new FileReader();
            reader.onload = function (fileEvent) {
                var data = fileEvent.target.result;
                console.log('loaded');
                myDir.audio.decodeAudioData(data, function (bufferSource) {
                    node.mainElement.style.display='';
                    console.log('decoded');
                    node.options.bufferSource = bufferSource;
                });
            }
            reader.readAsArrayBuffer(file);
            return false;
        }

        var so = nodeFlow.scrollOffset;
        var node = new NfNode(nodeFlow, new Rect(e.offsetX + so.x + fi * 10, e.offsetY + so.y + fi * 180, 150 * 16 / 9, 200), 'img');
        if (file.name.match(/\.mp4|\.mov|\.avi/i))
            node.options = { img: node.mainBody.appendChild(pimGui.merge(document.createElement('video'), { mediaGroup: 'base', src: URL.createObjectURL(file), loop: 1, controls: 1, muted: 1 }, { width: 150 * 16 / 9 + 'px', height: '200 px' })) };
        else
            node.options = { img: node.mainBody.appendChild(pimGui.merge(document.createElement('img'), { src: URL.createObjectURL(file), height: '200px' })) };
        var c = new NfConnector(node, { left: "100%", top: "40%" }, '0 img', NfConnectorKind.Output, Number.MAX_VALUE);
        c.mainElement.style.borderRadius = 0;
        var c = new NfConnector(node, { left: "100%", top: "60%" }, '1 time', NfConnectorKind.Output, Number.MAX_VALUE);
        node.mainBody.appendChild(pimGui.pimCheck('show on preview', function (onoff) { node.sink = onoff; nodeFlow._updateTopology(); }));
        var c = new NfConnector(node, {
            left: "0%",
            marginLeft: "-10px",
            top: "50%"
        }, 'time', NfConnectorKind.Input, Number.MAX_VALUE);
    });
    return false;
});



var running = false;
myDir.onFrame = function () {
    var lf = window["lastFunc"];
    if (lf && !running && (myDir.running || isPlaying)) {
        running = true;
        if (isPlaying) {
            globalTime += 1 / globalfps;
            var start = parseInt(timeStart.value);
            var stop = parseInt(timeStop.value);
            timeSlider.setValue(Math.min(1, Math.max(0, (Math.floor(globalTime * globalfps) - timeStart.value) / (timeStop.value - timeStart.value))));
            timeSlider.setText(Math.floor(globalTime * globalfps));
        }
        lf(nodeFlow, function (res) {
            running = false;
            if (res && res.length && res[0]) {
                var r=res[0];
                if (r.length) r=r[0];
                if (r instanceof HTMLVideoElement || r instanceof HTMLImageElement || r.colorTexture || r instanceof HTMLCanvasElement) {
                    var o = myDir.scene.byName(/cube/i), c = o.obj.surfaces[0].channels;
                    if (c.length == 0) {
                        o.obj.loaded = 0;
                        c.push({ type: 'COLR', map: r, enabled: true, texunit: 0, opacity: 0 });
                    }
                    ;
                    c[0].map = r;
                    o.inst.changed = 1;
                    if (isPlaying && globalTime * globalfps < parseInt(timeStop.value)) {
                        requestAnimFrame(myDir.render);
                        //  setTimeout(myDir.render,0);
                    }
                }
            }
        });
    }

}

window.onkeydown = function (e) {
    if (e.which == 70){myDir.canvas.webkitRequestFullscreen();}
    if (running || myDir.running) return;
    if (e.which == 32) {
        e.preventDefault(); e.stopPropagation();
        isPlaying = !isPlaying;
        console.log(isPlaying);
        if (isPlaying) {
            globalTime = 0;
            var lf = window["lastFunc"];
            running = true;
            lf(nodeFlow, function (res) {
                running = false;
                if (res && res.length && res[0]) {
                    var r=res[0];
                    if (r.length) r=r[0];
                    if (r instanceof HTMLVideoElement || r instanceof HTMLImageElement || r.colorTexture || r instanceof HTMLCanvasElement) {
                        var o = myDir.scene.byName(/cube/i), c = o.obj.surfaces[0].channels;
                        if (c.length == 0) { o.obj.loaded = 0; c.push({ type: 'COLR', map: r, enabled: true, texunit: 0, opacity: 0 }); };
                        c[0].map = r;
                        o.inst.changed = 1;
                        requestAnimFrame(myDir.render);
                    }
                }
            });

        }
        return false;
    }
    isPlaying = false;
    if (e.which != 37 && e.which != 39) return;
    if (e.which == 37) globalTime -= 1 / globalfps;
    if (e.which == 39) globalTime += 1 / globalfps;
    e.preventDefault();
    e.stopPropagation();
    var start = parseInt(timeStart.value);
    var stop = parseInt(timeStop.value);
    timeSlider.setValue(Math.min(1, Math.max(0, (Math.floor(globalTime * globalfps) - timeStart.value) / (timeStop.value - timeStart.value))));
    timeSlider.setText(Math.floor(globalTime * globalfps));
    if (myDir.running == 0) {
        var lf = window["lastFunc"];
        running = true;
        lf(nodeFlow, function (res) {
            running = false;
            if (res && res.length && res[0]) {
                var r=res[0];
                if (r.length) r=r[0];
                if (r instanceof HTMLVideoElement || r instanceof HTMLImageElement || r.colorTexture || r instanceof HTMLCanvasElement) {
                    var o = myDir.scene.byName(/cube/i), c = o.obj.surfaces[0].channels;
                    if (c.length == 0) { o.obj.loaded = 0; c.push({ type: 'COLR', map: r, enabled: true, texunit: 0, opacity: 0 }); };
                    c[0].map = r;
                    o.inst.changed = 1;
                    requestAnimFrame(myDir.render);
                }
            }
        });
    }
}

pimUtils.pimOptions.forceDynamic.ALL = true;
myDir.autoload(canvas, '', 0, function () {
    //myDir.canvas.removeEventListener('dragover');
    //myDir.canvas.removeEventListener('drop');
    myDir.scene.phase2Cull = false;
    myDir.scene.backdropColor = [0.5, 0.5, 0.5];
    pimGui.merge(myDir.scene.addLight(), { type: 1 }).inst.position = [2, 2, -2];
    var o = myDir.scene.addObject(pimStream.cube(0.5), new pimInstance('cube1'));
    var inst = o.inst;
    
    var captureNode = null;
    myDir.canvas.onmousedown = function(e) {
        var overschot = myDir.canvas.width - myDir.canvas.height/pHeight*pWidth;
        var altx = (e.offsetX-overschot/2) * myDir.canvas.width / (myDir.canvas.height/pHeight*pWidth);
        captureNode = nodeFlow.nodes && nodeFlow.nodes.reduce && nodeFlow.nodes.filter(function(n){return n.isSelected})[0];
        if (captureNode && captureNode.capture && captureNode.capture.onmousedown) captureNode.capture.onmousedown(e,myDir.canvas,altx);
    }
    myDir.canvas.onmousemove = function(e) {
        var overschot = myDir.canvas.width - myDir.canvas.height/pHeight*pWidth;
        var altx = (e.offsetX-overschot/2) * myDir.canvas.width / (myDir.canvas.height/pHeight*pWidth);
        if (captureNode && captureNode.capture && captureNode.capture.onmousemove) captureNode.capture.onmousemove(e,myDir.canvas,altx);
    }
    
    inst["h"] = 1.57;
    inst["z"] = 4;
    inst["ys"] = 4.6;
    inst["zs"] = 4.6 * pWidth / pHeight;
    pimGui.merge(o.obj.surfaces[0], { luminosity: 1, diffuse: 0, color: [0, 0, 0] });
    window["myParticle"] = this.scene.addParticle({ Name: 'smokey', position: [0, 0, -2], scale: [0.1, 0.1, 0.1], alphaName: 'smoke_shape.jpg', Version: 2, randomColor: false, velocity: 0, Red: 1, Green: 1, Blue: 1, Weight: 1, birthRate: 0, Size: [[0, 10], [1, 20]], Intensity: [[0, 0.7], [0.3, 0]] });
    myDir.scene.cameras[0].inst.position = [0, 0, -4];
});
//};