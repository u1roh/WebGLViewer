import init, { add, greet, accept_array, gen_array } from "./wasmlib.js";

// Copyright (c) 2019 u_1roh

class Vec3 {
    x: number; y: number; z: number;
    constructor(x: number, y: number, z: number) {
        this.x = x; this.y = y; this.z = z;
    }
    static zero() { return new Vec3(0, 0, 0); }
    static ex() { return new Vec3(1, 0, 0); }
    static ey() { return new Vec3(0, 1, 0); }
    static ez() { return new Vec3(0, 0, 1); }
    clone() {
        return new Vec3(this.x, this.y, this.z);
    }
    lengthSquared(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }
    length(): number {
        return Math.sqrt(this.lengthSquared());
    }
    neg(): Vec3 {
        return new Vec3(-this.x, -this.y, -this.z);
    }
    add(v: Vec3): Vec3 {
        return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
    }
    sub(v: Vec3): Vec3 {
        return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
    }
    mul(scalar: number): Vec3 {
        return new Vec3(scalar * this.x, scalar * this.y, scalar * this.z);
    }
    cross(v: Vec3): Vec3 {
        return new Vec3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x);
    }
}

class Sphere {
    center: Vec3;
    radius: number;
    constructor(center: Vec3, radius: number) {
        this.center = center;
        this.radius = radius;
    }
}

class Interval {
    lower: number;
    upper: number;
    constructor(lower: number, upper: number) {
        this.lower = lower;
        this.upper = upper;
    }
    width(): number {
        return this.upper - this.lower;
    }
    center(): number {
        return (this.lower + this.upper) / 2;
    }
}

class Box3 {
    x: Interval;
    y: Interval;
    z: Interval;
    constructor(x: Interval, y: Interval, z: Interval) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    lower(): Vec3 {
        return new Vec3(this.x.lower, this.y.lower, this.z.lower);
    }
    upper(): Vec3 {
        return new Vec3(this.x.upper, this.y.upper, this.z.upper);
    }
    center(): Vec3 {
        return new Vec3(this.x.center(), this.y.center(), this.z.center());
    }
    boundingSphere(): Sphere {
        const center = this.center();
        const radius = this.upper().sub(center).length();
        return new Sphere(center, radius);
    }
    static boundaryOf(points: Float32Array): Box3 {
        let box = new Box3(
            new Interval(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
            new Interval(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
            new Interval(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY));
        for (let i = 0; i < points.length; ++i) {
            let r: Interval|null = null;
            switch(i % 3) {
                case 0: r = box.x; break;
                case 1: r = box.y; break;
                case 2: r = box.z; break;
            }
            if (r != null) {
                if (points[i] < r.lower) r.lower = points[i];
                if (points[i] > r.upper) r.upper = points[i];
            }
        }
        return box;
    }
}

class Quaternion {
    w: number;
    x: number;
    y: number;
    z: number;
    constructor(w: number, x: number, y: number, z: number) {
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
    }
    clone() {
        return new Quaternion(this.w, this.x, this.y, this.z);
    }
    conjugate(): Quaternion {
        return new Quaternion(this.w, -this.x, -this.y, -this.z);
    }
    mul(q: Quaternion): Quaternion {
        return new Quaternion(
            this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
            this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
            this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
            this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w);
    }
}

class Rotation {
    private q: Quaternion;
    constructor(q: Quaternion) {
        this.q = q;
    }
    static ofAxis(axis: Vec3, radian: number): Rotation {
        let c = Math.cos(0.5 * radian);
        let s = Math.sin(0.5 * radian) / axis.length();
        if (!isFinite(s)) s = 0;
        return new Rotation(new Quaternion(c, s * axis.x, s * axis.y, s * axis.z));
    }
    static unit() {
        return new Rotation(new Quaternion(1, 0, 0, 0));
    }
    u() { return this.transform(Vec3.ex()); }
    v() { return this.transform(Vec3.ey()); }
    n() { return this.transform(Vec3.ez()); }
    clone() {
        return new Rotation(this.q.clone());
    }
    transform(p: Vec3): Vec3 {
        const q = this.q.mul(new Quaternion(1, p.x, p.y, p.z)).mul(this.q.conjugate());
        return new Vec3(q.x, q.y, q.z);
    }
    inverse(): Rotation {
        return new Rotation(this.q.conjugate());
    }
    mul(r: Rotation): Rotation {
        return new Rotation(this.q.mul(r.q));
    }
    toMatrix(): number[] {
        const q = this.q;

        const ww = q.w * q.w;
        const xx = q.x * q.x;
        const yy = q.y * q.y;
        const zz = q.z * q.z;

        const wx = q.w * q.x;
        const wy = q.w * q.y;
        const wz = q.w * q.z;

        const xy = q.x * q.y;
        const yz = q.y * q.z;
        const zx = q.z * q.x;

        return [
            ww + xx - yy - zz, 2 * (xy + wz), 2 * (zx - wy), 0,
            2 * (xy - wz), ww - xx + yy - zz, 2 * (yz + wx), 0,
            2 * (zx + wy), 2 * (yz - wx), ww - xx - yy + zz, 0,
            0, 0, 0, 1
        ];
    }
}

class RigidTrans {
    r: Rotation;
    t: Vec3; // translation
    constructor(r: Rotation, t: Vec3) {
        this.r = r;
        this.t = t;
    }
    static unit() {
        return new RigidTrans(Rotation.unit(), Vec3.zero());
    }
    clone() {
        return new RigidTrans(this.r.clone(), this.t.clone());
    }
    transform(p: Vec3): Vec3 {
        return this.r.transform(p).add(this.t);
    }
    inverse(): RigidTrans {
        const r = this.r.inverse();
        const v = r.transform(this.t).neg();
        return new RigidTrans(r, v);
    }
    toMatrix(): number[] {
        let mat = this.r.toMatrix();
        mat[12] = this.t.x;
        mat[13] = this.t.y;
        mat[14] = this.t.z;
        return mat;
    }
}


class Camera {
    private static orthoMatrix(volume: Box3) {
        const c = volume.center();
        const w = volume.x.upper - c.x;
        const h = volume.y.upper - c.y;
        const d = volume.z.upper - c.z;
        return [
            1 / w, 0, 0, 0,
            0, 1 / h, 0, 0,
            0, 0, 1 / d, 0,
            -c.x / w, -c.y / w, -c.z / d, 1
        ];
    }
    private static makeProjMatrix(depth: Interval, scale: number, canvasWidth: number, canvasHeight: number) {
        const [w, h] = (canvasWidth < canvasHeight) ?
            [scale, scale * canvasHeight / canvasWidth] :
            [scale * canvasWidth / canvasHeight, scale];
        const volume = new Box3(
            new Interval(-w, w),
            new Interval(-h, h),
            depth);
        return this.orthoMatrix(volume);
    }

    focus: RigidTrans;
    scale: number;
    modelViewMatrix: number[];
    projectionMatrix: number[];
    constructor(focus: RigidTrans, scale: number) {
        this.focus = focus;
        this.scale = scale;
        this.modelViewMatrix = [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
        this.projectionMatrix = [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }
    fit(world: Sphere) {
        this.focus.t = world.center;
        this.scale = world.radius;
    }
    update(world: Sphere, canvasWidth: number, canvasHeight: number) {
        const inv = this.focus.inverse();
        const center = inv.transform(world.center);
        const depth = new Interval(center.z - world.radius, center.z + world.radius);
        this.modelViewMatrix = inv.toMatrix();
        this.projectionMatrix = Camera.makeProjMatrix(depth, this.scale, canvasWidth, canvasHeight);
    }
}

interface Drawable {
    draw(camera: Camera): void;
    boundingSphere(): Sphere;
}

interface DrawableSource {
    createDrawer(gl: WebGLRenderingContext): Drawable;
}

class Viewer {
    canvas: HTMLCanvasElement;
    gl: WebGLRenderingContext;
    camera = new Camera(RigidTrans.unit(), 1.0);
    scene: Drawable | null = null;
    world: Sphere = new Sphere(Vec3.zero(), 1.0);
    constructor(canvas: HTMLCanvasElement, useWebGL2: boolean) {
        const gl = <WebGLRenderingContext>canvas.getContext(useWebGL2 ? "webgl2" : "webgl");
        this.canvas = canvas;
        this.gl = gl;

        gl.clearColor(0.3, 0.3, 0.3, 1);

        // Projection Matrix で視線方向を反転させていないので（つまり右手系のままなので）、
        // 通常の OpenGL と違ってデプス値はゼロで初期化して depthFunc を GL_GREATER にする。
        gl.clearDepth(0.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.GREATER);

        canvas.oncontextmenu = function() { return false; };    // disable context menu
        canvas.addEventListener("mousedown", e => {
            const scale = this.camera.scale;
            const focus = this.camera.focus.clone();
            const lengthPerPixel = this.lengthPerPixel();
            const [x0, y0] = [e.offsetX, e.offsetY];
            const onMouseMove = (e: MouseEvent) => {
                const dx = e.offsetX - x0;
                const dy = e.offsetY - y0;
                const move = focus.r.transform(new Vec3(lengthPerPixel * dx, -lengthPerPixel * dy, 0));
                if (e.shiftKey) {
                    this.camera.focus.t = focus.t.sub(move);
                }
                else if(e.ctrlKey) {
                    const y = Math.abs(dy) / 40;
                    const factor = dy > 0 ? 1.0 / (1 + y) : 1 + y;
                    this.camera.scale = factor * scale;
                }
                else {
                    const axis = move.cross(focus.r.n());
                    const radian = move.length() / this.camera.scale;
                    this.camera.focus.r = Rotation.ofAxis(axis, radian).mul(focus.r);
                }
                this.render();
            };
            const onMouseUp = (e: MouseEvent) => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
        canvas.addEventListener("wheel", e => {
            const y = 0.1 * Math.abs(e.deltaY) / 100;
            const factor = e.deltaY > 0 ? 1 / (1 + y) : 1 + y;
            this.camera.scale *= factor;
            this.render();
        });
    }
    setScene(source: DrawableSource) {
        this.scene = source.createDrawer(this.gl);
        this.world = this.scene.boundingSphere();
    }
    fit() {
        this.camera.fit(this.world);
    }
    render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.camera.update(this.world, this.canvas.width, this.canvas.height);
        if (this.scene != null) {
            this.scene.draw(this.camera);
        }
    }
    lengthPerPixel() {
        return 2 * this.camera.scale / Math.min(this.canvas.width, this.canvas.height);
    }
    resize(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.render();
    }
    resizeToWindow() {
        const rect = this.canvas.getBoundingClientRect();
        const margin = rect.left;
        this.resize(window.innerWidth - 2 * margin, window.innerHeight - rect.top - margin);
   }
}

function buildShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
    const shader = gl.createShader(type);
    if (shader == null) throw new Error("shader is null");

    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    console.log(gl.getShaderInfoLog(shader));
    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("compile error");

    return shader;
}

function createProgram(gl: WebGLRenderingContext, srcV: string, srcF: string): WebGLProgram {
    const shaderV = buildShader(gl, gl.VERTEX_SHADER, srcV);
    const shaderF = buildShader(gl, gl.FRAGMENT_SHADER, srcF);
    const program = gl.createProgram();
    if (program == null) throw new Error("program is null");

    gl.attachShader(program, shaderV);
    gl.attachShader(program, shaderF);
    gl.linkProgram(program);

    console.log(gl.getProgramInfoLog(program));
    if(!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Link Error");

    return program;
}

class TrianglesDrawerProgram {
    private static registry = new Map<WebGLRenderingContext, TrianglesDrawerProgram>();
    static get(gl: WebGLRenderingContext) {
        let instance = this.registry.get(gl);
        if(instance == undefined) {
            instance = new TrianglesDrawerProgram(gl, useWebGL2);
            this.registry.set(gl, instance);
        }
        return instance;
    }

    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private atrPosition: number;
    private atrNormal: number;
    private uniModelViewMatrix: WebGLUniformLocation;
    private uniProjMatrix: WebGLUniformLocation;
    constructor(gl: WebGLRenderingContext, useWebGL2: boolean) {
        this.gl = gl;
        this.program = createProgram(
            gl,
            document.getElementById(useWebGL2 ? "vs2" : "vs")!.textContent!,
            document.getElementById(useWebGL2 ? "fs2" : "fs")!.textContent!);
        this.atrPosition = gl.getAttribLocation(this.program, "position");
        this.atrNormal = gl.getAttribLocation(this.program, "normal");
        this.uniModelViewMatrix = gl.getUniformLocation(this.program, "modelViewMatrix")!;
        this.uniProjMatrix = gl.getUniformLocation(this.program, "projMatrix")!;
    }
    createBuffer(data: Float32Array): WebGLBuffer {
        const buf = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
        return buf!;
    }
    draw(camera: Camera, points: WebGLBuffer, normals: WebGLBuffer, count: number) {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uniModelViewMatrix, false, camera.modelViewMatrix);
        gl.uniformMatrix4fv(this.uniProjMatrix, false, camera.projectionMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, points);
        gl.enableVertexAttribArray(this.atrPosition);
        gl.vertexAttribPointer(this.atrPosition, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, normals);
        gl.enableVertexAttribArray(this.atrNormal);
        gl.vertexAttribPointer(this.atrNormal, 3, gl.FLOAT, true, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, count);
    }
}

class TrianglesDrawer implements Drawable {
    private program: TrianglesDrawerProgram;
    private count: number;
    private points: WebGLBuffer;
    private normals: WebGLBuffer;
    private boundary: Sphere;
    constructor(program: TrianglesDrawerProgram, points: Float32Array, normals: Float32Array) {
        if (points.length != normals.length) throw new Error("points.length != normals.length");
        this.program = program;
        this.count = points.length / 3;
        this.points = program.createBuffer(points);
        this.normals = program.createBuffer(normals);
        this.boundary = Box3.boundaryOf(points).boundingSphere();
    }
    draw(camera: Camera) {
        this.program.draw(camera, this.points, this.normals, this.count);
    }
    boundingSphere(): Sphere {
        return this.boundary;
    }
}

class Triangles implements DrawableSource {
    private points: Float32Array;
    private normals: Float32Array;
    constructor(points: Float32Array, normals: Float32Array) {
        this.points = points;
        this.normals = normals;
    }
    createDrawer(gl: WebGLRenderingContext) {
        return new TrianglesDrawer(TrianglesDrawerProgram.get(gl), this.points, this.normals);
    }
}

namespace ArrayBuf {
    export function readFile(file: File): Promise<ArrayBuffer> {
        return new Promise<ArrayBuffer>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(<ArrayBuffer>reader.result);
            reader.readAsArrayBuffer(file);
        });
    }
    export function readURL(url: string): Promise<ArrayBuffer> {
        return new Promise<ArrayBuffer>(resolve => {
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'arraybuffer';
            xhr.open("GET", url, true);
            xhr.onreadystatechange = e => {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    resolve(<ArrayBuffer>xhr.response);
                }
            };
            xhr.send(null);
        });
    }
}

namespace STLFormat {
    function readBuf(data: ArrayBuffer) {
        const isLittleEndian = true;
        const view = new DataView(data);
        const ntris = view.getUint32(80, true); // little endian を指定する必要あり
        const points = new Float32Array(3 * 3 * ntris);
        const normals = new Float32Array(3 * 3 * ntris);
        for (let i = 0; i < ntris; ++i) {
            let pos = 84 + i * 50;
            const read = function() { pos += 4; return view.getFloat32(pos - 4, isLittleEndian); }
            const nx = read();
            const ny = read();
            const nz = read();
            for (let k = 0; k < 3; ++k) {
                const idx = 3 * (3 * i + k);
                normals[idx + 0] = nx;
                normals[idx + 1] = ny;
                normals[idx + 2] = nz;
                points[idx + 0] = read();
                points[idx + 1] = read();
                points[idx + 2] = read();
            }
        }
        return new Triangles(points, normals);
    }

    export async function readFile(file: File): Promise<Triangles> {
        const buf = await ArrayBuf.readFile(file);
        return readBuf(buf);
    }

    export async function readURL(url: string) {
        const buf = await ArrayBuf.readURL(url);
        return readBuf(buf);
    }
}

const useWebGL2 = false;
const viewer = new Viewer(<HTMLCanvasElement>document.getElementById("glview"), useWebGL2);
viewer.resizeToWindow();

STLFormat.readURL("sample.stl").then(tris => {
    viewer.setScene(tris);
    viewer.fit();
    viewer.render();
});

window.addEventListener("resize", _ => viewer.resizeToWindow());
document.getElementById("import")!.addEventListener("change", e => {
    const files = (<HTMLInputElement>e.target).files;
    if (files != null && files.length >= 1) {
        STLFormat.readFile(files[0]).then(tris => {
            viewer.setScene(tris);
            viewer.fit();
            viewer.render();
        });
    }
});


viewer.render();
/*
let time = 0;
setInterval(() => {
    viewer.camera.focus.r = Rotation.ofAxis(new Vec3(0.3, 1, 0), time * 0.01 * Math.PI);
    viewer.render();
    ++time;
}, 30);
*/

document.getElementById("wasmtest")!.addEventListener("click", e => {
    init().then(() => {
        alert("30 + 40 = " + add(30, 40));
        greet();
        accept_array(new Float32Array([1, 2, 3, 4, 5, 6]));
        console.dir(gen_array());
    });
});