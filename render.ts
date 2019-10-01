class Vec3 {
    x: number; y: number; z: number;
    constructor(x: number, y: number, z: number) {
        this.x = x; this.y = y; this.z = z;
    }
    static zero() { return new Vec3(0, 0, 0); }
    static ex() { return new Vec3(1, 0, 0); }
    static ey() { return new Vec3(0, 1, 0); }
    static ez() { return new Vec3(0, 0, 1); }
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
            let r: Interval = null;
            switch(i % 3) {
                case 0: r = box.x; break;
                case 1: r = box.y; break;
                case 2: r = box.z; break;
            }
            if (points[i] < r.lower) r.lower = points[i];
            if (points[i] > r.upper) r.upper = points[i];
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
    transform(p: Vec3): Vec3 {
        const q = this.q.mul(new Quaternion(1, p.x, p.y, p.z)).mul(this.q.conjugate());
        return new Vec3(q.x, q.y, q.z);
    }
    inverse(): Rotation {
        return new Rotation(this.q.conjugate());
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
            ww + xx - yy - zz, 2 * (xy - wz), 2 * (zx + wy), 0,
            2 * (xy + wz), ww - xx + yy - zz, 2 * (yz - wx), 0,
            2 * (zx - wy), 2 * (yz + wx), ww - xx - yy + zz, 0,
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
        mat[3]  = this.t.x;
        mat[7]  = this.t.y;
        mat[11] = this.t.z;
        return mat;
    }
}

function orthoProj(volume: Box3) {
    const c = volume.center();
    const w = volume.x.upper - c.x;
    const h = volume.y.upper - c.y;
    const d = volume.z.upper - c.z;
    return [
        1 / w, 0, 0, -c.x / w,
        0, 1 / h, 0, -c.y / h,
        0, 0, 1 / d, -c.z / d,
        0, 0, 0, 1
    ];
}

function makeProjMatrix(world: Sphere, scale: number, canvasWidth: number, canvasHeight: number) {
    const [w, h] = (canvasWidth > canvasHeight) ?
        [scale, scale * canvasHeight / canvasWidth] :
        [scale * canvasWidth / canvasHeight, scale];
    const volume = new Box3(
        new Interval(-w, w),
        new Interval(-h, h),
        new Interval(world.center.z - world.radius, world.center.z + world.radius));
    return orthoProj(volume);
}

class Camera {
    focus: RigidTrans;
    scale: number;
    modelViewMatrix: number[];
    projectionMatrix: number[];
    constructor(focus: RigidTrans, scale: number) {
        this.focus = focus;
        this.scale = scale;
    }
    fit(world: Sphere) {
        this.focus.t = world.center;
        this.scale = world.radius;
    }
    update(world: Sphere, canvasWidth: number, canvasHeight: number) {
        const inv = this.focus.inverse();
        const center = inv.transform(world.center);
        this.modelViewMatrix = inv.toMatrix();
        this.projectionMatrix = makeProjMatrix(new Sphere(center, world.radius), this.scale, canvasWidth, canvasHeight);
    }
}

const canvas = <HTMLCanvasElement>document.getElementById("glview");
const gl = <WebGLRenderingContext>canvas.getContext("webgl2");

function buildShader(type: number, src: string): WebGLShader {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    console.log(gl.getShaderInfoLog(shader));
    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("compile error");

    return shader;
}

function createProgram(srcV: string, srcF: string): WebGLProgram {
    const shaderV = buildShader(gl.VERTEX_SHADER, srcV);
    const shaderF = buildShader(gl.FRAGMENT_SHADER, srcF);
    const program = gl.createProgram();
    gl.attachShader(program, shaderV);
    gl.attachShader(program, shaderF);
    gl.linkProgram(program);

    console.log(gl.getProgramInfoLog(program));
    if(!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Link Error");

    return program;
}

interface Drawable {
    draw(camera: Camera): void;
}

class TrianglesDrawer implements Drawable {
    private static program = createProgram(
        document.getElementById("vs").textContent,
        document.getElementById("fs").textContent);
    private static atrPosition = gl.getAttribLocation(TrianglesDrawer.program, "position");
    private static atrNormal = gl.getAttribLocation(TrianglesDrawer.program, "normal");
    private static uniModelViewMatrix = gl.getUniformLocation(TrianglesDrawer.program, "modelViewMatrix");
    private static uniProjMatrix = gl.getUniformLocation(TrianglesDrawer.program, "projMatrix");

    private count: number;
    private points: WebGLBuffer;
    private normals: WebGLBuffer;
    private boundary: Sphere;

    constructor(points: Float32Array, normals: Float32Array) {
        if (points.length != normals.length) throw new Error("points.length != normals.length");
        this.count = points.length / 3;
        this.points = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.points);
        gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
        this.normals = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        this.boundary = Box3.boundaryOf(points).boundingSphere();
    }
    draw(camera: Camera) {
        gl.useProgram(TrianglesDrawer.program);
        gl.uniformMatrix4fv(TrianglesDrawer.uniModelViewMatrix, true, camera.modelViewMatrix);
        gl.uniformMatrix4fv(TrianglesDrawer.uniProjMatrix, true, camera.projectionMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.points);
        gl.enableVertexAttribArray(TrianglesDrawer.atrPosition);
        gl.vertexAttribPointer(TrianglesDrawer.atrPosition, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
        gl.enableVertexAttribArray(TrianglesDrawer.atrNormal);
        gl.vertexAttribPointer(TrianglesDrawer.atrNormal, 3, gl.FLOAT, true, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, this.count);
    }
    boundingSphere(): Sphere {
        return this.boundary;
    }
}

function importSTL(data: ArrayBuffer) {
    const isLittleEndian = true;
    const view = new DataView(data);
    const ntris = view.getUint32(80, true); // little endian を指定する必要あり
    console.log("ntris = " + ntris);
    const points = new Float32Array(3 * 3 * ntris);
    const normals = new Float32Array(3 * 3 * ntris);
    for (let i = 0; i < ntris; ++i) {
        let pos = 84 + i * 50;
        function read() { pos += 4; return view.getFloat32(pos - 4, isLittleEndian); }
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
    return new TrianglesDrawer(points, normals);
}

let drawer = new TrianglesDrawer(
    new Float32Array([
        0.0, 1.0, 0.0,
        -1.0, -1.0, 0.0,
        1.0, -1.0, 0.0
    ]),
    new Float32Array([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
    ])
);

let camera = new Camera(RigidTrans.unit(), 1.5);

document.getElementById("import").addEventListener("change", e => {
    const reader = new FileReader();
    reader.onload = () => {
        drawer = importSTL(<ArrayBuffer>reader.result);
        camera.fit(drawer.boundingSphere());
    };
    const file = (<HTMLInputElement>e.target).files[0];
    reader.readAsArrayBuffer(file);
}, false);


gl.clearColor(0.3, 0.3, 0.3, 1);

// Projection Matrix で視線方向を反転させていないので（つまり右手系のままなので）、
// 通常の OpenGL と違ってデプス値はゼロで初期化して depthFunc を GL_GREATER にする。
gl.clearDepth(0.0);
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.GREATER);

let time = 0;
setInterval(() => {
    camera.focus.r = Rotation.ofAxis(new Vec3(0.3, 1, 0), time * 0.01 * Math.PI);
    camera.update(drawer.boundingSphere(), canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawer.draw(camera);
    ++time;
}, 30);