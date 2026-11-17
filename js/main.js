/* ==========================================================================
   TENELEVENMEDIA: page controller
   Reads the scroll position, turns it into the film's scene time and keeps
   the text, the timeline HUD and the 3D scene in step. Also decides between
   the film and the still version of the page (see "Motion" below).
   ========================================================================== */

import { WORK_PAD, workTime, workHalf } from "./timeline.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = document.documentElement;
const SITE = window.SITE || {};
const SHOTS = window.SCREENSHOTS || {};

// Seconds the film takes when you press Play (and the HUD's running time).
const DURATION = 71;
// How quickly the 3D catches up with the scroll position. Higher is snappier;
// the text is always tied straight to the scrollbar.
const FOLLOW = 10;
// Touch screens: a flick glides on to the next moment of the film (a chapter,
// a project, a service, a step) and stops there, instead of the browser's
// momentum flinging past several chapters. The glide takes GLIDE_BASE seconds
// plus GLIDE_PER_SCREEN for every screen height it travels, up to GLIDE_MAX.
const GLIDE_BASE = 0.45;
const GLIDE_PER_SCREEN = 0.5;
const GLIDE_MAX = 2;

/* ---------- helpers ---------- */
const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url || ""; } };
const shotFor = (p) => {
  const s = p.image || SHOTS[slugify(p.title)] || "";
  return typeof s === "string" ? { poster: s, full: "" } : { poster: s.poster || "", full: s.full || "" };
};
const NEW_TAB = '<span class="sr-only"> (opens in a new tab)</span>';

const projects = (window.PROJECTS || []).map((p) => ({ ...p, slug: slugify(p.title), ...shotFor(p) }));
const n = projects.length;

/* ==========================================================================
   Content
   ========================================================================== */
function renderContent() {
  const email = SITE.email || "";
  $$("[data-email]").forEach((a) => { a.textContent = email; a.href = `mailto:${email}`; });
  $$("[data-email-link]").forEach((a) => (a.href = `mailto:${email}?subject=New%20project%20enquiry`));
  // the big call to action is an email link: say so in its name
  $$(".contact__cta").forEach((a) => a.setAttribute("aria-label", `Let's make something loud. Email ${email}`));

  const socials = SITE.socials || [];
  if (socials.length) {
    $$("[data-socials]").forEach((ul) => {
      ul.innerHTML = socials.map((s) => `<li><a class="link-underline" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}${NEW_TAB}</a></li>`).join("");
    });
    $$("[data-socials-wrap]").forEach((el) => (el.hidden = false));
  }
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  $$("[data-count]").forEach((el) => (el.textContent = `(${pad(n)})`));

  // projects: captions in the film, cards in the static version
  $("[data-work]").innerHTML = projects.map((p, i) => `
    <li class="proj" data-side="${i % 2 ? "right" : "left"}">
      <a class="proj__link" href="${esc(p.url)}" target="_blank" rel="noopener">
        ${p.poster ? `<img class="proj__img" src="${esc(p.poster)}" alt="" loading="lazy" decoding="async" width="1440" height="900" />` : ""}
        <span class="proj__mask"><span class="proj__num mono">${pad(i + 1)} / ${pad(n)}</span></span>
        <span class="proj__mask"><span class="proj__title">${esc(p.title)}</span></span>
        <span class="proj__mask"><span class="proj__meta mono">${esc(p.category)}${p.year ? ` · ${esc(p.year)}` : ""}</span></span>
        <span class="proj__mask"><span class="proj__visit mono">Visit ${esc(domainOf(p.url))} <span aria-hidden="true">↗</span>${NEW_TAB}</span></span>
      </a>
    </li>`).join("");
  $("[data-work-index]").innerHTML = projects.map((p, i) => `<li><button type="button" tabindex="-1" data-project="${i}" title="${esc(p.title)}">${pad(i + 1)}</button></li>`).join("");

  // the studio paragraph lights up word by word; screen readers get it as one sentence
  $$("[data-words]").forEach((el) => {
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = el.textContent.replace(/\s+/g, " ").trim();
    const shown = document.createElement("span");
    shown.setAttribute("aria-hidden", "true");
    let i = 0;
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { shown.append(" "); return; }
          const s = document.createElement("span"); s.className = "w"; s.textContent = part; s.style.setProperty("--i", i++); shown.append(s);
        });
      } else {
        const s = document.createElement("span"); s.className = "w"; s.append(node.cloneNode(true)); s.style.setProperty("--i", i++); shown.append(s);
      }
    });
    el.textContent = "";
    el.append(sr, shown);
    el.style.setProperty("--n", i);
  });

  // studio clock
  const clocks = $$("[data-clock]");
  if (clocks.length) {
    let fmt;
    try { fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: SITE.timezone, timeZoneName: "short" }); }
    catch { fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }); }
    const tick = () => clocks.forEach((c) => (c.textContent = fmt.format(new Date())));
    tick();
    setInterval(tick, 15000);
  }
}
renderContent();

/* ==========================================================================
   Motion
   The film runs only when the reader wants motion (the Motion switch, or
   else their system reduce motion setting), the browser has WebGL 2, and the
   layout fits the screen at the current size and zoom. Otherwise the same
   content shows as a still page that scrolls normally.
   ========================================================================== */
const PREF_KEY = "tm-motion";
const chapters = $$("[data-chapter]");
const motionSwitch = $("[data-motion]");
const status = $("[data-status]");
const reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
const hasGL = () => root.dataset.gl === "1";
const readPref = () => { try { return localStorage.getItem(PREF_KEY); } catch { return null; } };
const writePref = (v) => { try { localStorage.setItem(PREF_KEY, v); } catch { /* private mode: the switch still works for this visit */ } };
const wantsMotion = () => { const p = readPref(); return p ? p === "on" : !reduceMQ.matches; };
const roomy = () => window.innerWidth >= 320 && window.innerHeight >= 500;
const isFilm = () => root.classList.contains("film");
const say = (msg) => { status.textContent = ""; setTimeout(() => (status.textContent = msg), 60); };

$("#work").style.setProperty("--len", String(Math.max(220, 110 + n * 60)));

let film = null; // the running film, created the first time it is needed
let tooSmallAt = null; // window size at which the film layout last failed to fit

// which chapter is on screen in the still page
const stillChapter = () => {
  let k = 0;
  chapters.forEach((c, i) => { if (c.getBoundingClientRect().top <= window.innerHeight * 0.35) k = i; });
  return k;
};

async function setMode(wantFilm, { announce = false } = {}) {
  if (wantFilm && !isFilm()) {
    if (!hasGL()) { if (announce) say("Motion isn't available in this browser."); }
    else if (!roomy()) { tooSmallAt = [window.innerWidth, window.innerHeight]; if (announce) say("Motion needs a larger window or less zoom, so the page stays still."); }
    else {
      const k = window.scrollY < 4 ? null : stillChapter();
      root.classList.replace("static", "film");
      if (!film) film = await startFilm();
      if (!film) {
        root.classList.replace("film", "static");
        if (announce) say("Motion isn't available in this browser.");
      } else if (!film.fits()) {
        tooSmallAt = [window.innerWidth, window.innerHeight];
        root.classList.replace("film", "static");
        if (k != null) chapters[k].scrollIntoView({ block: "start" });
        if (announce) say("Motion needs a larger window or less zoom, so the page stays still.");
      } else {
        tooSmallAt = null;
        film.resume(k);
        if (announce) say("Motion on.");
      }
    }
  } else if (!wantFilm && isFilm()) {
    const k = film ? film.chapter() : 0;
    film?.pause();
    root.classList.replace("film", "static");
    if (k > 0) chapters[k].scrollIntoView({ block: "start" });
    if (announce) say("Motion off. The page is now still.");
  }
  motionSwitch.setAttribute("aria-checked", String(isFilm()));
}

motionSwitch.addEventListener("click", () => {
  const on = !isFilm();
  writePref(on ? "on" : "off");
  setMode(on, { announce: true });
});
reduceMQ.addEventListener?.("change", () => { if (!readPref()) setMode(wantsMotion()); });

// resizing or zooming: drop to the still page when the film no longer fits,
// and try the film again once the window is clearly bigger than when it failed
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (isFilm()) {
      if (!film.fits()) { tooSmallAt = [window.innerWidth, window.innerHeight]; setMode(false); }
    } else if (hasGL() && wantsMotion() && roomy() && (!tooSmallAt || window.innerWidth > tooSmallAt[0] + 40 || window.innerHeight > tooSmallAt[1] + 40)) {
      setMode(true);
    }
  }, 200);
});

motionSwitch.setAttribute("aria-checked", String(isFilm()));
if (!isFilm() && hasGL() && wantsMotion() && !roomy()) tooSmallAt = [window.innerWidth, window.innerHeight];
if (isFilm()) {
  (async () => {
    film = await startFilm();
    if (!film) { root.classList.replace("film", "static"); motionSwitch.setAttribute("aria-checked", "false"); return; }
    const check = () => { if (isFilm() && !film.fits()) { tooSmallAt = [window.innerWidth, window.innerHeight]; setMode(false); } };
    film.resume(null);
    check();
    document.fonts?.ready.then(check);
  })();
}

/* ==========================================================================
   The film
   ========================================================================== */
async function startFilm() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const tier = coarse || window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4 ? "low" : "high";
  let scene;
  try {
    const { createScene } = await import("./scene.js");
    scene = createScene({ canvas: $(".stage"), projects, tier });
  } catch (err) {
    console.warn("3D scene unavailable, showing the still page instead.", err);
    root.dataset.gl = "0";
    return null;
  }
  $(".stage").addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    root.dataset.gl = "0";
    setMode(false);
  });

  let running = false, raf = 0;

  /* ---------- measuring ---------- */
  let tops = [], lens = [], maxScroll = 1;
  function measure() {
    const y = window.scrollY;
    tops = chapters.map((el) => el.getBoundingClientRect().top + y);
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    lens = tops.map((t, k) => Math.max(1, (k < tops.length - 1 ? tops[k + 1] : maxScroll) - t));
    // where the "Selected work" heading ends, so the 3D screens can stay clear of it
    const head = $(".work__title"), panel = head?.closest(".ch__sticky");
    if (panel) scene.setWorkClear((head.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) / panel.clientHeight);
    drawTicks();
    moments = momentTimes().map(yForTime);
  }
  const sceneTime = (y) => {
    let k = 0;
    while (k < tops.length - 1 && y >= tops[k + 1]) k++;
    return k + clamp((y - tops[k]) / lens[k], 0, 1);
  };
  const yForTime = (T) => {
    const k = clamp(Math.floor(T), 0, chapters.length - 1);
    return clamp(tops[k] + (T - k) * lens[k], 0, maxScroll);
  };

  // does every chapter's text fit on screen at this size and zoom?
  const caps = $$(".proj");
  function fits() {
    if (!roomy()) return false;
    const over = (el) => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
    if ($$(".hero, .about, .rhythm, .split, .contact").some(over)) return false;
    // the timeline bar is hidden on phones; leave a small margin there instead
    const room = window.innerHeight - $(".nav").offsetHeight - ($(".hud").offsetHeight || 16);
    if (caps.some((c) => c.offsetHeight > room - 16)) return false;
    const cta = $(".contact__cta").getBoundingClientRect();
    const row = $(".contact__row").getBoundingClientRect();
    const label = $(".contact > .label").getBoundingClientRect();
    return cta.top >= label.bottom && cta.bottom <= row.top - 4 && cta.width <= window.innerWidth;
  }

  /* ---------- HUD ---------- */
  const hud = {
    num: $("[data-hud-num]"), name: $("[data-hud-name]"), time: $("[data-hud-time]"),
    total: $("[data-hud-total]"), bar: $("[data-hud-bar]"), fill: $("[data-hud-fill]"), seek: $("[data-seek]"),
  };
  const fmtTime = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
  hud.total.textContent = fmtTime(DURATION);
  function drawTicks() {
    $$(".hud__tick", hud.bar).forEach((t) => t.remove());
    tops.slice(1).forEach((t) => {
      const i = document.createElement("i");
      i.className = "hud__tick";
      i.style.left = `${(t / maxScroll) * 100}%`;
      hud.bar.insertBefore(i, hud.seek);
    });
  }
  const navLinks = $$(".nav__links a");

  /* ---------- scrolling for you: Play, chapter jumps, the timeline ---------- */
  let auto = null; // { kind: "play" }, { kind: "jump", from, to, t, dur } or { kind: "glide", ... }
  let autoY = null; // where the last frame of scrolling for you left the page
  let playY = 0;
  const playButtons = $$("[data-play]");
  const setPlaying = (on) => {
    playButtons.forEach((b) => {
      b.dataset.state = on ? "playing" : "paused";
      if (b.classList.contains("hud__play")) {
        b.setAttribute("aria-label", on ? "Pause the film" : "Play the film");
        $(".hud__play-label", b).textContent = on ? "Pause" : "Play";
      } else {
        $("span:last-child", b).textContent = on ? "Pause the film" : "Play the film";
      }
    });
  };
  function play() {
    if (window.scrollY >= maxScroll - 2) window.scrollTo(0, 0);
    playY = window.scrollY;
    auto = { kind: "play" };
    autoY = null;
    setPlaying(true);
  }
  function stop() {
    auto = null;
    setPlaying(false);
  }
  playButtons.forEach((b) => b.addEventListener("click", () => (auto?.kind === "play" ? stop() : play())));
  function jumpTo(y) {
    const from = window.scrollY, to = clamp(y, 0, maxScroll);
    const dist = Math.abs(to - from) / maxScroll;
    auto = { kind: "jump", from, to, t: 0, dur: clamp(0.8 + dist * 2.6, 0.8, 3.2) };
    autoY = null;
    setPlaying(false);
  }
  // any input from the reader hands control back to them
  const interrupt = () => { if (auto) stop(); };
  window.addEventListener("wheel", interrupt, { passive: true });
  // (but not a touch on Play itself, or Pause would stop the film and then restart it)
  window.addEventListener("touchstart", (e) => { if (!e.target.closest?.("[data-play]")) interrupt(); }, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(e.key) && e.target === document.body) interrupt();
  });

  // the timeline is a range input: drag it, click it, or use the arrow keys
  let seeking = false, lastSeek = -1, lastSeekText = "";
  hud.seek.addEventListener("pointerdown", () => (seeking = true));
  window.addEventListener("pointerup", () => (seeking = false));
  hud.seek.addEventListener("input", () => {
    stop();
    window.scrollTo(0, (hud.seek.value / 1000) * maxScroll);
  });

  // where each chapter lands when you jump to it (progress within the chapter)
  const LAND = { top: 0, about: 0.5, rhythm: 0.5, work: 0.035, services: 0.1, process: 0.12, contact: 1 };
  const landY = (k) => yForTime(k + (LAND[chapters[k].id] ?? 0.1));
  $$("[data-jump]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (!running) return; // the still page just follows the link
      const id = (a.getAttribute("href") || "").slice(1);
      const k = chapters.findIndex((c) => c.id === id);
      if (k < 0) return;
      e.preventDefault();
      jumpTo(landY(k));
      history.replaceState(null, "", id === "top" ? location.pathname : `#${id}`);
    });
  });
  const workIndex = $("[data-work-index]");
  const projectY = (i) => yForTime(3 + workTime(i, n));
  workIndex.addEventListener("click", (e) => {
    const b = e.target.closest("[data-project]");
    if (b) jumpTo(projectY(+b.dataset.project));
  });

  /* ---------- touch: a flick glides to the next moment, never past it ----------
     On a phone one quick flick carries the browser's momentum across several
     chapters, so people who flick (most of them) skipped the film. In the film
     a one finger drag still moves the page with the finger, but letting go
     with a flick glides on to the next moment and stops there, at a pace the
     3D can show. A slow release just coasts a little, never past a moment.
     Pinch zoom and form controls are left to the browser, and a pull down at
     the very top is too, so pull to refresh still works. */
  const STUDIO_LIT = 0.74; // the studio sentence is fully lit (see .about__text --wp)
  let moments = []; // scroll positions a flick stops at, measured with the chapters
  function momentTimes() {
    return [
      0,
      1 + STUDIO_LIT,
      2 + LAND.rhythm,
      ...(n ? projects.map((_, i) => 3 + workTime(i, n)) : [3.5]),
      ...[0, 1, 2, 3].map((s) => 4 + (s + 0.5) / 4), // each service
      ...[0, 1, 2, 3].map((s) => FILL_FROM + FILL_LEN * (s + 0.5) / 4), // each process step
      7, // the end: Contact
    ];
  }
  // the first moment in direction dir that is more than `gap` past `from` and
  // no more than `back` behind y (so a drag that just overshot settles onto it)
  const nextMoment = (from, y, dir, gap, back = 0) => {
    if (dir > 0) return moments.find((m) => m > from + gap && m >= y - back) ?? maxScroll;
    for (let i = moments.length - 1; i >= 0; i--) if (moments[i] < from - gap && moments[i] <= y + back) return moments[i];
    return 0;
  };
  // glide from where the page is to `to`, leaving at the finger's speed v
  // (px per ms) and easing to a stop; m caps how fast it may leave
  function glide(to, v, dur, m = 3) {
    const from = window.scrollY, dist = to - from;
    if (Math.abs(dist) < 1) return;
    auto = { kind: "glide", from, to, t: 0, dur, m0: clamp((v * 1000 * dur) / dist, 0, m) };
    autoY = null;
    setPlaying(false);
  }
  const FLICK = 0.3; // px per ms: letting go faster than this is a flick
  let touch = null;
  window.addEventListener("touchstart", (e) => {
    touch = null;
    if (!running || e.touches.length !== 1 || e.target.closest?.("input, select, textarea")) return;
    const y = e.touches[0].clientY;
    // samples use the event's own time, so a slow frame can't make a flick look like a pause
    touch = { y0: y, s0: window.scrollY, mode: "", moved: false, pts: [[e.timeStamp, y]] };
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (!touch) return;
    if (!running || e.touches.length !== 1) { touch = null; return; } // a second finger: pinch zoom
    const y = e.touches[0].clientY, dy = y - touch.y0;
    if (!touch.mode) touch.mode = touch.s0 <= 0 && dy > 0 ? "native" : "film";
    if (touch.mode !== "film") return;
    if (!e.cancelable) { touch = null; return; } // the browser is already scrolling: let it
    e.preventDefault();
    if (Math.abs(dy) > 8) touch.moved = true;
    window.scrollTo(0, clamp(touch.s0 - dy, 0, maxScroll));
    const now = e.timeStamp;
    touch.pts.push([now, y]);
    while (touch.pts.length > 2 && now - touch.pts[0][0] > 100) touch.pts.shift();
  }, { passive: false });
  window.addEventListener("touchend", (e) => {
    const g = touch;
    touch = null;
    if (!g || g.mode !== "film" || !running) return;
    if (g.moved && e.cancelable) e.preventDefault(); // a drag, not a tap: no click
    // the finger's speed over its last 100ms, in page pixels per ms (+ is down the page)
    const a = g.pts[0], b = g.pts[g.pts.length - 1];
    const v = b[0] > a[0] && e.timeStamp - b[0] < 80 ? (a[1] - b[1]) / (b[0] - a[0]) : 0;
    const y = window.scrollY, dir = Math.sign(v);
    if (!dir) return;
    if (Math.abs(v) < FLICK) {
      // a slow release coasts a little, but never past the next moment
      const cap = nextMoment(y, y, dir, 0), coast = y + v * 200;
      glide(dir > 0 ? Math.min(coast, cap) : Math.max(coast, cap), v, 0.6);
      return;
    }
    // a flick moves on one moment from where the finger started (like a
    // carousel): moments close together can't be skipped by the drag itself
    const gap = window.innerHeight * 0.12;
    const from = dir > 0 ? Math.min(g.s0, y) : Math.max(g.s0, y);
    const to = nextMoment(from, y, dir, gap, gap);
    const dur = Math.min(GLIDE_MAX, GLIDE_BASE + (GLIDE_PER_SCREEN * Math.abs(to - y)) / window.innerHeight);
    glide(to, v, dur, 1.6);
  }, { passive: false });
  window.addEventListener("touchcancel", () => (touch = null));

  // keyboard: when focus lands on something that is faded out (another
  // chapter, another project), bring its chapter on screen
  const shown = (el) => {
    let a = 1;
    for (let e = el; e && e !== root; e = e.parentElement) a *= parseFloat(getComputedStyle(e).opacity);
    return a > 0.95;
  };
  document.addEventListener("focusin", (e) => {
    if (!running) return;
    const el = e.target;
    const sec = el.closest?.("[data-chapter]");
    if (!sec || shown(el)) return;
    stop();
    const proj = el.closest(".proj");
    const y = proj ? projectY(caps.indexOf(proj)) : landY(chapters.indexOf(sec));
    // cut straight there (no catch up) so the focused text shows at once
    const go = () => { window.scrollTo(0, y); Ts = sceneTime(window.scrollY); updateUI(Ts); };
    go();
    // the browser scrolls the focused element into view after this event; land on the chapter again
    setTimeout(go, 0);
  });

  /* ---------- pointer ---------- */
  const label = $(".pointer-label");
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  let px = -1, py = -1, overScreen = -1;
  window.addEventListener("pointermove", (e) => {
    // a finger dragging the film shouldn't also swing the camera
    if (!running || e.pointerType === "touch") return;
    px = e.clientX; py = e.clientY;
    scene.setPointer((px / window.innerWidth) * 2 - 1, -((py / window.innerHeight) * 2 - 1));
    if (finePointer) { label.style.setProperty("--x", `${px}px`); label.style.setProperty("--y", `${py}px`); }
  }, { passive: true });
  window.addEventListener("click", (e) => {
    if (!running || overScreen < 0 || e.target.closest("a, button, input")) return;
    window.open(projects[overScreen].url, "_blank", "noopener");
  });

  /* ---------- per-chapter UI ---------- */
  const indexBtns = $$("button", workIndex);
  const services = $$('[data-panels="services"] .panel');
  const dots = $$(".dots i");
  const steps = $$('[data-panels="steps"] .step');
  const dialLabel = $(".dial-label");
  const dialNum = $("[data-dial-num]"), dialPct = $("[data-dial-pct]");
  const state = { proj: -2, service: -2, step: -2, chapter: -1, pct: -1 };
  const FILL_FROM = 5.06, FILL_LEN = 0.84; // the scene times over which the process dial fills
  const setActive = (list, i) => list.forEach((el, k) => el.classList.toggle("is-active", k === i));

  function updateUI(T) {
    // work
    const pw = T - 3;
    let proj = -1;
    if (n && pw > 0 && pw < 1) {
      const i = clamp(Math.round(((pw - WORK_PAD) / (1 - 2 * WORK_PAD)) * n - 0.5), 0, n - 1);
      if (Math.abs(pw - workTime(i, n)) < workHalf(n) * 0.92) proj = i;
    }
    if (proj !== state.proj) {
      state.proj = proj;
      setActive(caps, proj);
      setActive(indexBtns, proj);
    }
    // services
    const q = T - 4;
    const service = q > 0.015 && q < 0.985 ? clamp(Math.floor(q * 4), 0, 3) : -1;
    if (service !== state.service) {
      state.service = service;
      setActive(services, service);
      setActive(dots, service);
    }
    // process
    const fill = clamp((T - FILL_FROM) / FILL_LEN, 0, 1);
    const step = T > 5 && T < 6 ? Math.min(3, Math.floor(fill * 4)) : -1;
    if (step !== state.step) {
      state.step = step;
      steps.forEach((el, k) => {
        el.classList.toggle("is-active", k === step);
        el.classList.toggle("is-done", step > -1 && k < step);
        if (k === step) el.setAttribute("aria-current", "step");
        else el.removeAttribute("aria-current");
      });
      dialNum.textContent = pad(Math.max(0, step) + 1);
    }
    if (T > 4.9 && T < 6.1) {
      const pct = Math.round(fill * 100);
      if (pct !== state.pct) { state.pct = pct; dialPct.textContent = pct >= 100 ? "Live" : `${pct}%`; }
      const s = scene.projectStage();
      dialLabel.style.setProperty("--dx", `${s.x.toFixed(1)}px`);
      dialLabel.style.setProperty("--dy", `${s.y.toFixed(1)}px`);
    }
  }

  /* ---------- the loop ---------- */
  const lastP = chapters.map(() => -1);
  let last = performance.now(), time = 0;
  let Ts = 0, lastY = 0, vel = 0;
  // adaptive resolution: if frames are slow, render fewer pixels
  let slowFrames = 0, frames = 0, cooldown = 2.5;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
    last = now;
    time += dt;

    // something else moved the page mid way (a screen reader, a tap on the
    // phone's status bar): hand control back instead of pulling it back
    if (auto && autoY != null && Math.abs(window.scrollY - autoY) > 2) stop();
    if (auto?.kind === "play") {
      playY += (maxScroll / DURATION) * dt;
      window.scrollTo(0, playY);
      if (playY >= maxScroll) stop();
    } else if (auto?.kind === "jump") {
      auto.t = Math.min(1, auto.t + dt / auto.dur);
      const e = auto.t < 0.5 ? 4 * auto.t ** 3 : 1 - (-2 * auto.t + 2) ** 3 / 2;
      window.scrollTo(0, auto.from + (auto.to - auto.from) * e);
      if (auto.t >= 1) auto = null;
    } else if (auto?.kind === "glide") {
      // leaves at m0 times the average speed (the finger's, capped) and eases to a stop
      const t = (auto.t = Math.min(1, auto.t + dt / auto.dur));
      const e = auto.m0 * t * (1 - t) * (1 - t) + t * t * (3 - 2 * t);
      window.scrollTo(0, auto.from + (auto.to - auto.from) * e);
      if (t >= 1) auto = null;
    }

    const y = window.scrollY;
    autoY = auto ? y : null;
    const T = sceneTime(y);

    // text: progress through each chapter, straight from the scrollbar
    for (let k = 0; k < chapters.length; k++) {
      const p = clamp((y - tops[k]) / lens[k], 0, 1);
      if (Math.abs(p - lastP[k]) > 0.0002) { chapters[k].style.setProperty("--p", p.toFixed(4)); lastP[k] = p; }
    }

    // 3D: follows the scroll position with a short, smooth catch up
    Ts += (T - Ts) * (1 - Math.exp(-dt * FOLLOW));
    if (Math.abs(T - Ts) < 1e-5) Ts = T;
    const v = (y - lastY) / dt / window.innerHeight;
    lastY = y;
    vel += (v - vel) * (1 - Math.exp(-dt * 6));

    if (finePointer && px >= 0 && Ts > 2.9 && Ts < 4.1) {
      const hit = scene.pick(px, py);
      if (hit !== overScreen) { overScreen = hit; root.classList.toggle("is-over-screen", hit >= 0); }
    } else if (overScreen !== -1) {
      overScreen = -1;
      scene.pick(-9999, -9999);
      root.classList.remove("is-over-screen");
    }

    scene.update(Ts, time, dt, vel);
    updateUI(Ts);

    // HUD
    const k = clamp(Math.floor(T), 0, chapters.length - 1);
    if (k !== state.chapter) {
      chapters[state.chapter]?.classList.remove("is-current");
      chapters[k].classList.add("is-current");
      state.chapter = k;
      hud.num.textContent = pad(k);
      hud.name.textContent = chapters[k].dataset.chapter;
      navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === `#${chapters[k].id}`));
    }
    const prog = y / maxScroll;
    hud.fill.style.setProperty("--progress", prog.toFixed(4));
    const t = fmtTime(prog * DURATION);
    hud.time.textContent = t;
    if (!seeking) {
      const sv = Math.round(prog * 1000);
      if (sv !== lastSeek) { hud.seek.value = sv; lastSeek = sv; }
    }
    const seekText = `${chapters[k].dataset.chapter}, ${t} of ${fmtTime(DURATION)}`;
    if (seekText !== lastSeekText) { hud.seek.setAttribute("aria-valuetext", seekText); lastSeekText = seekText; }

    // adaptive resolution
    cooldown -= dt;
    if (cooldown < 0) {
      frames++;
      if (dt > 1 / 38) slowFrames++;
      if (frames >= 90) {
        if (slowFrames > 45 && scene.dpr > 1) { scene.setDpr(Math.max(1, scene.dpr - 0.25)); cooldown = 3; }
        frames = slowFrames = 0;
      }
    }

    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => { if (running) { measure(); scene.resize(); } });
  document.fonts?.ready.then(() => running && measure());
  new ResizeObserver(() => running && measure()).observe(document.body);

  return {
    fits,
    chapter: () => clamp(Math.floor(sceneTime(window.scrollY)), 0, chapters.length - 1),
    // start (or restart) the film; k is a chapter to open on, null keeps the scroll position
    resume(k) {
      measure();
      scene.resize();
      if (k != null) window.scrollTo(0, landY(k));
      Ts = sceneTime(window.scrollY);
      lastY = window.scrollY;
      last = performance.now();
      lastP.fill(-1);
      state.chapter = -1;
      running = true;
      scene.update(Ts, time, 0.016, 0);
      updateUI(Ts);
      requestAnimationFrame(() => running && root.classList.add("is-ready"));
      raf = requestAnimationFrame(frame);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
      stop();
      overScreen = -1;
      chapters.forEach((c) => c.classList.remove("is-current"));
      root.classList.remove("is-ready", "is-over-screen");
    },
  };
}
