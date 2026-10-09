/* ==========================================================================
   Fluid — a tiny WebGL "liquid" gradient used behind the hero and footer.
   Domain-warped noise, tinted with the brand colours, gently pulled
   toward the pointer. No dependencies.
   ========================================================================== */

(function () {
  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform vec2  uRes;
    uniform float uTime;
    uniform vec2  uMouse;
    uniform float uHover;
    uniform vec3  uBg;
    uniform vec3  uC1;
    uniform vec3  uC2;
    uniform vec3  uC3;
    uniform vec2  uFocus;
    uniform float uSpread;

    vec2 hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(dot(hash(i), f), dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
        mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = m * p;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      float aspect = uRes.x / uRes.y;
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);
      vec2 focus = (uFocus - 0.5) * vec2(aspect, 1.0);

      float t = uTime * 0.07;

      // pointer pull
      float d = length(p - m);
      float pull = exp(-d * d * 5.0) * (0.35 + uHover * 0.45);
      p += (m - p) * pull * 0.25;

      vec2 q = vec2(
        fbm(p * 1.3 + vec2(0.0, t)),
        fbm(p * 1.3 + vec2(5.2, -t * 0.8))
      );
      vec2 r = vec2(
        fbm(p * 1.5 + 2.2 * q + vec2(1.7, 9.2) + t * 1.2 + pull),
        fbm(p * 1.5 + 2.2 * q + vec2(8.3, 2.8) - t * 0.9)
      );
      float f = fbm(p * 1.1 + 2.4 * r);

      // where the liquid lives on screen
      float mask = smoothstep(uSpread, 0.0, length((p - focus) * vec2(0.75, 1.0)));

      vec3 col = uBg;
      float violet = smoothstep(0.0, 0.9, length(q) * 1.3) ;
      col = mix(col, uC2, violet * 0.75 * mask);
      float hot = smoothstep(0.05, 0.55, f * 1.6 + r.x * 0.5);
      col = mix(col, uC1, hot * mask);
      float glint = smoothstep(0.55, 0.95, f + length(r) * 0.45);
      col = mix(col, uC3, glint * 0.45 * mask);

      // soft glow under the pointer
      col += uC1 * exp(-d * d * 9.0) * (0.10 + uHover * 0.12);

      // ribbons / contour lines for an "artistic" feel
      float bands = abs(fract(f * 7.0 + t) - 0.5);
      col += smoothstep(0.03, 0.0, bands) * 0.05 * mask;

      // grain
      float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * 0.05;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  class Fluid {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.opts = Object.assign(
        {
          bg: "#0c0c0d",
          c1: "#ff4d1f",
          c2: "#6b5bff",
          c3: "#f1ede6",
          focus: [0.7, 0.35],
          spread: 1.15,
          scale: 0.5,
          static: false,
        },
        opts
      );
      this.mouse = { x: 0.6, y: 0.5, tx: 0.6, ty: 0.5 };
      this.hover = 0;
      this.hoverTarget = 0;
      this.running = false;
      this.time = Math.random() * 100;
      this.last = performance.now();

      const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
      if (!gl) {
        canvas.classList.add("is-fallback");
        return;
      }
      this.gl = gl;

      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.useProgram(prog);
      this.prog = prog;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const u = (n) => gl.getUniformLocation(prog, n);
      this.u = {
        res: u("uRes"), time: u("uTime"), mouse: u("uMouse"), hover: u("uHover"),
        bg: u("uBg"), c1: u("uC1"), c2: u("uC2"), c3: u("uC3"),
        focus: u("uFocus"), spread: u("uSpread"),
      };
      gl.uniform3fv(this.u.bg, hexToRgb(this.opts.bg));
      gl.uniform3fv(this.u.c1, hexToRgb(this.opts.c1));
      gl.uniform3fv(this.u.c2, hexToRgb(this.opts.c2));
      gl.uniform3fv(this.u.c3, hexToRgb(this.opts.c3));
      gl.uniform2fv(this.u.focus, this.opts.focus);
      gl.uniform1f(this.u.spread, this.opts.spread);

      this.resize = this.resize.bind(this);
      this.loop = this.loop.bind(this);
      this.resize();
      window.addEventListener("resize", this.resize);

      if (!this.opts.static) {
        window.addEventListener("pointermove", (e) => {
          const rect = this.canvas.getBoundingClientRect();
          this.mouse.tx = (e.clientX - rect.left) / rect.width;
          this.mouse.ty = 1 - (e.clientY - rect.top) / rect.height;
        });
      }

      this.render();
    }

    resize() {
      if (!this.gl) return;
      // the effect is soft, so render at CSS-pixel density (or lower) for speed
      const dpr = Math.min(window.devicePixelRatio || 1, 1);
      const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr * this.opts.scale));
      const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr * this.opts.scale));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
      }
      this.gl.uniform2f(this.u.res, w, h);
      if (!this.running) this.render();
    }

    setHover(v) {
      this.hoverTarget = v;
    }

    render() {
      const gl = this.gl;
      if (!gl) return;
      gl.uniform1f(this.u.time, this.time);
      gl.uniform2f(this.u.mouse, this.mouse.x, this.mouse.y);
      gl.uniform1f(this.u.hover, this.hover);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    loop(now) {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      this.time += dt;
      this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.04;
      this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.04;
      this.hover += (this.hoverTarget - this.hover) * 0.05;
      this.render();
      requestAnimationFrame(this.loop);
    }

    start() {
      if (!this.gl || this.running || this.opts.static) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.loop);
    }

    stop() {
      this.running = false;
    }
  }

  window.Fluid = Fluid;
})();
