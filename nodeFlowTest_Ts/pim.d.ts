// Type definitions for pimJs by enki
// Docs: http://pim.enki.ws/doc/index.html
// Libary: "http://pim.enki.ws/pim-min.js"
// Definitions distilled from docs: Frank Verheyen (Walrus Graphics) alias loki of mute

declare var pimGui: pimGui;
declare var pimFonts: pimFonts;
declare var pimLWO2: pimLWO2;
declare var pimLWS: pimLWS;
declare var pimlxo: pimlxo;
declare var pimMaths: pimMaths;
declare var pimRay: pimRay;
declare var pimStream: pimStream;
declare var pimUtils: pimUtils;

declare var pimSpline: any;
declare var pimScene: any;
declare var pimInstance: any;
declare var pimObjectInstance: any;
declare var pimLight: any;
declare var pimCamera: any;
declare var pimBone: any;
declare var pimObject: any;
declare var pimSound: any;
declare var pimSoundInstance: any;
declare var NetworkStore: any;
declare var pimDirector: any;
declare var pimFontMesh: any;
declare var pimSurface: any;
declare var pimParticle: any;
declare var pimProgress: any;
declare var countingCompleter: any;
declare var pimVerlet: any;
declare var vec3: any;
declare var vec4: any;
declare var vec6: any;
declare var mat4: any;
declare var quat: any;

declare enum growDirection {
    rightToLeft,
    leftToRight,
    up
}

declare enum stereoMode {
    none,
    sbs,
    interleaved,
    redCyan,
    sbsBarrelChroma
}

interface vec3 {
    create(vec: vec3): vec3;
    subtract(vec: vec3, vec2: vec3, dest: vec3): vec3;
    add(vec: vec3, vec2: vec3, dest: vec3): vec3;
    mul(vec: vec3, vec2: vec3, dest: vec3): vec3;
    scale(vec: vec3, val: number, dest: vec3): vec3;
    normalize(vec: vec3, dest: vec3): vec3;
    cross(vec: vec3, vec2: vec3, dest: vec3): vec3;
    length(vec: vec3): number;
    dot(vec: vec3, vec2: vec3): number;
}

interface vec4 {
    create(vec: vec4): vec4;
    add(vec: vec4, vec2: vec4, dest: vec4): vec4;
    scale(vec: vec4, val: number, dest: vec4): vec4;
    normalize(vec: vec4, dest: vec4): vec4;
}

interface vec6 {
}

interface mat4 {
    create(mat: mat4): mat4;
    identity(dest: mat4): mat4;
    transpose(mat: mat4, dest: mat4): mat4;
    inverse(mat: mat4, dest: mat4): mat4;
    multiply(mat: mat4, mat2: mat4, dest: mat4): mat4;
    multiplyVec3(mat: mat4, vec: vec3, dest: vec3): vec3;
    multiplyVec4FxyzwF(mat: mat4, x: number, y: number, z: number, w: number, dest: vec4): vec4;
    multiplyVec4(mat: mat4, vec: vec4, dest: vec4): vec4;
    translate(mat: mat4, vec: vec3, dest: mat4): mat4;
    scale(mat: mat4, vec: vec3, dest: mat4): mat4;
    rotate(mat: mat4, angle: number, axis: vec3, dest: mat4): mat4;
    rotateX(mat: mat4, angle: number, dest: mat4): mat4;
    rotateY(mat: mat4, angle: number, dest: mat4): mat4;
    rotateZ(mat: mat4, angle: number, dest: mat4): mat4;
    frustum(left: number, right: number, bottom: number, top: number, near: number, far: number, dest: mat4): mat4;
    perspective(fovy: number, aspect: number, near: number, far: number, fest: mat4): mat4;
    ortho(left: number, right: number, bottom: number, top: number, near: number, far: number, dest: mat4): mat4;
    lookAt(eye: vec3, center: vec3, up: vec3, dest: mat4): mat4;
    fromQuat(out: mat4, q: quat): mat4;
}

interface quat {
    create(q: quat): quat;
    normalize(q: quat, dest: quat): quat;
    fromEuler(h: number, p: number, b: number, out: quat): quat;
    slerp(a: quat, b: quat, t: number, out: quat): quat;
    multiply(out: quat, a: quat, b: quat): quat;
    slerpNoInvert(a: quat, b: quat, t: number, out: quat): quat;
    squad(q1: quat, q2: quat, a: quat, b: quat, t: number, out: quat): quat;
    bezier(q1: quat, q2: quat, a: quat, b: quat, t: number, out: quat): quat;
    log(q: quat, out: quat): quat;
    exp(q: quat, out: quat): quat;
    add(q: quat, q2: quat, dest: quat): quat;
    splinePoint(qnm1: quat, qn: quat, qnp1: quat): vec3;
    invert(a: quat, out: quat): quat;
    dot(a: quat, out: quat): quat;
    sutract(a: quat, b: quat, out: quat): quat;
    conjugate(a: quat, out: quat): quat;
    double(p: quat, q: quat, out: quat): quat;
    bisect(p: quat, q: quat, out: quat): quat;
    findA(qnm1: quat, qn: quat, qnp1: quat, out: quat): quat;
    findB(qnm1: quat, a: quat, out: quat): quat;
    fromMat4(m: mat4, out: quat): quat;
    
}

interface pimGui {
    colorPickImage();
    merge(a: any, b: any, c?: any): any;
    pimColor(content: string, func: Function);
    pimButton(content: string, func?: Function): HTMLElement;
    pimLabel(content: string, func?: Function): HTMLElement;
    pimSlider(content: string, func?: Function): HTMLElement;
    pimEdit(content: string, func?: Function, placeholder?: string, reg?: RegExp): HTMLElement;
    pimCombo(content: string, func?: Function): HTMLElement;
    pimSelectable(data: HTMLElement, handler?: Function): HTMLElement;
    pimCheck(label: string, callback: Function): HTMLElement;
    pimHGroup(elem1: HTMLElement, ...elem2: HTMLElement[]): HTMLElement;
    pimGroup(elem1: HTMLElement, ...elem2: HTMLElement[]): HTMLElement;
    pimTable(headers: string[], data: any[], handler?: Function, max?: number, min?: number): pimTable;
    pimCRUD(data: any[], proto: any): HTMLElement;
    pimTree(headers: string[], data: any[], handler?: Function, max?: number, min?: number): pimTree;
    pimTabs(headers: string[], content: HTMLElement[], handler?: Function): HTMLElement;
    pimTrackDisplay(track: any, handler?: Function);
    pimSpliner(handler?: Function): pimSpliner;
    hflex(elem1: HTMLElement, ...elem2: HTMLElement[]): HTMLElement;
    vflex(elem1: HTMLElement, ...elem2: HTMLElement[]): HTMLElement;
    grow(dir: growDirection, start: number, min: number, max: number, items: HTMLElement): any;
    grow(dir: growDirection, start: number, min: number, max: number, items: any[]): any;
    pimMenu(x: number, y: number, items: string[], handler: Function): void;
    pimMenu(x: number, y: number, items: Function[], handler: Function): void;
    pimMenu(x: number, y: number, items: HTMLElement[], handler: Function): void;
    pimModal(element: any[], Function: Function): HTMLElement;
    pimModal(element: HTMLElement[], Function: Function): HTMLElement;
    pimModal(element: any[], Function: Function[]): HTMLElement;
    pimModal(element: HTMLElement[], Function: Function[]): HTMLElement;
}


interface pimTable extends HTMLElement {
    addItem(rdata: any, force: boolean): void;
    populate(data: any[], force: boolean): void;
    selectAll(): void;
    deleteSelected(): void;
}

interface pimTree extends HTMLElement {
    populate(data: any[]): void;
}

interface pimSpliner extends HTMLElement {
    addSpline(spline: pimSpline, name: string, redraw: boolean): void;
    redraw(): void;
    clearSplines(): void;
}

interface pimSpline {
    constructor(source: pimSpline);

    // data members
    nrKeys: number;
    keys: any;
    pre: number;
    post: number;
    M_STEPPED: number;
    M_LINEAR: number;
    M_TCB: number;
    B_RESET: number;
    B_CONST: number;
    B_REPEAT: number;
    B_OSCILATE: number;
    B_OFFSETREPEAT: number;
    B_LINEAR: number;

    // methods
    delKey(time: number): pimSpline;
    addKey(time: number, value: number, ktp?: number, t?: number, c?: number, b?: number): pimSpline;
    clear(): pimSpline;
    evaluate(time: number);
}

interface pimFonts {
    loadFontFile(fontname: string, complete: Function): any;
}

interface pimLWO2 {
    loadLWO2(url: string, complete: Function, lnr?: number, prog?: Function): void;
}

interface pimLWS {
    read(myScene: pimScene, url: string, complete: Function, prog: Function);
}

interface pimlxo {
    lxo(myScene: pimScene, url: string, complete: Function, lnr?: number, prog?: Function);
}

interface pimMaths {
    segmetnToSegment();
}

interface pimScene {
    constructor(name: string): pimInstance;

    // data members
    objects: pimObjectInstance[];
    lights: pimLight[];
    cameras: pimCamera[];
    phase2Cull: boolean;
    fps: number;
    ambientColor: number;
    ambientIntensity: number;
    filters: any[];
    nameCache: Function;

    // methods
    match(reg: RegExp): pimObjectInstance[];
    evaluate(time: number): pimScene;
    addObject(object: pimObject): pimObjectInstance;
    addCamera(): pimCamera;
    addLight(): pimLight;
    addParticle(object: pimObject): pimObjectInstance;
    getStats(): any;
    propagateChanged(): void;
    render(canvas: HTMLCanvasElement, gl: WebGLBuffer): pimScene;
}

interface pimInstance {
    constructor(nameOrInst: string);
    constructor(nameOrInst: pimInstance);

    // data members
    position: number[];
    rotation: number[];
    scale: number[];
    x: number;
    y: number;
    z: number;
    h: number;
    p: number;
    b: number;
    xs: number;
    ys: number;
    zs: number;
    px: number;
    py: number;
    pz: number;
    ph: number;
    pp: number;
    pb: number;
    bx: number;
    by: number;
    bz: number;
    bh: number;
    bp: number;
    bb: number;
    _x: number;
    _y: number;
    _z: number;
    _h: number;
    _p: number;
    _b: number;
    _xs: number;
    _ys: number;
    _zs: number;
    name: string;
    parent: pimInstance;
    changed: boolean;
    vChanged: boolean;
    selected: boolean;
    mouseTracked: boolean;
    visible: boolean;
    rayTransparent: boolean;
    shadowOptions: number;
    ss: number;

    // methods
    distanceTo(otherinstance: pimInstance): number;
    rayTrace(scene: pimScene, x: number, y: number, z: number, ox?: number, oy?: number, oz?: number): number;
    squeezed(): boolean;
    evaluate(time: number): pimInstance;
    evaluateMatrix(): any;
    rotate(deg: number, axis: number[]): pimInstance;
    lookAt(inst: pimInstance, v1?: number[]): pimInstance;
    alignDir(from: pimInstance, to: pimInstance, up?: number[]): void;
    addKey(time: number): void;
    clear(): void;
    align(target: pimInstance, target2?: pimInstance): void;
    alignOffs(target: pimInstance, offset: vec3): void;
    translate(x: number, y: number, z: number, h?: number, p?: number, b?: number): pimInstance;
}

interface pimObjectInstance {
    constructor(o: pimObject, i: pimInstance);

    // data members
    obj: pimObject;
    inst: pimInstance;
    bones: pimBone[];
    sortGroup: number;
    hasTransparency: boolean;

    // methods
    byName(n: string): pimSurface;
    deform_cpu(): void;
}

interface pimLight {
    constructor(i: pimInstance);

    // data members
    inst: pimInstance;
    type: number;
    color: number[];
    intensity: number;
}

interface pimCamera {
    constructor(i: pimInstance);

    // data members
    inst: pimInstance;
    vFov: number;
    zNear: number;
    zFar: number;
    zoomFactor: number;
    appertureHeight: number;
    width: number;
    height: number;
    backdropColor: number[];
}

interface pimBone {
    constructor(i: pimInstance);

    // data members
    inst: pimInstance;
    weightMap: number;
}

interface pimObject {
    constructor();

    // data members
    surfaces: pimSurface[];
    attribs: any;

    // methods
    calculateBoundingBox(): any[];
    calculatePolygonNormals(): void;
    calculateSmoothNormals(): void;
}

interface pimRay {
    plane_from_points(p1: vec3, p2: vec3, p3: vec3): vec4;
    intersect_ray_plane(orig: vec3, dir: vec3, plane: vec4, inst?: pimInstance): number;
    mousetrack(x: number, y: number, canvas: HTMLCanvasElement, scene: pimScene, inst: pimInstance, ref: pimInstance, plane: vec4): void;
    intersect_ray_box(orig: vec3, dir: vec3, bbox: vec6): boolean;
    intersect_ray_box_ofs(orig: vec3, dir: vec3, bbox: vec6, ofs: number): boolean;
    intersect_ray_object(orig: vec3, dir: vec3, obj: pimObjectInstance): number;
    intersect_ray_object_ofs(orig: vec3, dir: vec3, obj: pimObjectInstance, ofs: number): number;
    intersect(orig: vec3, dir: vec3, scene: pimScene): number;
    intersect_vp(x: number, y: number, canvas: HTMLCanvasElement, scene: pimScene): number;
}

interface pimSound {
    constructor(url: string, defSpeed?: number, defVol?: number, loadComplete?: Function, loadError?: Function);

    // data members
    waitAll: any;

    // methods
    _onLoadComplete(): Function;

    start(startOffset?: number, delay?: number, speed?: number, volume?: number, loop?: boolean): pimSoundInstance;
}

interface pimSoundInstance {
    constructor();

    // methods
    _onEnded(): void;
    setVolume(value: number, delay?: number): void;
    setSpeed(value: number, delay?: number): void;
    slideVolume(value: number, time: number, stop?: boolean): void;
    slideSpeed(value: number, time: number, stop?: boolean): void;
    stop(delay?: number): void;
}

interface pimStream {
    // data members
    pim_position: number[];
    pim_normal: number[];
    pim_tangent: number[];
    pim_texcoord0: number[];
    pim_texcoord1: number[];
    pim_texcoord2: number[];
    pim_triangle: number[];
    pim_tag_polygon: number[];
    pim_tag_triangle: number[];

    // methods
    begin(obj: pimObject, polygonmode?: number, reuse?: boolean): void;
    duplicateVertex(sid: number): number;
    nGon(indices: number[]): void;
    attrib(meshAttribute: number, value: number): void;
    attrib(meshAttribute: number, value: number[]): void;
    end(): pimObject;
    Instance(o: pimObject, mtx: any): void;
    quad(topleft: any, bottomRight: any): void;
    cube(size: number, pos?: vec3): void;
    cube(size: vec3, pos?: vec3): void;
    sphere(segments: number, slices: number, radius: number, smooth: boolean): void;
    capsule(segments: number, slices: number, radius: number, length: number, smooth: boolean): void;
    disc(segments: number, slices: number, radius: number, the: number, smooth: boolean, matrix: any): void;
}

interface pimUtils {
    // data members
    pimOptions: any;

    // methods
    fileAsArray(filename: string, progress?: Function, completion?: Function, error?: Function): void;
    fileAsText(filename: string, progress?: Function, completion?: Function, error?: Function): void;
    fileAsTextSync(filename: string, progress?: Function, completion?: Function, error?: Function): void;
    loadImage(filename: string, progress?: Function, completion?: Function, error?: Function): HTMLImageElement;
    loadVideo(filename: string, progress?: Function, completion?: Function, error?: Function): HTMLVideoElement;
    detectMobile(): boolean;
}

interface NetworkStore {
    constructor(url?: string, fh?: Function);

    // methods
    provide(name: string, obj: any, publicFilter?: any, sigConnect?: Function, sigDisConnect?: Function): void;
    require(name: string, sigConnect?: Function, sigDisConnect?: Function, explicitStore?: any, proto?: any): any;
}

interface pimDirector {
    constructor(mixin?: any);

    // data members
    START_QUEUE: number;
    START_DISCARD: number;
    STOP_FINISH: number;
    STOP_INT: number;
    WRAP_PING: number;
    WRAP_PINGPING: number;
    WRAP_PINGPONG: number;
    WRAP_PONGPONG: number;
    WRAP_PONG: number;
    oldSchool;

    // methods
    autoload(canvas: any, scenename: string, guess?: number, complete?: Function): void;
    autoPlay(): pimDirector;
    autoAssign(): pimDirector;
    assign(thing: any, subscene: number, target?: any, targetvar?: any, force?: boolean, format?: string): void;
    unAssign(thing: any): void;
    addSound(name: string, complete?: Function): void;
    playSS(track: number, subscene: number, start: number, stop?: number, wrap?: number, qStart?: number, qStop?: number): void;
    playSSFast(track: number, subscene: number, start: number, stop?: number, speed?: number, wrap?: number, qStart?: number, qStop?: number): void;
    playFunction(track: number, func: Function, start: number, stop?: number, speed?: number, wrap?: number, qStart?: number, qStop?: number): void;
    playWaitTrack(track: number, track_to_wait_for: number): void;
    playPause(track: number, time: number): void;
    playSound(track: number, name: string, tracked?: boolean): void;
    flushTrack(track: number, kill?: boolean): void;
    evaluate();
    mapEventFun(name: string, fun: Function): pimDirector;
    raiseEvent(name: string, args: any[]): boolean;
    stereo(mode: stereoMode, interPupilDistance: number, fov: number): void;

    // events
    onLoad: Function;
    onMouse: Function;
    onFrame: Function;
    onPostFrame: Function;
}

interface pimFontMesh {
    constructor();

    // methods
    Start(fontclip: any, objectInstance: any, surface: any, lines: number, cols: number, max: number): pimFontMesh;
    SetText(str: string): pimFontMesh;
    SetTextS(input: string): pimFontMesh;
    SetRC(newLines: number, newColumns: number): pimFontMesh;
    SetSqueezeRatio(squeezeRatio: number): pimFontMesh;
    SetAlign(): pimFontMesh;
    SetLineSpace(lineSpace: number): pimFontMesh;
    SetFontClip(newFont: any): pimFontMesh;
    GetProps(): string;
    GetText(): string;
}

interface pimSurface {
    constructor(mixin?: any);

    // data members
    diffuse: number;
    luminosity: number;
    color: number[];
    transparency: number;
    specular: number;
    glossiness: number;
    additiveTransparency: number;
    splines: string;

    // methods
    loadImage(url: string): void;
}

interface pimParticle {
    constructor(object: pimObjectInstance, mixin: any);

    //data members
    spinTable: any;

    // methods
    Update(): void;
    driverLoad(): void;
    customRender(): void;
    emit(x: number): pimParticle;
    emitAt(x: number, Inst: pimInstance): pimParticle;
    UpdateEmitter(): void;
    intersect(obj: pimObjectInstance): number;
}

interface pimProgress {
    constructor(guessedtotal?: number);

    // methods
    onprogress(loaded: number, total: number): void;
    link(): void;
}

interface countingCompleter {
    constructor();

    // methods
    link(ref?: boolean): void;
    wait(func: Function): void;
}

interface pimVerlet {
    constructor();

    // methods
    beginCluster(): number;
    addPoint(pos: vec3, mass?: number, lastPos?: vec3): void;
    debug(): void;
    addStick(): void;
    addMinDist(): void;
    addMaxDist(): void;
    addMaxAngle(): void;
    addMinAngle(): void;
    addSphere(): void;
    addCapsule(): void;
    addConvex(): void;
    addCube(): void;
    forces(): void;
    solver(): void;
    markDead(): void;
    run(): void;
}
