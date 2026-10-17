/* ==========================================================================
   TENELEVENMEDIA /next: page controller
   Reads the scroll position, turns it into the film's scene time and keeps
   the text, the timeline HUD and the 3D scene in step.
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

/* ---------- helpers ---------- */
const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url || ""; } };
// asset paths in projects.js / screenshots.js are relative to the site root
const asset = (s) => (/^(https?:)?\/\//.test(s) || s.startsWith("/") || s.startsWith("data:") ? s : "../" + s);
const shotFor = (p) => {
  const s = p.image || SHOTS[slugify(p.title)] || "";
  return typeof s === "string" ? { poster: s, full: "" } : { poster: s.poster || "", full: s.full || "" };
};

const projects = (window.PROJECTS || []).map((p) => ({ ...p, slug: slugify(p.title), ...shotFor(p) }));
const n = projects.length;

/* ==========================================================================
   Content
   ========================================================================== */
function renderContent() {
  const email = SITE.email || "";
  $$("[data-email]").forEach((a) => { a.textContent = email; a.href = `mailto:${email}`; });
  $$("[data-email-link]").forEach((a) => (a.href = `mailto:${email}?subject=New%20project%20enquiry`));

  const socials = SITE.socials || [];
  if (socials.length) {
    $$("[data-socials]").forEach((ul) => {
      ul.innerHTML = socials.map((s) => `<li><a class="link-underline" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join("");
    });
    $$("[data-socials-wrap]").forEach((el) => (el.hidden = false));
  }
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  $$("[data-count]").forEach((el) => (el.textContent = `(${pad(n)})`));

  // projects: captions in the film, cards in the static version
  $("[data-work]").innerHTML = projects.map((p, i) => `
    <li class="proj" data-side="${i % 2 ? "right" : "left"}">
      <a class="proj__link" href="${esc(p.url)}" target="_blank" rel="noopener">
        ${p.poster ? `<img class="proj__img" src="${esc(asset(p.poster))}" alt="" loading="lazy" decoding="async" width="1440" height="900" />` : ""}
        <span class="proj__mask"><span class="proj__num mono">${pad(i + 1)} / ${pad(n)}</span></span>
        <span class="proj__mask"><span class="proj__title">${esc(p.title)}</span></span>
        <span class="proj__mask"><span class="proj__meta mono">${esc(p.category)}${p.year ? ` · ${esc(p.year)}` : ""}</span></span>
        <span class="proj__mask"><span class="proj__visit mono">Visit ${esc(domainOf(p.url))} <span aria-hidden="true">↗</span></span></span>
      </a>
    </li>`).join("");
  $("[data-work-index]").innerHTML = projects.map((p, i) => `<li><button type="button" tabindex="-1" data-project="${i}" title="${esc(p.title)}">${pad(i + 1)}</button></li>`).join("");

  // the studio paragraph lights up word by word
  $$("[data-words]").forEach((el) => {
    const words = [];
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) words.push(document.createTextNode(" "));
          else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; words.push(s); }
        });
      } else {
        const s = document.createElement("span"); s.className = "w"; s.appendChild(node.cloneNode(true)); words.push(s);
      }
    });
    el.textContent = "";
    let i = 0;
    words.forEach((w) => { if (w.nodeType === 1) w.style.setProperty("--i", i++); el.appendChild(w); });
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
   Static version (reduced motion or no WebGL): nothing more to do
   ========================================================================== */
if (root.classList.contains("film")) startFilm();

function goStatic() {
  root.classList.remove("film", "is-ready");
  root.classList.add("static");
}

async function startFilm() {
  const chapters = $$("[data-chapter]");
  const work = $("#work");
  work.style.setProperty("--len", String(Math.max(220, 110 + n * 60)));

  /* ---------- measuring ---------- */
  let tops = [], lens = [], maxScroll = 1;
  function measure() {
    const y = window.scrollY;
    tops = chapters.map((el) => el.getBoundingClientRect().top + y);
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    lens = tops.map((t, k) => Math.max(1, (k < tops.length - 1 ? tops[k + 1] : maxScroll) - t));
    drawTicks();
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

  /* ---------- HUD ---------- */
  const hud = {
    num: $("[data-hud-num]"), name: $("[data-hud-name]"), time: $("[data-hud-time]"),
    total: $("[data-hud-total]"), bar: $("[data-hud-bar]"), fill: $("[data-hud-fill]"),
  };
  const fmtTime = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
  hud.total.textContent = fmtTime(DURATION);
  function drawTicks() {
    $$(".hud__tick", hud.bar).forEach((t) => t.remove());
    tops.slice(1).forEach((t, k) => {
      const i = document.createElement("i");
      i.className = "hud__tick";
      i.style.left = `${(t / maxScroll) * 100}%`;
      i.title = chapters[k + 1].dataset.chapter;
      hud.bar.appendChild(i);
    });
  }
  const navLinks = $$(".nav__links a");

  /* ---------- scrolling for you: Play, chapter jumps ---------- */
  let auto = null; // { kind: "play" } or { kind: "jump", from, to, t, dur }
  let playY = 0;
  const playButtons = $$("[data-play]");
  const setPlaying = (on) => {
    root.classList.toggle("is-playing", on);
    playButtons.forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      const label = $(".hud__play-label", b) || $("span:last-child", b);
      if (label) label.textContent = b.classList.contains("hud__play") ? (on ? "Pause" : "Play") : on ? "Pause the film" : "Play the film";
    });
  };
  function play() {
    if (window.scrollY >= maxScroll - 2) window.scrollTo(0, 0);
    playY = window.scrollY;
    auto = { kind: "play" };
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
    setPlaying(false);
  }
  // any input from the reader hands control back to them
  const interrupt = () => { if (auto) stop(); };
  window.addEventListener("wheel", interrupt, { passive: true });
  window.addEventListener("touchstart", interrupt, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(e.key) && e.target === document.body) interrupt();
  });

  // where each chapter lands when you jump to it (progress within the chapter)
  const LAND = { top: 0, about: 0.35, rhythm: 0.45, work: 0.035, services: 0.1, process: 0.12, contact: 1 };
  $$("[data-jump]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = (a.getAttribute("href") || "").slice(1);
      const k = chapters.findIndex((c) => c.id === id);
      if (k < 0) return;
      e.preventDefault();
      jumpTo(yForTime(k + (LAND[id] ?? 0.1)));
      history.replaceState(null, "", id === "top" ? location.pathname : `#${id}`);
    });
  });
  hud.bar.addEventListener("click", (e) => {
    const r = hud.bar.getBoundingClientRect();
    jumpTo(((e.clientX - r.left) / r.width) * maxScroll);
  });
  const workIndex = $("[data-work-index]");
  const projectY = (i) => yForTime(3 + workTime(i, n));
  workIndex.addEventListener("click", (e) => {
    const b = e.target.closest("[data-project]");
    if (b) jumpTo(projectY(+b.dataset.project));
  });
  // keyboard: tabbing onto a project brings its screen into view
  $$(".proj__link").forEach((a, i) => a.addEventListener("focus", () => {
    if (Math.abs(sceneTime(window.scrollY) - 3 - workTime(i, n)) > workHalf(n) * 0.8) window.scrollTo(0, projectY(i));
  }));

  /* ---------- the 3D scene ---------- */
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const tier = coarse || window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4 ? "low" : "high";
  let scene;
  try {
    const { createScene } = await import("./scene.js");
    scene = createScene({ canvas: $(".stage"), projects, asset, tier });
  } catch (err) {
    console.warn("3D scene unavailable, showing the static page instead.", err);
    goStatic();
    return;
  }
  $(".stage").addEventListener("webglcontextlost", (e) => { e.preventDefault(); goStatic(); });

  measure();
  window.addEventListener("resize", () => { measure(); scene.resize(); });
  if (document.fonts) document.fonts.ready.then(measure);
  new ResizeObserver(measure).observe(document.body);

  /* ---------- pointer ---------- */
  const label = $(".pointer-label");
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  let px = -1, py = -1, overScreen = -1;
  window.addEventListener("pointermove", (e) => {
    px = e.clientX; py = e.clientY;
    scene.setPointer((px / window.innerWidth) * 2 - 1, -((py / window.innerHeight) * 2 - 1));
    if (finePointer) { label.style.setProperty("--x", `${px}px`); label.style.setProperty("--y", `${py}px`); }
  }, { passive: true });
  window.addEventListener("click", (e) => {
    if (overScreen < 0 || e.target.closest("a, button")) return;
    window.open(projects[overScreen].url, "_blank", "noopener");
  });

  /* ---------- per-chapter UI ---------- */
  const caps = $$(".proj");
  const indexBtns = $$("button", workIndex);
  const services = $$('[data-panels="services"] .panel');
  const dots = $$(".dots i");
  const steps = $$('[data-panels="steps"] .step');
  const dialLabel = $(".dial-label");
  const dialNum = $("[data-dial-num]"), dialPct = $("[data-dial-pct]");
  const state = { proj: -2, service: -2, step: -2, chapter: -1, pct: -1 };
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
    const fill = clamp((T - 5 - 0.06) / 0.84, 0, 1);
    const step = T > 5 && T < 6 ? Math.min(3, Math.floor(fill * 4)) : -1;
    if (step !== state.step) {
      state.step = step;
      steps.forEach((el, k) => { el.classList.toggle("is-active", k === step); el.classList.toggle("is-done", step > -1 && k < step); });
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
  let Ts = sceneTime(window.scrollY), lastY = window.scrollY, vel = 0;
  // adaptive resolution: if frames are slow, render fewer pixels
  let slowFrames = 0, frames = 0, cooldown = 2.5;

  function frame(now) {
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
    last = now;
    time += dt;

    if (auto?.kind === "play") {
      playY += (maxScroll / DURATION) * dt;
      window.scrollTo(0, playY);
      if (playY >= maxScroll) stop();
    } else if (auto?.kind === "jump") {
      auto.t = Math.min(1, auto.t + dt / auto.dur);
      const e = auto.t < 0.5 ? 4 * auto.t ** 3 : 1 - (-2 * auto.t + 2) ** 3 / 2;
      window.scrollTo(0, auto.from + (auto.to - auto.from) * e);
      if (auto.t >= 1) auto = null;
    }

    const y = window.scrollY;
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
    hud.time.textContent = fmtTime(prog * DURATION);

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

    requestAnimationFrame(frame);
  }

  scene.update(Ts, 0, 0.016, 0);
  updateUI(Ts);
  requestAnimationFrame(() => root.classList.add("is-ready"));
  requestAnimationFrame(frame);
}
