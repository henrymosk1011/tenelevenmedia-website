/* ==========================================================================
   TENELEVENMEDIA /next: the 3D film
   --------------------------------------------------------------------------
   One fixed WebGL canvas behind the page. Everything on it is driven by a
   single number, the scene time T, which main.js derives from the scroll
   position: chapter k of the page spans T = k .. k+1.

     0 Intro     liquid chrome core, orbit rings, TENELEVEN wordmark
     1 Studio    the core burns away into a spiralling particle tunnel
     2 Rhythm    the particles fall into glowing sound wave ridgelines
     3 Work      a corridor of floating project screens
     4 Services  particles assemble a shape for each service
     5 Process   a dial that fills as the steps go by
     6 Contact   the core re-forms, molten orange, inside a corona

   About 40k particles morph between ten formations on the GPU; only two
   formations are bound at a time (from / to) and swapped as T moves on.
   ========================================================================== */

import * as THREE from "../vendor/three/three.module.min.js";
import { WORK_PAD, workTime, workHalf } from "./timeline.js";

// Colours are written straight to the screen as sRGB values (no colour
// management), so what you see in a shader matches the CSS hex codes.
THREE.ColorManagement.enabled = false;

const rgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export const PAL = {
  ink: rgb("#0c0c0d"),
  bone: rgb("#f1ede6"),
  accent: rgb("#ff4d1f"),
  violet: rgb("#6b5bff"),
  ember: rgb("#ffb36b"),
  lilac: rgb("#b7aeff"),
  deep: rgb("#1a1440"),
};

export const STAGE = new THREE.Vector3(0, 0, -152);
const TAU = Math.PI * 2;


/* ==========================================================================
   Keyframe tracks: monotone cubic (Fritsch Carlson) so values glide through
   keys without overshooting. Holds are just two equal keys.
   ========================================================================== */
class Track {
  constructor(keys) {
    const n = keys.length;
    this.t = keys.map((k) => k[0]);
    this.v = keys.map((k) => k[1]);
    const d = [];
    for (let i = 0; i < n - 1; i++) d[i] = (this.v[i + 1] - this.v[i]) / Math.max(1e-6, this.t[i + 1] - this.t[i]);
    const m = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    this.m = m;
    this.i = 0;
  }
  at(x) {
    const t = this.t, n = t.length;
    if (n === 1 || x <= t[0]) return this.v[0];
    if (x >= t[n - 1]) return this.v[n - 1];
    let i = this.i;
    if (!(x >= t[i] && x <= t[i + 1])) { i = 0; while (i < n - 2 && x > t[i + 1]) i++; this.i = i; }
    const h = t[i + 1] - t[i], s = (x - t[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * this.v[i] + (s3 - 2 * s2 + s) * h * this.m[i] +
      (-2 * s3 + 3 * s2) * this.v[i + 1] + (s3 - s2) * h * this.m[i + 1];
  }
}
class VTrack {
  constructor(keys) {
    this.c = [0, 1, 2].map((j) => new Track(keys.map((k) => [k[0], k[1][j]])));
  }
  at(x, out) { return out.set(this.c[0].at(x), this.c[1].at(x), this.c[2].at(x)); }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ==========================================================================
   GLSL
   ========================================================================== */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/* ---------- background sky ---------- */
const SKY_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const SKY_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uT;
uniform vec3 uBase; uniform vec3 uGlowA; uniform vec3 uGlowB; uniform float uGlow;
varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p=p*2.03+7.1; a*=0.5; } return v; }
void main(){
  float asp = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(asp, 1.0);
  float t = uTime * 0.03;
  float n = fbm(p * 1.6 + vec2(t, uT * 0.35));
  float n2 = fbm(p * 2.4 - vec2(uT * 0.25, t * 1.3) + n);
  vec3 col = uBase;
  float ga = smoothstep(1.05, 0.0, length(p - vec2(-0.55 * asp * 0.6, 0.35) + (n2 - 0.5) * 0.6));
  float gb = smoothstep(1.0, 0.0, length(p - vec2(0.6 * asp * 0.6, -0.4) - (n - 0.5) * 0.7));
  col += uGlowA * ga * ga * 0.5 * uGlow;
  col += uGlowB * gb * gb * 0.38 * uGlow;
  float vig = smoothstep(1.25, 0.25, length(p * vec2(0.85, 1.0)));
  col *= mix(0.55, 1.0, vig);
  col += (h21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}`;

/* ---------- liquid chrome core ---------- */
const BLOB_VERT = /* glsl */ `
uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uTwist;
varying vec3 vN; varying vec3 vView; varying vec3 vObj; varying float vDisp;
${NOISE}
float disp(vec3 p){
  float t = uTime * 0.22;
  float n = snoise(p * uFreq + vec3(0.0, t, t * 0.7));
  n += 0.3 * snoise(p * uFreq * 2.3 - vec3(t * 0.8, 0.0, t));
  return n * uAmp;
}
vec3 twist(vec3 p){ float a = p.y * uTwist + sin(uTime * 0.3) * 0.2; float c = cos(a), s = sin(a); return vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z); }
void main(){
  vec3 n = normalize(position);
  float r = length(position);
  vec3 tg = normalize(cross(n, abs(n.y) > 0.99 ? vec3(1.0,0.0,0.0) : vec3(0.0,1.0,0.0)));
  vec3 bt = cross(n, tg);
  float e = 0.012;
  vec3 n1 = normalize(n + tg * e), n2 = normalize(n + bt * e);
  float d0 = disp(n * r);
  vec3 p0 = twist(n * (r + d0));
  vec3 p1 = twist(n1 * (r + disp(n1 * r)));
  vec3 p2 = twist(n2 * (r + disp(n2 * r)));
  vec3 nn = normalize(cross(p1 - p0, p2 - p0));
  if (dot(nn, p0) < 0.0) nn = -nn;
  vDisp = d0;
  vObj = position;
  vN = normalize(normalMatrix * nn);
  vec4 mv = modelViewMatrix * vec4(p0, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const BLOB_FRAG = /* glsl */ `
precision highp float;
uniform float uTime; uniform float uDissolve; uniform float uMolten; uniform float uFade;
uniform vec3 uBone; uniform vec3 uAccent; uniform vec3 uViolet; uniform vec3 uEmber;
varying vec3 vN; varying vec3 vView; varying vec3 vObj; varying float vDisp;
${NOISE}
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(-vView);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  vec3 r = reflect(-v, n);

  // a little photo studio, reflected: two soft boxes, a key light, coloured fills
  float box1 = smoothstep(0.09, 0.02, abs(r.y - 0.42)) * smoothstep(-0.7, -0.1, r.x) * smoothstep(0.95, 0.5, r.x);
  float box2 = smoothstep(0.06, 0.015, abs(r.x + 0.62)) * smoothstep(-0.3, 0.4, r.y);
  float key = pow(max(dot(r, normalize(vec3(0.5, 0.75, 0.6))), 0.0), 60.0);
  float horizon = smoothstep(-0.03, 0.03, r.y);
  vec3 env = mix(vec3(0.015, 0.012, 0.02), vec3(0.07, 0.065, 0.085), horizon);
  env += uBone * (box1 * 1.15 + box2 * 0.8 + key * 2.0);
  env += uAccent * smoothstep(0.0, 0.95, r.x) * smoothstep(0.6, -0.4, r.y) * 1.25;
  env += uViolet * smoothstep(0.05, 0.95, -r.x) * 1.15;
  env += uViolet * smoothstep(0.2, -0.9, r.y) * 0.35;

  vec3 irid = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + fres * 0.9 + vDisp * 1.6 + uTime * 0.015));
  vec3 col = env * mix(vec3(1.0), irid * 1.3, 0.28);
  col += fres * mix(uViolet, uAccent, 0.5 + 0.5 * r.x) * 0.55;

  // molten finale: the same studio, glowing from inside
  float heat = smoothstep(-0.25, 0.3, vDisp);
  vec3 hot = mix(vec3(0.22, 0.025, 0.01), uAccent, heat);
  hot = mix(hot, uEmber, smoothstep(0.18, 0.42, vDisp) * 0.8);
  hot *= 0.55 + 0.6 * ndv;
  hot += uBone * (box1 * 0.75 + box2 * 0.35 + key * 1.8);
  hot += fres * mix(uAccent, uEmber, 0.4) * 1.1;
  col = mix(col, hot, uMolten);

  // burn away
  float dn = snoise(vObj * 2.1 + vec3(0.0, uTime * 0.05, 0.0)) * 0.5 + 0.5;
  if (dn < uDissolve * 1.08 - 0.02) discard;
  float edge = 1.0 - smoothstep(0.0, 0.05, dn - (uDissolve * 1.08 - 0.02));
  col = mix(col, mix(uAccent, uEmber, edge * edge) * 1.6, edge * step(0.002, uDissolve));

  gl_FragColor = vec4(col * uFade, 1.0);
}`;

/* ---------- orbit rings ---------- */
const RING_VERT = /* glsl */ `
varying float vA;
void main(){ vA = atan(position.y, position.x); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAG = /* glsl */ `
precision highp float;
uniform float uTime; uniform float uOpacity; uniform float uSpeed; uniform vec3 uColor; uniform vec3 uHot;
varying float vA;
void main(){
  float a = fract(vA / 6.28318 - uTime * uSpeed);
  float comet = pow(a, 10.0);
  vec3 col = mix(uColor * 0.4, uHot, comet);
  gl_FragColor = vec4(col, (0.28 + comet * 0.9) * uOpacity);
}`;

/* ---------- text planes (wordmark) ---------- */
const TEXT_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TEXT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
varying vec2 vUv;
void main(){ float a = texture2D(uMap, vUv).a; gl_FragColor = vec4(uColor, a * uOpacity); }`;

/* ---------- particles ---------- */
const PTS_VERT = /* glsl */ `
uniform float uTime; uniform float uMorph; uniform float uSize; uniform float uDpr; uniform float uOpacity;
uniform float uFlight; uniform float uDrift; uniform float uWave; uniform float uDial; uniform float uFill;
uniform float uSpin; uniform float uPulse; uniform vec3 uStage;
uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uHot; uniform vec3 uDim;
attribute vec4 aFrom; attribute vec4 aTo; attribute vec4 aRand;
varying vec3 vColor; varying float vAlpha;
${NOISE}
void main(){
  float delay = aRand.x * 0.42;
  float m = smoothstep(delay, delay + 0.58, uMorph);
  vec3 p = mix(aFrom.xyz, aTo.xyz, m);
  float aux = mix(aFrom.w, aTo.w, m);

  // fly along curved, noisy paths between formations
  float flight = sin(m * 3.14159);
  vec3 q = aFrom.xyz * 0.08 + aRand.yzw * 4.0;
  vec3 swirl = vec3(snoise(q + vec3(0.0, 0.0, uTime * 0.05)), snoise(q + vec3(31.4, 0.0, 0.0)), snoise(q + vec3(0.0, 17.7, 0.0)));
  p += swirl * flight * uFlight;

  // idle breathing
  float tt = uTime * 0.6;
  p += vec3(sin(tt + aRand.y * 6.28), cos(tt * 0.83 + aRand.z * 6.28), sin(tt * 0.71 + aRand.w * 6.28)) * uDrift * (0.4 + aRand.x);

  // sound wave ridgelines (Rhythm)
  float crest = 0.0;
  if (uWave > 0.001) {
    float row = p.z;
    float env = exp(-p.x * p.x / 7.0) + 0.05;
    float n = snoise(vec3(p.x * 0.5, row * 0.37, uTime * 0.45)) * 0.5 + 0.5;
    n += 0.18 * snoise(vec3(p.x * 1.5, row * 0.8, uTime * 0.9));
    float beat = 0.72 + 0.28 * sin(uTime * 3.4 - row * 0.45);
    float h = pow(max(n, 0.0), 2.2) * env * 2.3 * beat + sin(p.x * 2.4 + uTime * 2.2 + row * 1.3) * 0.025;
    p.y += h * uWave;
    crest = clamp(h / 1.1, 0.0, 1.0) * uWave;
  }

  // spin shapes on the stage
  if (abs(uSpin) > 0.0001) {
    vec3 d = p - uStage;
    float w = smoothstep(8.0, 4.0, length(d));
    float a = uSpin * w, c = cos(a), s = sin(a);
    d.xz = mat2(c, -s, s, c) * d.xz;
    p = uStage + d;
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;

  vec3 col = mix(uColA, uColB, aRand.z);
  col = mix(col, uHot, crest);
  float filled = step(aux, uFill + 0.0005);
  col = mix(col, mix(uDim, uHot, filled), uDial);
  vColor = col;

  float bright = 0.35 + 0.65 * aRand.w;
  bright *= 1.0 + crest * 1.2 + uDial * filled * 0.6;
  float near = smoothstep(0.25, 1.6, depth);
  float far = smoothstep(70.0, 28.0, depth);
  vAlpha = uOpacity * bright * near * far * (1.0 + uPulse * 0.35 * sin(uTime * 2.4 + aRand.y * 6.28));

  float size = uSize * (0.45 + aRand.y * 1.1) * (1.0 + crest * 0.8);
  gl_PointSize = clamp(size * uDpr / max(depth, 0.1), 0.0, 42.0 * uDpr);
  gl_Position = projectionMatrix * mv;
}`;
const PTS_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  if (a * vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

/* ---------- distant stars ---------- */
const STAR_VERT = /* glsl */ `
uniform float uTime; uniform float uDpr; uniform float uOpacity;
attribute float aSeed;
varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = -mv.z;
  float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.4) + aSeed * 40.0);
  vAlpha = tw * uOpacity * smoothstep(0.5, 6.0, depth) * smoothstep(160.0, 60.0, depth) * (0.25 + 0.75 * aSeed);
  gl_PointSize = clamp((10.0 + aSeed * 18.0) * uDpr / max(depth, 0.1), 0.0, 4.0 * uDpr);
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor; varying float vAlpha;
void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uColor, a * vAlpha); }`;

/* ---------- project screens ---------- */
const SCREEN_VERT = /* glsl */ `
uniform float uTime; uniform float uVel; uniform float uCurve; uniform float uHover;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  p.z -= uCurve * p.x * p.x;
  p.z += sin(p.x * 2.2 + uTime * 1.6) * 0.06 * uVel;
  p.y += sin(p.x * 1.4 + uTime * 1.1) * 0.03 * uVel;
  p *= 1.0 + uHover * 0.025;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const SCREEN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex; uniform float uOpacity; uniform float uVel; uniform float uHover;
uniform float uWin; uniform float uScroll; uniform float uFlipV; uniform vec2 uSize; uniform vec3 uAccent;
uniform float uTime;
varying vec2 vUv;
float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main(){
  vec2 p = (vUv - 0.5) * uSize;
  float d = rbox(p, uSize * 0.5, 0.07);
  float mask = 1.0 - smoothstep(-0.004, 0.004, d);
  if (mask * uOpacity < 0.003) discard;

  // window into the (possibly full length) screenshot, scrolled by uScroll
  float top = uScroll * (1.0 - uWin);
  float y = top + (1.0 - vUv.y) * uWin;
  vec2 tuv = vec2(vUv.x, mix(1.0 - y, y, uFlipV));
  float shift = clamp(uVel, -2.0, 2.0) * 0.006;
  vec3 col;
  col.r = texture2D(uTex, tuv + vec2(shift, 0.0)).r;
  col.g = texture2D(uTex, tuv).g;
  col.b = texture2D(uTex, tuv - vec2(shift, 0.0)).b;

  // glass sheen and a soft accent rim
  float sheen = smoothstep(0.35, 0.0, abs(vUv.x - vUv.y * 0.6 - fract(uTime * 0.04) * 2.0 + 0.6)) * 0.07;
  col += sheen;
  float rim = smoothstep(-0.05, 0.0, d);
  col = mix(col, uAccent, rim * (0.35 + uHover * 0.65));
  col *= 0.92 + uHover * 0.08;
  gl_FragColor = vec4(col, mask * uOpacity);
}`;

/* ==========================================================================
   Formations (each a Float32Array of xyz + aux per particle)
   ========================================================================== */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFormations(N) {
  const R = rng(1011);
  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = R();
    while (!v) v = R();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  const S = STAGE;
  const make = (fn) => {
    const a = new Float32Array(N * 4);
    const o = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
      o[3] = 0;
      fn(i, o);
      a[i * 4] = o[0]; a[i * 4 + 1] = o[1]; a[i * 4 + 2] = o[2]; a[i * 4 + 3] = o[3];
    }
    return a;
  };
  // sample points along a set of polylines, evenly by length
  const sampler = (lines) => {
    const segs = [];
    let total = 0;
    for (const pts of lines) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0));
        total += len;
        segs.push([a, b, total]);
      }
    }
    return (o, jitter) => {
      const r = R() * total;
      let lo = 0, hi = segs.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (segs[mid][2] < r) lo = mid + 1; else hi = mid; }
      const [a, b] = segs[lo];
      const t = R();
      o[0] = a[0] + (b[0] - a[0]) * t + gauss() * jitter;
      o[1] = a[1] + (b[1] - a[1]) * t + gauss() * jitter;
      o[2] = (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * t + gauss() * jitter;
    };
  };
  const rect = (x0, y0, x1, y1, z, r = 0) => {
    if (!r) return [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]];
    const pts = [];
    const corner = (cx, cy, a0) => { for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]); } };
    corner(x1 - r, y0 + r, -Math.PI / 2);
    corner(x1 - r, y1 - r, 0);
    corner(x0 + r, y1 - r, Math.PI / 2);
    corner(x0 + r, y0 + r, Math.PI);
    pts.push(pts[0]);
    return pts;
  };
  const rot = (o, ax, ay) => {
    let [x, y, z] = o;
    let c = Math.cos(ax), s = Math.sin(ax);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(ay); s = Math.sin(ay);
    [x, z] = [x * c + z * s, -x * s + z * c];
    o[0] = x; o[1] = y; o[2] = z;
  };
  const toStage = (o) => { o[0] += S.x; o[1] += S.y; o[2] += S.z; };

  const F = [];

  // 0 sphere: the surface of the chrome core
  F.push(make((i, o) => {
    const u = R() * 2 - 1, ph = R() * TAU, s = Math.sqrt(1 - u * u), r = 1.25 + gauss() * 0.025;
    o[0] = s * Math.cos(ph) * r; o[1] = u * r; o[2] = s * Math.sin(ph) * r;
  }));

  // 1 tunnel: hoops and five spiral arms running away from the camera
  F.push(make((i, o) => {
    const t = R();
    let z = 1.5 - Math.pow(t, 0.9) * 46;
    const k = R();
    let a, r;
    if (k < 0.12) { a = R() * TAU; r = 3.4 + R() * 5; }
    else if (k < 0.4) { z = -1.5 - Math.floor(R() * 14) * 3.2 + gauss() * 0.03; a = R() * TAU; r = 2.75 + gauss() * 0.035; }
    else { a = ((i % 5) * TAU) / 5 + z * 0.24 + gauss() * 0.07; r = 2.2 + gauss() * 0.1; }
    o[0] = Math.cos(a) * r; o[1] = Math.sin(a) * r; o[2] = z;
    o[3] = t;
  }));

  // 2 ridgelines: rows of points that the shader turns into sound waves
  // (few rows, very dense, so each one reads as a continuous line)
  const rows = 26, perRow = Math.floor(N / rows);
  F.push(make((i, o) => {
    const row = Math.min(rows - 1, Math.floor(i / perRow));
    o[0] = -9.5 + R() * 19; o[1] = -2.6; o[2] = -43 - row * 1.05;
  }));

  // 3 dust: a big volume around the work corridor, clear of the camera path
  F.push(make((i, o) => {
    let x = (R() * 2 - 1) * 11, y = (R() * 2 - 1) * 6.5;
    const z = -60 - R() * 84;
    const r = Math.hypot(x / 1.6, y / 1.1);
    if (r < 1.6) { const k = 1.6 / Math.max(r, 0.05); x *= k; y *= k; }
    o[0] = x; o[1] = y; o[2] = z;
  }));

  // 4 web design: an exploded browser window
  {
    const z0 = -0.5, z1 = 0.0, z2 = 0.45;
    const lines = [
      rect(-1.7, -1.15, 1.7, 1.15, z0, 0.12),
      [[-1.7, 0.82, z0], [1.7, 0.82, z0]],
      rect(-1.45, 0.08, 1.45, 0.66, z1, 0.05),
      rect(-1.45, -0.92, -0.55, -0.12, z1, 0.05),
      rect(-0.45, -0.92, 0.45, -0.12, z1, 0.05),
      rect(0.55, -0.92, 1.45, -0.12, z1, 0.05),
      [[-1.25, 0.5, z2], [0.35, 0.5, z2]],
      [[-1.25, 0.36, z2], [-0.05, 0.36, z2]],
      rect(-1.25, 0.14, -0.6, 0.26, z2, 0.06),
      [[-1.25, -0.3, z2], [-0.75, -0.3, z2]],
      [[-0.25, -0.3, z2], [0.25, -0.3, z2]],
      [[0.75, -0.3, z2], [1.25, -0.3, z2]],
    ];
    const along = sampler(lines);
    F.push(make((i, o) => {
      const k = R();
      if (k < 0.06) {
        const dot = Math.floor(R() * 3);
        o[0] = -1.45 + dot * 0.17 + gauss() * 0.02; o[1] = 0.98 + gauss() * 0.02; o[2] = z0 + gauss() * 0.01;
      } else if (k < 0.2) {
        const c = Math.floor(R() * 3);
        o[0] = -1.4 + c * 1.0 + R() * 0.8; o[1] = -0.87 + R() * 0.7; o[2] = z1 - 0.02;
      } else {
        along(o, 0.01);
      }
      rot(o, 0.12, -0.3);
      toStage(o);
    }));
  }

  // 5 development: a torus knot
  F.push(make((i, o) => {
    const t = R() * TAU, p = 2, q = 3;
    const r = Math.cos(q * t) + 2.2;
    o[0] = r * Math.cos(p * t) * 0.52 + gauss() * 0.09;
    o[1] = r * Math.sin(p * t) * 0.52 + gauss() * 0.09;
    o[2] = -Math.sin(q * t) * 0.62 + gauss() * 0.09;
    rot(o, 0.35, 0.2);
    toStage(o);
  }));

  // 6 branding: the studio's ✺ mark as a 16 point starburst
  F.push(make((i, o) => {
    if (R() < 0.14) {
      const a = R() * TAU, r = Math.sqrt(R()) * 0.32;
      o[0] = Math.cos(a) * r; o[1] = Math.sin(a) * r; o[2] = gauss() * 0.05;
    } else {
      const k = Math.floor(R() * 16), a = (k / 16) * TAU;
      const t = R();
      const len = 0.38 + t * 1.42;
      const w = 0.15 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.8) + 0.012;
      const side = (R() * 2 - 1) * w;
      const lx = len, ly = side;
      o[0] = Math.cos(a) * lx - Math.sin(a) * ly;
      o[1] = Math.sin(a) * lx + Math.cos(a) * ly;
      o[2] = gauss() * 0.04 + (1 - t) * 0.08 * Math.sin(k);
    }
    rot(o, 0.0, 0.0);
    toStage(o);
  }));

  // 7 launch and security: a shield with a check mark
  {
    const outline = [];
    const W = 1.15, TOP = 1.3, SIDE = 0.15, TIP = -1.6;
    for (let k = 0; k <= 24; k++) { const x = -W + (k / 24) * 2 * W; outline.push([x, TOP + 0.13 * (x / W) * (x / W)]); }
    for (let k = 1; k <= 8; k++) outline.push([W, TOP + 0.13 - (k / 8) * (TOP + 0.13 - SIDE)]);
    for (let k = 1; k <= 24; k++) { const t = k / 24, u = 1 - t; outline.push([u * u * W + 2 * u * t * W * 0.95 + t * t * 0, u * u * SIDE + 2 * u * t * -1.0 + t * t * TIP]); }
    for (let k = 1; k <= 24; k++) { const t = k / 24, u = 1 - t; outline.push([-(t * t * W + 2 * u * t * W * 0.95), t * t * SIDE + 2 * u * t * -1.0 + u * u * TIP]); }
    for (let k = 1; k <= 8; k++) outline.push([-W, SIDE + (k / 8) * (TOP + 0.13 - SIDE)]);
    const bulge = (x) => 0.28 * (1 - (x / W) * (x / W));
    const ring = (s) => outline.map(([x, y]) => [x * s, y * s + (1 - s) * 0.05, bulge(x * s) + 0.01]);
    const check = [[-0.48, 0.02, 0.32], [-0.12, -0.38, 0.32], [0.55, 0.5, 0.32]];
    const edge = sampler([ring(1), ring(0.82)]);
    const tick = sampler([check]);
    const inside = (x, y) => {
      let c = false;
      for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
        const [xa, ya] = outline[a], [xb, yb] = outline[b];
        if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) c = !c;
      }
      return c;
    };
    F.push(make((i, o) => {
      const k = R();
      if (k < 0.6) edge(o, 0.018);
      else if (k < 0.8) tick(o, 0.035);
      else {
        let x, y, n = 0;
        do { x = (R() * 2 - 1) * W; y = TIP + R() * (TOP + 0.13 - TIP); n++; } while (!inside(x, y) && n < 30);
        o[0] = x; o[1] = y; o[2] = bulge(x) - 0.05 + gauss() * 0.02;
      }
      rot(o, -0.08, 0.0);
      toStage(o);
    }));
  }

  // 8 process dial: ring, ticks and four nodes; aux = angle (clockwise from the top)
  F.push(make((i, o) => {
    const k = R();
    let a, r, z = gauss() * 0.03;
    if (k < 0.46) { a = R() * TAU; r = 2.3 + gauss() * 0.035; }
    else if (k < 0.6) { const tick = Math.floor(R() * 60); a = (tick / 60) * TAU; r = 2.55 + R() * (tick % 5 === 0 ? 0.28 : 0.13); }
    else if (k < 0.74) { const node = Math.floor(R() * 4); const s = Math.sqrt(R()) * 0.16, b = R() * TAU; a = (node / 4) * TAU; const nx = Math.sin(a) * 2.3 + Math.cos(b) * s, ny = Math.cos(a) * 2.3 + Math.sin(b) * s; o[0] = nx; o[1] = ny; o[2] = z; o[3] = node / 4; toStage(o); return; }
    else { a = R() * TAU; r = 1.2 + Math.pow(R(), 0.6) * 2.1; z = gauss() * 0.12; }
    o[0] = Math.sin(a) * r; o[1] = Math.cos(a) * r; o[2] = z;
    o[3] = a / TAU;
    toStage(o);
  }));

  // 9 corona: a shell and flares around the re-formed core
  {
    const dirs = [];
    for (let k = 0; k < 46; k++) { const u = R() * 2 - 1, ph = R() * TAU, s = Math.sqrt(1 - u * u); dirs.push([s * Math.cos(ph), u, s * Math.sin(ph)]); }
    F.push(make((i, o) => {
      const k = R();
      if (k < 0.42) {
        const u = R() * 2 - 1, ph = R() * TAU, s = Math.sqrt(1 - u * u), r = 1.12 + Math.abs(gauss()) * 0.18;
        o[0] = s * Math.cos(ph) * r; o[1] = u * r; o[2] = s * Math.sin(ph) * r;
      } else if (k < 0.86) {
        const d = dirs[Math.floor(R() * dirs.length)], t = Math.pow(R(), 1.8), r = 1.15 + t * 4.2, j = 0.03 + t * 0.22;
        o[0] = d[0] * r + gauss() * j; o[1] = d[1] * r + gauss() * j; o[2] = d[2] * r + gauss() * j;
      } else {
        const u = R() * 2 - 1, ph = R() * TAU, s = Math.sqrt(1 - u * u), r = 2.5 + R() * 6;
        o[0] = s * Math.cos(ph) * r; o[1] = u * r; o[2] = s * Math.sin(ph) * r;
      }
      toStage(o);
    }));
  }

  return F;
}

/* ==========================================================================
   Covers for projects without a screenshot (and while one loads)
   ========================================================================== */
function coverTexture(p, i, n) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 640;
  const g = c.getContext("2d");
  const accent = p.accent || "#ff4d1f";
  const grd = g.createLinearGradient(0, 0, 1024, 640);
  grd.addColorStop(0, accent);
  grd.addColorStop(1, "#141416");
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "rgba(12,12,13,0.92)";
  g.font = '800 110px Geist, system-ui, sans-serif';
  g.textBaseline = "bottom";
  g.fillText(p.title, 56, 580, 912);
  g.font = '500 26px "JetBrains Mono", monospace';
  g.textBaseline = "top";
  g.fillText(`${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}  ${(p.category || "").toUpperCase()}`, 60, 52);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

/* ==========================================================================
   The scene
   ========================================================================== */
export function createScene({ canvas, projects, asset, tier = "high" }) {
  const high = tier === "high";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: high, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(new THREE.Color(...PAL.ink), 1);

  const maxDpr = high ? 1.75 : 1.5;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 320);
  const v3 = (a) => new THREE.Vector3(...a);
  const u = (v) => ({ value: v });

  /* ---------- sky ---------- */
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, depthTest: false, depthWrite: false,
      uniforms: { uRes: u(new THREE.Vector2(1, 1)), uTime: u(0), uT: u(0), uBase: u(v3(PAL.ink)), uGlowA: u(v3(PAL.violet)), uGlowB: u(v3(PAL.accent)), uGlow: u(1) },
    })
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  /* ---------- stars ---------- */
  const starCount = high ? 2600 : 1200;
  const starGeo = new THREE.BufferGeometry();
  {
    const R = rng(77), pos = new Float32Array(starCount * 3), seed = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const a = R() * TAU, r = 8 + Math.pow(R(), 0.7) * 60;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(a) * r * 0.7; pos[i * 3 + 2] = 30 - R() * 250;
      seed[i] = R();
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  }
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: u(0), uDpr: u(dpr), uOpacity: u(0.8), uColor: u(v3(PAL.bone)) },
  }));
  stars.frustumCulled = false;
  scene.add(stars);

  /* ---------- wordmark ---------- */
  const wmCanvas = document.createElement("canvas");
  wmCanvas.width = 2048; wmCanvas.height = 420;
  const wmTex = new THREE.CanvasTexture(wmCanvas);
  wmTex.anisotropy = 4;
  const drawWordmark = () => {
    const g = wmCanvas.getContext("2d");
    g.clearRect(0, 0, 2048, 420);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '900 380px Geist, "Helvetica Neue", Arial, sans-serif';
    g.letterSpacing = "-12px";
    const w = g.measureText("TENELEVEN").width;
    const s = Math.min(1, 1980 / w);
    g.setTransform(s, 0, 0, 1, 1024, 0);
    g.fillText("TENELEVEN", 0, 228);
    g.setTransform(1, 0, 0, 1, 0, 0);
    wmTex.needsUpdate = true;
  };
  drawWordmark();
  if (document.fonts) document.fonts.load('900 100px Geist').then(drawWordmark).catch(() => {});
  const wordmark = new THREE.Mesh(
    new THREE.PlaneGeometry(10.6, 10.6 * (420 / 2048)),
    new THREE.ShaderMaterial({
      vertexShader: TEXT_VERT, fragmentShader: TEXT_FRAG, transparent: true, depthWrite: false,
      uniforms: { uMap: u(wmTex), uColor: u(v3(PAL.bone)), uOpacity: u(1) },
    })
  );
  wordmark.position.set(0, -0.15, -2.8);
  scene.add(wordmark);

  /* ---------- chrome core ---------- */
  const blobGeo = new THREE.SphereGeometry(1.25, high ? 200 : 120, high ? 140 : 84);
  const blobMat = new THREE.ShaderMaterial({
    vertexShader: BLOB_VERT, fragmentShader: BLOB_FRAG,
    uniforms: {
      uTime: u(0), uAmp: u(0.2), uFreq: u(0.85), uTwist: u(0.3), uDissolve: u(0), uMolten: u(0), uFade: u(1),
      uBone: u(v3(PAL.bone)), uAccent: u(v3(PAL.accent)), uViolet: u(v3(PAL.violet)), uEmber: u(v3(PAL.ember)),
    },
  });
  const blob = new THREE.Mesh(blobGeo, blobMat);
  scene.add(blob);

  /* ---------- orbit rings ---------- */
  const rings = new THREE.Group();
  const ringDefs = [
    { r: 1.95, rx: 1.25, ry: 0.25, speed: 0.11, color: PAL.bone, hot: PAL.accent },
    { r: 2.35, rx: 1.75, ry: -0.5, speed: -0.07, color: PAL.lilac, hot: PAL.bone },
    { r: 2.8, rx: 1.05, ry: 0.9, speed: 0.05, color: PAL.bone, hot: PAL.violet },
  ];
  for (const d of ringDefs) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(d.r, high ? 0.0055 : 0.008, 6, 320),
      new THREE.ShaderMaterial({
        vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: u(0), uOpacity: u(1), uSpeed: u(d.speed), uColor: u(v3(d.color)), uHot: u(v3(d.hot)) },
      })
    );
    m.rotation.set(d.rx, d.ry, 0);
    m.userData.spin = d.speed * 1.4;
    rings.add(m);
  }
  scene.add(rings);

  /* ---------- particles ---------- */
  const N = high ? 42000 : 18000;
  const formations = buildFormations(N).map((a) => new THREE.BufferAttribute(a, 4));
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  {
    const R = rng(4242), rnd = new Float32Array(N * 4);
    for (let i = 0; i < N * 4; i++) rnd[i] = R();
    pGeo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 4));
  }
  let fromIdx = -1;
  const bindFormations = (k) => {
    if (k === fromIdx) return;
    fromIdx = k;
    pGeo.setAttribute("aFrom", formations[k]);
    pGeo.setAttribute("aTo", formations[Math.min(k + 1, formations.length - 1)]);
  };
  bindFormations(0);
  const pMat = new THREE.ShaderMaterial({
    vertexShader: PTS_VERT, fragmentShader: PTS_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: u(0), uMorph: u(0), uSize: u(18), uDpr: u(dpr), uOpacity: u(0),
      uFlight: u(1.5), uDrift: u(0.04), uWave: u(0), uDial: u(0), uFill: u(0), uSpin: u(0), uPulse: u(0),
      uStage: u(STAGE.clone()),
      uColA: u(v3(PAL.bone)), uColB: u(v3(PAL.accent)), uHot: u(v3(PAL.accent)), uDim: u(v3(mixc(PAL.ink, PAL.bone, 0.22))),
    },
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);

  /* ---------- project screens ---------- */
  const SW = 2.88, SH = 1.8;
  const screenGeo = new THREE.PlaneGeometry(SW, SH, 36, 22);
  const screens = projects.map((p, i) => {
    const cover = coverTexture(p, i, projects.length);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG, transparent: true,
      uniforms: {
        uTex: u(cover), uOpacity: u(0), uVel: u(0), uHover: u(0), uCurve: u(0.05),
        uWin: u(1), uScroll: u(0), uFlipV: u(0), uSize: u(new THREE.Vector2(SW, SH)),
        uAccent: u(v3(rgb(p.accent || "#ff4d1f"))), uTime: u(0),
      },
    });
    const mesh = new THREE.Mesh(screenGeo, mat);
    mesh.userData = { index: i, project: p, hover: 0, full: null, fullState: 0 };
    scene.add(mesh);
    return mesh;
  });
  const maxTex = renderer.capabilities.maxTextureSize;

  // posters load straight away (they are small); full length captures only on demand
  const loader = new THREE.TextureLoader();
  screens.forEach((m) => {
    const src = m.userData.project.poster;
    if (!src) return;
    loader.load(asset(src), (tex) => {
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      if (m.userData.fullState !== 2) { m.material.uniforms.uTex.value = tex; m.material.uniforms.uWin.value = 1; m.material.uniforms.uFlipV.value = 0; }
      m.userData.poster = tex;
    });
  });
  const canFull = high && typeof createImageBitmap === "function";
  const loadFull = (m) => {
    const ud = m.userData;
    const src = ud.project.full;
    if (!canFull || !src || ud.fullState) return;
    ud.fullState = 1;
    fetch(asset(src))
      .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
      .then((b) => createImageBitmap(b).then((probe) => {
        const w = Math.min(1024, probe.width), h = Math.min(maxTex, Math.round((probe.height * w) / probe.width));
        probe.close && probe.close();
        return createImageBitmap(b, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
      }))
      .then((bmp) => {
        const tex = new THREE.Texture(bmp);
        tex.flipY = false;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.needsUpdate = true;
        ud.full = tex;
        ud.fullState = 2;
        ud.fullAspect = bmp.height / bmp.width;
        const uni = m.material.uniforms;
        uni.uTex.value = tex;
        uni.uFlipV.value = 1;
        uni.uWin.value = Math.min(1, (SH / SW) / ud.fullAspect);
      })
      .catch(() => { ud.fullState = 3; });
  };
  const dropFull = (m) => {
    const ud = m.userData;
    if (ud.fullState !== 2) return;
    const uni = m.material.uniforms;
    if (ud.poster) { uni.uTex.value = ud.poster; uni.uWin.value = 1; uni.uFlipV.value = 0; }
    else return; // keep the full capture rather than fall back to the generated cover
    ud.full.dispose();
    ud.full.image.close && ud.full.image.close();
    ud.full = null;
    ud.fullState = 0;
  };

  /* ==========================================================================
     Layout + keyframes (rebuilt on resize, because the framing depends on
     the shape of the screen)
     ========================================================================== */
  let L = null;
  let tracks = null;
  const n = projects.length;

  function build(aspect) {
    const portrait = aspect < 0.82;
    const fov = portrait ? 52 : aspect < 1.2 ? 46 : 40;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    // distance at which something `w` wide fills `share` of the width
    const fitW = (w, share) => w / share / (2 * tanH * aspect);
    const fitH = (h, share) => h / share / (2 * tanH);
    const hero = Math.max(fitH(3.3, 0.5), fitW(3.3, portrait ? 0.86 : 0.4));
    const stage = portrait ? Math.max(fitW(3.6, 0.8), fitH(3.6, 0.42)) : Math.max(fitH(3.6, 0.62), fitW(3.6, 0.36));
    const dial = portrait ? Math.max(fitW(5.6, 0.74), fitH(5.6, 0.36)) : Math.max(fitH(5.6, 0.78), fitW(5.6, 0.42));
    const screenDist = portrait ? fitW(SW, 0.9) : Math.max(fitH(SH, 0.5), fitW(SW, 0.48));
    const sx = portrait ? 0 : 1.15 + Math.max(0, aspect - 1.6) * 0.5;
    const ox = portrait ? 0 : Math.min(2.2, 1.35 + (aspect - 1.2) * 0.6);
    // on tall screens the 3D sits in the upper part, above the text
    const oyAt = (d) => (portrait ? -2 * d * tanH * 0.17 : 0);
    const wordScale = Math.min(1.6, (2 * tanH * aspect * (hero + 2.8)) * 0.92 / 10.6);
    const core = portrait ? Math.max(fitW(2.5, 0.5), fitH(2.5, 0.22)) : fitH(2.5, 0.22);
    L = { portrait, fov, hero, stage, dial, screenDist, sx, ox, wordScale, core };
    camera.fov = fov;
    wordmark.scale.setScalar(wordScale);

    const S = STAGE;
    const sp = (dx, dy, dz) => [S.x + dx, S.y + dy, S.z + dz];
    const cam = [], tgt = [];
    const key = (t, p, q) => { cam.push([t, p]); tgt.push([t, q]); };

    // intro and dive
    key(0.0, [0, 0, hero], [0, portrait ? -0.3 : 0, 0]);
    key(0.5, [0.55, 0.18, hero * 0.78], [0, 0, 0]);
    key(0.95, [0, 0, 2.3], [0, 0, -6]);
    // tunnel
    key(1.5, [0, 0, -15], [0, 0, -25]);
    key(1.95, [0, 0.2, -33], [0, -0.4, -43]);
    // ridgelines
    key(2.42, [0, -0.3, -37.5], [0, portrait ? -3.4 : -1.75, -54]);
    key(2.86, [0, -0.65, -40], [0, portrait ? -3.2 : -1.6, -58]);

    // work: arrive at each screen, linger, move on
    const W0 = -68, GAP = 7.5;
    L.screens = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const sxi = side * sx, syi = portrait ? 0.32 : (i % 3 - 1) * 0.12, szi = W0 - i * GAP;
      L.screens.push({ x: sxi, y: syi, z: szi, rotY: portrait ? 0 : -side * 0.3 });
      const tc = 3 + workTime(i, n), hw = workHalf(n);
      const cx = portrait ? 0 : -side * 0.18, cy = portrait ? 0 : syi * 0.4;
      const tx = portrait ? 0 : side * 0.55;
      const ty = portrait ? 0 : syi * 0.5;
      key(tc - hw * 0.5, [cx, cy, szi + screenDist + 0.55], [tx, ty, szi - 4]);
      key(tc + hw * 0.5, [cx, cy, szi + screenDist - 0.45], [tx, ty, szi - 4]);
    }
    if (n === 0) key(3.5, [0, 0, -80], [0, 0, -100]);
    key(3 + 1 - WORK_PAD * 0.4, [0, 0.4, W0 - (n - 1) * GAP - 4], [0, 0, S.z]);

    // services: a slow drift around the stage
    key(4.04, sp(-0.9, 0.45, stage), sp(-ox, oyAt(stage), 0));
    key(4.96, sp(0.9, -0.15, stage * 0.96), sp(-ox, oyAt(stage), 0));
    // process dial
    key(5.08, sp(0.9, 0.7, dial), sp(-ox * 1.2, oyAt(dial) * 1.25, 0));
    key(5.94, sp(-0.5, -0.3, dial * 0.95), sp(-ox * 1.2, oyAt(dial) * 1.25, 0));
    // contact: settle in front of the re-formed core
    key(6.3, sp(0, 0.35, core * 1.25), sp(0, 0, 0));
    key(7.0, sp(0, 0, core), sp(0, 0, 0));

    // morph index: holds on whole numbers, glides in between
    const M = [
      [0, 0], [0.62, 0], [1.18, 1], [1.9, 1], [2.32, 2], [2.88, 2], [3.12, 3], [3.93, 3], [4.06, 4],
      [4.19, 4], [4.31, 5], [4.44, 5], [4.56, 6], [4.69, 6], [4.81, 7], [4.97, 7], [5.12, 8], [5.94, 8], [6.22, 9], [7, 9],
    ];

    // per chapter colours (A, B, hot)
    const col = (t, a, b, h) => [t, a, b, h];
    const C = [
      col(0.0, PAL.bone, PAL.accent, PAL.accent),
      col(1.15, PAL.violet, PAL.accent, PAL.ember),
      col(1.9, PAL.violet, PAL.lilac, PAL.ember),
      col(2.3, mixc(PAL.violet, PAL.bone, 0.25), PAL.lilac, PAL.accent),
      col(2.9, mixc(PAL.violet, PAL.bone, 0.25), PAL.lilac, PAL.accent),
      col(3.12, mixc(PAL.bone, PAL.ink, 0.35), PAL.violet, PAL.accent),
      col(3.93, mixc(PAL.bone, PAL.ink, 0.35), PAL.violet, PAL.accent),
      col(4.06, PAL.accent, PAL.ember, PAL.accent),
      col(4.19, PAL.accent, PAL.ember, PAL.accent),
      col(4.31, PAL.bone, mixc(PAL.bone, PAL.lilac, 0.5), PAL.bone),
      col(4.44, PAL.bone, mixc(PAL.bone, PAL.lilac, 0.5), PAL.bone),
      col(4.56, PAL.violet, PAL.lilac, PAL.violet),
      col(4.69, PAL.violet, PAL.lilac, PAL.violet),
      col(4.81, PAL.bone, PAL.accent, PAL.accent),
      col(4.97, PAL.bone, PAL.accent, PAL.accent),
      col(5.12, PAL.bone, PAL.lilac, PAL.accent),
      col(5.94, PAL.bone, PAL.lilac, PAL.accent),
      col(6.22, PAL.accent, PAL.ember, PAL.ember),
      col(7.0, PAL.accent, PAL.ember, PAL.ember),
    ];
    const sky = [
      [0.0, PAL.violet, PAL.accent, 1.0],
      [1.2, PAL.violet, PAL.deep, 0.75],
      [2.4, PAL.deep, PAL.violet, 0.8],
      [3.2, PAL.deep, PAL.accent, 0.55],
      [4.0, PAL.accent, PAL.violet, 0.7],
      [4.5, PAL.violet, PAL.deep, 0.75],
      [5.2, PAL.deep, PAL.accent, 0.6],
      [6.3, PAL.accent, PAL.violet, 1.1],
      [7.0, PAL.accent, PAL.violet, 1.2],
    ];

    tracks = {
      cam: new VTrack(cam),
      tgt: new VTrack(tgt),
      M: new Track(M),
      colA: new VTrack(C.map((c) => [c[0], c[1]])),
      colB: new VTrack(C.map((c) => [c[0], c[2]])),
      hot: new VTrack(C.map((c) => [c[0], c[3]])),
      skyA: new VTrack(sky.map((s) => [s[0], s[1]])),
      skyB: new VTrack(sky.map((s) => [s[0], s[2]])),
      glow: new Track(sky.map((s) => [s[0], s[3]])),
      roll: new Track([[0, 0], [1.0, 0], [1.45, 0.35], [1.9, -0.12], [2.3, 0], [7, 0]]),
      size: new Track([[0, 30], [0.9, 30], [1.3, 46], [1.9, 46], [2.35, 25], [2.9, 25], [3.2, 42], [3.9, 42], [4.1, 34], [5.0, 34], [5.15, 36], [6.1, 36], [6.3, 40], [7, 40]]),
      opacity: new Track([[0, 0], [0.55, 0], [0.8, 0.9], [1.3, 1.45], [1.9, 1.45], [2.3, 1.5], [2.6, 1.7], [2.9, 1.7], [3.2, 0.65], [3.9, 0.65], [4.1, 0.95], [6.1, 0.95], [6.4, 0.85], [7, 0.85]]),
      flight: new Track([[0, 2.2], [1.3, 2.2], [1.9, 3.5], [2.4, 3.5], [3.0, 5], [3.3, 5], [3.95, 3], [4.1, 0.9], [4.95, 0.9], [5.1, 1.6], [6, 1.6], [6.2, 2.4], [7, 2.4]]),
      drift: new Track([[0, 0.02], [1.2, 0.05], [1.95, 0.04], [2.3, 0.0], [2.95, 0.0], [3.15, 0.12], [3.9, 0.12], [4.05, 0.018], [5.0, 0.018], [5.2, 0.012], [6.0, 0.012], [6.3, 0.06], [7, 0.06]]),
      blobAmp: new Track([[0, 0.17], [0.45, 0.24], [0.95, 0.42], [6.05, 0.42], [6.6, 0.22], [7, 0.2]]),
      blobFreq: new Track([[0, 0.62], [0.45, 0.8], [0.95, 1.25], [6.05, 1.25], [6.6, 0.75], [7, 0.7]]),
      dissolve: new Track([[0, 0], [0.5, 0], [1.02, 1], [6.06, 1], [6.62, 0], [7, 0]]),
      rings: new Track([[0, 1], [0.3, 1], [0.75, 0], [6.25, 0], [6.7, 0.85], [7, 0.85]]),
      wordmark: new Track([[0, 1], [0.25, 0.92], [0.7, 0], [7, 0]]),
    };
  }

  /* ---------- sizing ---------- */
  let W = 1, H = 1;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (Math.abs(w - W) < 1 && Math.abs(h - H) < 1 && tracks) return;
    W = w; H = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    build(camera.aspect);
    camera.updateProjectionMatrix();
    sky.material.uniforms.uRes.value.set(W * dpr, H * dpr);
    pMat.uniforms.uDpr.value = dpr;
    stars.material.uniforms.uDpr.value = dpr;
    screens.forEach((m, i) => {
      const s = L.screens[i];
      m.position.set(s.x, s.y, s.z);
      m.rotation.set(0, s.rotY, 0);
    });
  }
  function setDpr(v) {
    if (Math.abs(v - dpr) < 0.01) return;
    dpr = v;
    W = H = 0;
    resize();
  }

  /* ---------- per frame ---------- */
  const tmp = new THREE.Vector3(), tgt = new THREE.Vector3(), camPos = new THREE.Vector3();
  const lookM = new THREE.Matrix4();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let hovered = -1;

  function update(T, time, dt, vel) {
    const tr = tracks;
    const U = pMat.uniforms;

    // camera
    tr.cam.at(T, camPos);
    tr.tgt.at(T, tgt);
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
    camPos.x += pointer.x * 0.22; camPos.y += pointer.y * 0.14;
    tgt.x += pointer.x * 0.08; tgt.y += pointer.y * 0.05;
    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(tgt);
    const roll = tr.roll.at(T);
    if (roll) camera.rotateZ(roll);
    camera.updateMatrixWorld();

    // sky
    const SU = sky.material.uniforms;
    SU.uTime.value = time; SU.uT.value = T;
    tr.skyA.at(T, SU.uGlowA.value); tr.skyB.at(T, SU.uGlowB.value); SU.uGlow.value = tr.glow.at(T);
    stars.material.uniforms.uTime.value = time;

    // morph
    const M = Math.max(0, Math.min(formations.length - 1, tr.M.at(T)));
    const k = Math.min(formations.length - 2, Math.floor(M));
    bindFormations(k);
    U.uMorph.value = M - k;
    const near = (i) => Math.max(0, 1 - Math.abs(M - i));
    U.uTime.value = time;
    U.uSize.value = tr.size.at(T) * (L.portrait ? 0.85 : 1);
    U.uOpacity.value = tr.opacity.at(T);
    U.uFlight.value = tr.flight.at(T);
    U.uDrift.value = tr.drift.at(T) + Math.min(0.25, Math.abs(vel) * 0.03) * (1 - near(2));
    U.uWave.value = near(2);
    U.uDial.value = near(8);
    U.uPulse.value = near(9);
    const services = smooth(3.95, 4.08, T) * (1 - smooth(4.95, 5.1, T));
    U.uSpin.value = services * (-0.55 * Math.cos(Math.PI * 4 * (T - 4)) + Math.sin(time * 0.35) * 0.12);
    U.uFill.value = clamp01((T - 5 - 0.06) / 0.84);
    tr.colA.at(T, U.uColA.value); tr.colB.at(T, U.uColB.value); tr.hot.at(T, U.uHot.value);
    points.visible = U.uOpacity.value > 0.001;

    // core (intro at the origin, finale on the stage)
    const finale = T > 4;
    const dis = tr.dissolve.at(T);
    blob.visible = dis < 0.999;
    rings.visible = tr.rings.at(T) > 0.002;
    if (blob.visible) {
      const B = blobMat.uniforms;
      B.uTime.value = time;
      B.uDissolve.value = dis;
      B.uAmp.value = tr.blobAmp.at(T);
      B.uFreq.value = tr.blobFreq.at(T);
      B.uMolten.value = finale ? 1 : 0;
      blob.position.copy(finale ? STAGE : tmp.set(0, 0, 0));
      blob.scale.setScalar(finale ? 0.78 : 1);
      blob.rotation.y = time * 0.12 + T * 1.3 + pointer.x * 0.3;
      blob.rotation.x = Math.sin(time * 0.2) * 0.15 + pointer.y * 0.2;
    }
    if (rings.visible) {
      const o = tr.rings.at(T);
      rings.position.copy(finale ? STAGE : tmp.set(0, 0, 0));
      rings.scale.setScalar(finale ? 0.8 : 1 + T * 0.35);
      rings.children.forEach((m) => {
        m.rotation.z = time * m.userData.spin;
        m.material.uniforms.uTime.value = time;
        m.material.uniforms.uOpacity.value = o;
      });
    }

    // wordmark
    const wo = tr.wordmark.at(T);
    wordmark.visible = wo > 0.002;
    wordmark.material.uniforms.uOpacity.value = wo;

    // screens
    const workOn = T > 2.55 && T < 4.2;
    const camZ = camPos.z;
    for (const m of screens) {
      const ud = m.userData;
      const dz = camZ - m.position.z;
      const o = workOn ? smooth(17, 7, dz) * smooth(0.8, 3.2, dz) : 0;
      m.visible = o > 0.003;
      ud.hover += ((hovered === ud.index ? 1 : 0) - ud.hover) * Math.min(1, dt * 8);
      const uni = m.material.uniforms;
      uni.uOpacity.value = o;
      uni.uTime.value = time;
      uni.uVel.value = Math.max(-2, Math.min(2, vel * 0.6));
      uni.uHover.value = ud.hover;
      // the screenshot scrolls as you fly past
      const tc = 3 + workTime(ud.index, n), hw = workHalf(n);
      uni.uScroll.value = smooth(tc - hw * 1.2, tc + hw * 1.1, T) * 0.85;
      if (workOn && Math.abs(T - tc) < hw * 2.6) loadFull(m);
      else if (Math.abs(T - tc) > hw * 4.5) dropFull(m);
    }

    renderer.render(scene, camera);
  }

  /* ---------- helpers for the page ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(x, y) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(screens.filter((m) => m.visible && m.material.uniforms.uOpacity.value > 0.5), false);
    hovered = hits.length ? hits[0].object.userData.index : -1;
    return hovered;
  }
  function setPointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; }
  // where a point of the stage lands on screen (for labels that sit on 3D things)
  function projectStage(dx = 0, dy = 0, dz = 0) {
    tmp.set(STAGE.x + dx, STAGE.y + dy, STAGE.z + dz).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H, behind: tmp.z > 1 };
  }

  resize();
  // compile every shader up front so nothing hitches mid scroll
  renderer.compile(scene, camera);

  return {
    update, resize, setDpr, pick, setPointer, projectStage,
    get dpr() { return dpr; }, maxDpr,
    get layout() { return L; },
  };
}
