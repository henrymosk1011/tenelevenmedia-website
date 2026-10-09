/* ==========================================================================
   TENELEVENMEDIA — interactions & motion
   ========================================================================== */

(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const SITE = window.SITE || {};
  const PROJECTS = window.PROJECTS || [];
  const SHOTS = window.SCREENSHOTS || {};

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const motion = hasGsap && !reduceMotion;

  if (motion) {
    root.classList.add("motion");
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  const slugify = (s) =>
    String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-");

  const domainOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url || "";
    }
  };

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const pad = (n) => String(n).padStart(2, "0");

  const imageFor = (p) => p.image || SHOTS[slugify(p.title)] || "";

  // Split a title into "Word *word*" — last word set in italic serif for flair.
  const flairTitle = (title) => {
    const parts = esc(title).split(" ");
    if (parts.length < 2) return parts[0];
    const last = parts.pop();
    return `${parts.join(" ")} <em>${last}</em>`;
  };

  /* ------------------------------------------------------------------ *
   * Content
   * ------------------------------------------------------------------ */
  function renderSite() {
    const email = SITE.email || "";
    $$("[data-email]").forEach((a) => {
      a.textContent = email;
      a.href = `mailto:${email}`;
    });
    $$("[data-email-link]").forEach((a) => (a.href = `mailto:${email}?subject=New%20project%20enquiry`));
    $$("[data-socials]").forEach((ul) => {
      ul.innerHTML = (SITE.socials || [])
        .map((s) => `<li><a class="link-underline" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`)
        .join("");
    });
    $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
    $$("[data-count]").forEach((el) => (el.textContent = `(${pad(PROJECTS.length)})`));
    $$("[data-total]").forEach((el) => (el.textContent = pad(PROJECTS.length)));
  }

  function coverHTML(p) {
    return `
      <div class="card__cover">
        <div class="card__cover-top mono"><span>${esc(p.category || "")}</span><span>${esc(p.year || "")}</span></div>
        <span class="card__cover-orb"></span>
        <div class="card__cover-title">${flairTitle(p.title)}</div>
      </div>`;
  }

  function renderCards() {
    const wrap = $("[data-cards]");
    if (!wrap) return;
    wrap.innerHTML = PROJECTS.map((p, i) => {
      const img = imageFor(p);
      const media = img
        ? `<img src="${esc(img)}" alt="Screenshot of the ${esc(p.title)} website" loading="lazy" decoding="async" />`
        : coverHTML(p);
      return `
        <article class="card" style="--accent:${esc(p.accent || "#ff4d1f")}">
          <a class="card__link" href="${esc(p.url)}" target="_blank" rel="noopener" data-cursor="Visit ↗">
            <div class="card__frame">
              <div class="card__chrome" aria-hidden="true"><i></i><i></i><i></i><span class="card__url mono">${esc(domainOf(p.url))}</span></div>
              <div class="card__shot"><div class="card__parallax">${media}</div></div>
            </div>
            <div class="card__meta">
              <span class="card__num mono">${pad(i + 1)}</span>
              <h3 class="card__title">${esc(p.title)}</h3>
              <span class="card__visit mono">Visit site <b>↗</b></span>
              <span class="card__cat mono">${esc(p.category || "")} — ${esc(p.year || "")}</span>
            </div>
          </a>
        </article>`;
    }).join("");
  }

  function renderIndex() {
    const list = $("[data-index]");
    const preview = $("[data-preview]");
    if (!list) return;
    list.innerHTML = PROJECTS.map(
      (p, i) => `
      <li class="index__row" data-fade>
        <a href="${esc(p.url)}" target="_blank" rel="noopener" data-i="${i}">
          <span class="mono">${pad(i + 1)}</span>
          <span class="index__title">${esc(p.title)}</span>
          <span class="mono index__cat">${esc(p.category || "")}</span>
          <span class="mono index__year">${esc(p.year || "")}</span>
          <span class="index__arrow" aria-hidden="true">↗</span>
        </a>
      </li>`
    ).join("");
    if (preview) {
      preview.innerHTML = PROJECTS.map((p) => {
        const img = imageFor(p);
        return `<div class="index__preview-item" style="--accent:${esc(p.accent || "#ff4d1f")}">${
          img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" />` : coverHTML(p)
        }</div>`;
      }).join("");
    }
  }

  /* ------------------------------------------------------------------ *
   * Text splitting — wraps words (and keeps inline elements like <em>)
   * ------------------------------------------------------------------ */
  function splitWords(el, { mask = true } = {}) {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(" "));
              return;
            }
            const inner = document.createElement("span");
            inner.className = "w__i";
            inner.textContent = part;
            if (mask) {
              const outer = document.createElement("span");
              outer.className = "w";
              outer.appendChild(inner);
              frag.appendChild(outer);
            } else {
              frag.appendChild(inner);
            }
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !child.classList.contains("pill")) {
          walk(child);
        }
      });
    };
    walk(el);
    return $$(".w__i", el);
  }

  function splitChars(el) {
    const text = el.textContent;
    el.innerHTML = Array.from(text).map((c) => `<span class="ch">${c === " " ? "&nbsp;" : esc(c)}</span>`).join("");
    return $$(".ch", el);
  }

  /* Fit the wordmark exactly to the container width */
  function fitText() {
    $$("[data-fit]").forEach((el) => {
      const parent = el.parentElement;
      el.style.fontSize = "100px";
      el.style.width = "max-content";
      const w = el.getBoundingClientRect().width;
      el.style.width = "";
      const target = parent.clientWidth;
      if (w > 0) el.style.fontSize = `${(100 * target) / w}px`;
    });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  renderSite();
  renderCards();
  renderIndex();

  // Fluid backgrounds
  let heroFluid = null;
  let footFluid = null;
  if (window.Fluid) {
    const heroCanvas = $(".hero__fluid");
    const footCanvas = $(".footer__fluid");
    if (heroCanvas) heroFluid = new window.Fluid(heroCanvas, { static: reduceMotion, focus: [0.72, 0.42], spread: 1.05 });
    if (footCanvas)
      footFluid = new window.Fluid(footCanvas, {
        static: reduceMotion,
        c1: "#6b5bff",
        c2: "#ff4d1f",
        focus: [0.5, 0.15],
        spread: 1.15,
      });
  }

  // Clock in the footer
  startClock();

  if (!hasGsap) {
    $(".loader")?.remove();
    fitText();
    window.addEventListener("resize", fitText);
    heroFluid?.start();
    footFluid?.start();
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  /* Smooth scrolling */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  // anchor links
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2 && id !== "#") return;
      const target = id === "#top" || id === "#" ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      closeMenu();
      if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else if (target === 0) window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  /* ------------------------------------------------------------------ *
   * Split text set-up
   * ------------------------------------------------------------------ */
  const wordmarkChars = splitChars($(".wordmark"));
  const ledeWords = splitWords($(".hero__lede"));
  $$("[data-split]").forEach((el) => {
    if (el.classList.contains("hero__lede")) return;
    el._words = splitWords(el);
  });
  const scrubWords = $("[data-scrub-words]") ? splitWords($("[data-scrub-words]"), { mask: false }) : [];

  /* ------------------------------------------------------------------ *
   * Fonts → fit → animations
   * ------------------------------------------------------------------ */
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => {
    fitText();
    window.addEventListener("resize", () => {
      fitText();
    });
    init();
  });

  function init() {
    buildClock();
    if (!motion) {
      staticClock();
      $(".loader")?.remove();
      heroFluid?.start();
      footFluid?.start();
      setupCursor();
      setupMenu();
      return;
    }

    preloader().then(() => lenis?.start());

    heroScroll();
    reveals();
    manifesto();
    marquees();
    horizontalWork();
    stackCards();
    bigType();
    processClock();
    indexPreview();
    footer();
    setupCursor();
    setupMagnetic();
    setupMenu();
    navOnScroll();

    ScrollTrigger.refresh();
  }

  /* ------------------------------------------------------------------ *
   * Preloader — counts the clock up to 10:11, then the curtain lifts
   * ------------------------------------------------------------------ */
  function preloader() {
    return new Promise((resolve) => {
      const loader = $(".loader");
      const timeEl = $(".loader__time");
      if (!loader) {
        heroIntro();
        resolve();
        return;
      }
      heroFluid?.start();
      const counter = { m: 0 };
      const tl = gsap.timeline({
        onComplete: () => {
          loader.remove();
          resolve();
        },
      });
      tl.from(".loader__inner > *", { yPercent: 100, opacity: 0, duration: 0.8, stagger: 0.08, ease: "power3.out" })
        .to(
          counter,
          {
            m: 611, // 10 hours 11 minutes
            duration: 1.8,
            ease: "power2.inOut",
            onUpdate: () => {
              const m = Math.round(counter.m);
              timeEl.textContent = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
            },
          },
          0.1
        )
        .to(timeEl, { color: "#ff4d1f", duration: 0.25 })
        .to(".loader__inner", { yPercent: -30, opacity: 0, duration: 0.6, ease: "power3.in" }, "+=0.15")
        .to(".loader__cols i", { yPercent: -100, duration: 1, ease: "expo.inOut", stagger: 0.07 }, "-=0.2")
        .add(heroIntro(), "-=0.75");
    });
  }

  function heroIntro() {
    const tl = gsap.timeline();
    tl.from(wordmarkChars, {
      yPercent: 110,
      rotate: 8,
      duration: 1.3,
      ease: "expo.out",
      stagger: 0.045,
      onComplete: () => gsap.set(".wordmark", { overflow: "visible" }),
    })
      .from(".hero__title .line > span", { yPercent: 110, duration: 1.2, ease: "expo.out", stagger: 0.1 }, 0.15)
      .from(ledeWords, { yPercent: 110, duration: 1, ease: "expo.out", stagger: 0.015 }, 0.3)
      .to(".hero [data-reveal]", { opacity: 1, duration: 1, stagger: 0.08 }, 0.5)
      .from(".badge", { scale: 0, rotate: -180, duration: 1.4, ease: "expo.out" }, 0.4)
      .from(".nav > *", { y: -30, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.08 }, 0.3);
    return tl;
  }

  /* ------------------------------------------------------------------ *
   * Hero — pinned while the next section slides over it
   * ------------------------------------------------------------------ */
  function heroScroll() {
    const hero = $(".hero");
    ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom top",
      pin: true,
      pinSpacing: false,
      onLeave: () => heroFluid?.stop(),
      onEnterBack: () => heroFluid?.start(),
    });

    gsap.to(".hero__inner", {
      scale: 0.92,
      opacity: 0.25,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
    gsap.to(wordmarkChars, {
      y: (i, el) => (i % 2 ? -0.4 : 0.3) * (1 + (i % 3) * 0.4) * el.offsetHeight,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true },
    });
    gsap.to(".hero__title", {
      y: () => -window.innerHeight * 0.12,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true },
    });

    // fluid reacts while pointer is over the hero
    hero.addEventListener("pointerenter", () => heroFluid?.setHover(1));
    hero.addEventListener("pointerleave", () => heroFluid?.setHover(0));
  }

  /* ------------------------------------------------------------------ *
   * Generic reveals
   * ------------------------------------------------------------------ */
  function reveals() {
    $$("[data-split]").forEach((el) => {
      if (!el._words) return;
      gsap.from(el._words, {
        yPercent: 110,
        duration: 1.1,
        ease: "expo.out",
        stagger: 0.04,
        scrollTrigger: { trigger: el, start: "top 85%" },
      });
    });

    ScrollTrigger.batch("[data-fade]", {
      start: "top 90%",
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.08, overwrite: true }),
    });

    $$(".label").forEach((el) => {
      if (el.closest(".hero, .footer")) return;
      gsap.from(el, { opacity: 0, x: -20, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" } });
    });
  }

  /* ------------------------------------------------------------------ *
   * Manifesto — words light up as you scroll
   * ------------------------------------------------------------------ */
  function manifesto() {
    const el = $("[data-scrub-words]");
    if (!el) return;
    gsap.set(scrubWords, { opacity: 0.14 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: 0.6 },
    });
    tl.to(scrubWords, { opacity: 1, ease: "none", stagger: 0.1, duration: 0.6 }, 0);
    $$(".pill", el).forEach((pill) => {
      gsap.from(pill, {
        scaleX: 0,
        transformOrigin: "left center",
        ease: "none",
        scrollTrigger: { trigger: pill, start: "top 85%", end: "top 55%", scrub: 0.6 },
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Marquee — infinite loop that speeds up & reverses with scroll
   * ------------------------------------------------------------------ */
  function marquees() {
    $$("[data-marquee]").forEach((m) => {
      const base = parseFloat(m.dataset.marquee) || 1;
      const inner = $(".marquee__inner", m);
      // fill so that we have at least 2x viewport width
      const original = inner.innerHTML;
      let guard = 0;
      while (inner.scrollWidth < window.innerWidth * 2.2 && guard++ < 10) inner.innerHTML += original;
      inner.innerHTML += inner.innerHTML;
      const half = () => inner.scrollWidth / 2;

      let x = 0;
      let dir = 1;
      let boost = 0;
      const speed = 0.9; // px per frame @60fps

      let visible = false;
      ScrollTrigger.create({ trigger: m, start: "top bottom", end: "bottom top", onToggle: (s) => (visible = s.isActive) });

      gsap.ticker.add((time, delta) => {
        if (!visible) return;
        const v = lenis ? lenis.velocity : 0;
        if (v > 0.1) dir = 1;
        else if (v < -0.1) dir = -1;
        boost += (Math.min(Math.abs(v), 60) * 0.35 - boost) * 0.1;
        x -= (speed + boost) * dir * base * (delta / 16.67);
        const w = half();
        if (x <= -w) x += w;
        if (x > 0) x -= w;
        inner.style.transform = `translate3d(${x}px,0,0)`;
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Selected work — pinned horizontal scroll
   * ------------------------------------------------------------------ */
  function horizontalWork() {
    const section = $(".work");
    const track = $(".work__track");
    if (!section || !track) return;
    const cards = $$(".card", track);
    section.classList.add("is-pinned");

    const distance = () => track.scrollWidth - window.innerWidth;

    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: ".work__pin",
        scrub: 1,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          gsap.set(".work__progress i", { scaleX: self.progress });
          skewTo(gsap.utils.clamp(-7, 7, self.getVelocity() / -400));
        },
      },
    });

    // velocity skew on the cards
    const skewSetters = cards.map((c) => gsap.quickTo(c, "skewX", { duration: 0.6, ease: "power3.out" }));
    let skewTimer;
    function skewTo(v) {
      skewSetters.forEach((s) => s(v));
      clearTimeout(skewTimer);
      skewTimer = setTimeout(() => skewSetters.forEach((s) => s(0)), 120);
    }

    // title reveal
    gsap.from(".work__title .line > span", {
      yPercent: 110,
      duration: 1.2,
      ease: "expo.out",
      stagger: 0.1,
      scrollTrigger: { trigger: section, start: "top 70%" },
    });

    const current = $("[data-current]");
    cards.forEach((card, i) => {
      // parallax inside each frame
      const par = $(".card__parallax", card);
      gsap.fromTo(
        par,
        { xPercent: -2.5 },
        {
          xPercent: 2.5,
          ease: "none",
          scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "right left", scrub: true },
        }
      );
      // entrance
      gsap.from(card, {
        rotate: 4,
        yPercent: 8,
        scale: 0.92,
        opacity: 0.3,
        ease: "power2.out",
        scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 100%", end: "left 45%", scrub: true },
      });
      gsap.from($(".card__meta", card).children, {
        y: 30,
        opacity: 0,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.06,
        scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 75%" },
      });
      // active counter
      ScrollTrigger.create({
        trigger: card,
        containerAnimation: tween,
        start: "left 55%",
        end: "right 55%",
        onToggle: (self) => {
          if (self.isActive && current) current.textContent = pad(i + 1);
        },
      });

      // full-page screenshots scroll inside the frame on hover
      const img = $("img", card);
      const shot = $(".card__shot", card);
      if (img && shot) {
        const link = $(".card__link", card);
        link.addEventListener("mouseenter", () => {
          const overflow = img.offsetHeight - shot.offsetHeight;
          if (overflow > 20) gsap.to(img, { y: -overflow, duration: Math.min(8, overflow / 300), ease: "power1.inOut", overwrite: true });
        });
        link.addEventListener("mouseleave", () => gsap.to(img, { y: 0, duration: 1.2, ease: "expo.out", overwrite: true }));
      }
    });

    // outro text
    gsap.from(".work__outro-link > span", {
      yPercent: 60,
      opacity: 0,
      ease: "power2.out",
      stagger: 0.1,
      scrollTrigger: { trigger: ".work__outro", containerAnimation: tween, start: "left 95%", end: "left 50%", scrub: true },
    });

    // images load → re-measure
    $$("img", track).forEach((img) => img.complete || img.addEventListener("load", () => ScrollTrigger.refresh(), { once: true }));
  }

  /* ------------------------------------------------------------------ *
   * Services — sticky stacking cards
   * ------------------------------------------------------------------ */
  function stackCards() {
    const cards = $$(".stack__card");
    cards.forEach((card, i) => {
      card.style.setProperty("--i", i);
      const title = $(".stack__title", card);
      gsap.from(title, {
        yPercent: 40,
        opacity: 0,
        duration: 1.2,
        ease: "expo.out",
        scrollTrigger: { trigger: card, start: "top 70%" },
      });
      gsap.from($$(".tags li", card), {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "expo.out",
        stagger: 0.05,
        scrollTrigger: { trigger: card, start: "top 50%" },
      });

      const next = cards[i + 1];
      if (!next) return;
      gsap.to(card, {
        scale: 0.9 + i * 0.015,
        "--dim": 0.55,
        rotateX: -6,
        ease: "none",
        scrollTrigger: {
          trigger: next,
          start: "top bottom",
          end: () => `top ${parseFloat(getComputedStyle(next).top) || 0}px`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    });
    gsap.set(".stack", { perspective: 1200 });
  }

  /* ------------------------------------------------------------------ *
   * Big type — rows slide in opposite directions
   * ------------------------------------------------------------------ */
  function bigType() {
    $$(".bigtype__row").forEach((row) => {
      const dir = parseFloat(row.dataset.dir) || -1;
      const amount = () => Math.max(0, row.scrollWidth - window.innerWidth) * 0.6 + window.innerWidth * 0.1;
      gsap.fromTo(
        row,
        { x: () => (dir < 0 ? 0 : -amount()) },
        {
          x: () => (dir < 0 ? -amount() : 0),
          ease: "none",
          scrollTrigger: { trigger: ".bigtype", start: "top bottom", end: "bottom top", scrub: 0.5, invalidateOnRefresh: true },
        }
      );
    });
  }

  /* ------------------------------------------------------------------ *
   * Process — the clock winds to 10:11 as you scroll the steps
   * ------------------------------------------------------------------ */
  function buildClock() {
    const ticks = $(".clock__ticks");
    if (!ticks) return;
    const NS = "http://www.w3.org/2000/svg";
    for (let i = 0; i < 60; i++) {
      const l = document.createElementNS(NS, "line");
      const hour = i % 5 === 0;
      l.setAttribute("x1", 200);
      l.setAttribute("x2", 200);
      l.setAttribute("y1", 22);
      l.setAttribute("y2", hour ? 44 : 32);
      l.setAttribute("transform", `rotate(${i * 6} 200 200)`);
      if (hour) l.classList.add("is-hour");
      ticks.appendChild(l);
    }
  }

  // Static clock (no scroll animation): show 10:11
  function staticClock() {
    $(".clock__minute")?.setAttribute("transform", "rotate(66 200 200)");
    $(".clock__hour")?.setAttribute("transform", "rotate(305.5 200 200)");
    const d = $(".clock__digital");
    if (d) {
      d.textContent = "10:11";
      d.classList.add("is-live");
    }
    $(".clock__progress")?.style.setProperty("stroke-dashoffset", "0");
  }

  function processClock() {
    const section = $(".process");
    if (!section) return;
    const steps = $$(".step", section);
    const digital = $(".clock__digital", section);

    section.classList.add("is-pinned");
    gsap.set(steps, { opacity: 0, y: 60 });
    gsap.set(steps[0], { opacity: 1, y: 0 });

    const total = 611; // minutes from 00:00 to 10:11
    const state = { m: 0 };
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${window.innerHeight * 3}`,
        pin: ".process__pin",
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    const dur = steps.length; // one unit per step
    tl.to(state, {
      m: total,
      duration: dur,
      onUpdate: () => {
        const m = Math.round(state.m);
        gsap.set(".clock__minute", { rotation: m * 6, svgOrigin: "200 200" });
        gsap.set(".clock__hour", { rotation: m * 0.5, svgOrigin: "200 200" });
        digital.textContent = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
        digital.classList.toggle("is-live", m >= total);
      },
    }, 0);
    tl.to(".clock__progress", { strokeDashoffset: 0, duration: dur }, 0);

    steps.forEach((step, i) => {
      if (i > 0) tl.to(step, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, i - 0.1);
      if (i < steps.length - 1) tl.to(step, { opacity: 0, y: -60, duration: 0.35, ease: "power2.in" }, i + 0.6);
    });
  }

  /* ------------------------------------------------------------------ *
   * Index — floating preview follows the cursor
   * ------------------------------------------------------------------ */
  function indexPreview() {
    const box = $(".index__preview");
    const track = $("[data-preview]");
    const list = $("[data-index]");
    if (!box || !track || !list || !finePointer) return;

    const xTo = gsap.quickTo(box, "x", { duration: 0.6, ease: "power3.out" });
    const yTo = gsap.quickTo(box, "y", { duration: 0.6, ease: "power3.out" });
    const rTo = gsap.quickTo(box, "rotation", { duration: 0.8, ease: "power3.out" });
    let lastX = 0;

    window.addEventListener("pointermove", (e) => {
      xTo(e.clientX);
      yTo(e.clientY);
      rTo(gsap.utils.clamp(-12, 12, (e.clientX - lastX) * 0.6));
      lastX = e.clientX;
    });

    list.addEventListener("pointerover", (e) => {
      const a = e.target.closest("a[data-i]");
      if (!a) return;
      const i = +a.dataset.i;
      gsap.to(track, { yPercent: -100 * i, duration: 0.7, ease: "expo.out" });
    });
    list.addEventListener("pointerenter", () => gsap.to(box, { scale: 1, duration: 0.6, ease: "expo.out" }));
    list.addEventListener("pointerleave", () => gsap.to(box, { scale: 0, duration: 0.5, ease: "expo.out" }));
  }

  /* ------------------------------------------------------------------ *
   * Footer
   * ------------------------------------------------------------------ */
  function footer() {
    const foot = $(".footer");
    ScrollTrigger.create({
      trigger: foot,
      start: "top bottom",
      end: "bottom top",
      onToggle: (s) => (s.isActive ? footFluid?.start() : footFluid?.stop()),
    });
    gsap.from(".footer__cta-line", {
      yPercent: 50,
      opacity: 0,
      ease: "none",
      stagger: 0.1,
      scrollTrigger: { trigger: foot, start: "top 80%", end: "top 10%", scrub: true },
    });
    gsap.from(".btn-round", {
      scale: 0,
      rotate: -90,
      ease: "none",
      scrollTrigger: { trigger: foot, start: "top 50%", end: "top 0%", scrub: true },
    });
  }

  function startClock() {
    const el = $("[data-clock]");
    if (!el) return;
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: SITE.timezone, timeZoneName: "short" });
    } catch {
      fmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZoneName: "short" });
    }
    const tick = () => {
      const parts = fmt.formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t)?.value || "";
      const is1011 = get("hour") === "10" && get("minute") === "11";
      el.textContent = `${get("hour")}:${get("minute")} ${get("dayPeriod")} ${get("timeZoneName")}${is1011 ? " ✺ it's ten eleven" : ""}`;
      el.classList.toggle("is-1011", is1011);
    };
    tick();
    setInterval(tick, 10000);
  }

  /* ------------------------------------------------------------------ *
   * Cursor
   * ------------------------------------------------------------------ */
  function setupCursor() {
    const cursor = $(".cursor");
    if (!cursor || !finePointer) return;
    root.classList.add("has-cursor");
    const dot = $(".cursor__dot", cursor);
    const ring = $(".cursor__ring", cursor);
    const label = $(".cursor__label", cursor);

    const dx = gsap.quickTo(dot, "x", { duration: 0.08 });
    const dy = gsap.quickTo(dot, "y", { duration: 0.08 });
    const rx = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3.out" });
    const ry = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3.out" });

    gsap.set([dot, ring], { x: window.innerWidth / 2, y: window.innerHeight / 2 });

    window.addEventListener("pointermove", (e) => {
      cursor.classList.remove("is-hidden");
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
    });
    document.addEventListener("pointerleave", () => cursor.classList.add("is-hidden"));
    document.addEventListener("pointerenter", () => cursor.classList.remove("is-hidden"));

    document.addEventListener("pointerover", (e) => {
      const labelled = e.target.closest("[data-cursor]");
      const link = e.target.closest("a, button");
      cursor.classList.toggle("is-label", !!labelled);
      cursor.classList.toggle("is-link", !labelled && !!link);
      if (labelled) label.textContent = labelled.dataset.cursor;
    });
  }

  /* ------------------------------------------------------------------ *
   * Magnetic buttons
   * ------------------------------------------------------------------ */
  function setupMagnetic() {
    if (!finePointer) return;
    $$("[data-magnetic]").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener("pointerleave", () => {
        xTo(0);
        yTo(0);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Menu
   * ------------------------------------------------------------------ */
  let menuOpen = false;
  let menuTl = null;
  let menuCircle = null;
  function setupMenu() {
    const btn = $(".nav__menu");
    const menu = $(".menu");
    if (!btn || !menu) return;

    const fast = reduceMotion ? 0.01 : 1;
    menuCircle = (r) => {
      const b = btn.getBoundingClientRect();
      return `circle(${r}px at ${b.right - 22}px ${b.top + b.height / 2}px)`;
    };

    // link + footer reveal (the circular wipe is tweened separately so it
    // always starts from the button's current position)
    menuTl = gsap
      .timeline({ paused: true })
      .from(".menu__links a > *", { yPercent: 110, duration: 0.9 * fast, ease: "expo.out", stagger: 0.05 })
      .from(".menu__foot", { opacity: 0, y: 20, duration: 0.6 * fast }, "-=0.6");

    btn.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
    document.addEventListener("keydown", (e) => e.key === "Escape" && menuOpen && closeMenu());

    function openMenu() {
      menuOpen = true;
      document.body.classList.add("menu-open");
      btn.setAttribute("aria-expanded", "true");
      menu.setAttribute("aria-hidden", "false");
      lenis?.stop();
      gsap.set(menu, { visibility: "visible" });
      gsap.fromTo(
        menu,
        { clipPath: menuCircle(0) },
        { clipPath: menuCircle(Math.hypot(window.innerWidth, window.innerHeight) * 1.1), duration: fast, ease: "expo.inOut", overwrite: true }
      );
      menuTl.timeScale(1).delay(0.45 * fast).restart(true);
    }
  }

  function closeMenu() {
    if (!menuOpen || !menuTl) return;
    menuOpen = false;
    const menu = $(".menu");
    document.body.classList.remove("menu-open");
    $(".nav__menu").setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
    lenis?.start();
    menuTl.pause();
    gsap.to(menu, {
      clipPath: menuCircle(0),
      duration: reduceMotion ? 0.01 : 0.8,
      ease: "expo.inOut",
      overwrite: true,
      onComplete: () => gsap.set(menu, { visibility: "hidden" }),
    });
  }

  /* ------------------------------------------------------------------ *
   * Nav hides on scroll down, returns on scroll up
   * ------------------------------------------------------------------ */
  function navOnScroll() {
    const nav = $(".nav");
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        if (menuOpen) return;
        nav.classList.toggle("is-hidden", self.direction === 1 && self.scroll() > window.innerHeight * 0.6);
      },
    });
  }

})();
