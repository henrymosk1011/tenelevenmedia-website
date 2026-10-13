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

  // A screenshot is a path, or { poster, full } from scripts/screenshot.mjs: the
  // poster is the top of the page (what a card shows) and full is the whole page.
  const imageFor = (p) => {
    const shot = p.image || SHOTS[slugify(p.title)] || "";
    return typeof shot === "string" ? { poster: shot, full: shot } : shot;
  };

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
    const socials = SITE.socials || [];
    $$("[data-socials]").forEach((ul) => {
      ul.innerHTML = socials
        .map((s) => `<li><a class="link-underline" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`)
        .join("");
      // With no profiles yet, hide the list and, in the footer, its "Socials" label.
      (ul.closest(".footer__meta > div") || ul).style.display = socials.length ? "" : "none";
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
      const { poster, full } = imageFor(p);
      const media = poster
        ? `<img src="${esc(poster)}" data-poster="${esc(poster)}" data-full="${esc(full)}" alt="Screenshot of the ${esc(p.title)} website" loading="lazy" decoding="async" />`
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
              <span class="card__cat mono">${[p.category, p.year].filter(Boolean).map(esc).join(" · ")}</span>
            </div>
          </a>
        </article>`;
    }).join("");
  }

  function renderIndex() {
    const list = $("[data-index]");
    const preview = $("[data-preview]");
    if (!list) return;
    // Drop the Year column when no project lists a year.
    list.closest(".index")?.classList.toggle("index--no-year", !PROJECTS.some((p) => p.year));
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
        const { poster } = imageFor(p);
        return `<div class="index__preview-item" style="--accent:${esc(p.accent || "#ff4d1f")}">${
          poster ? `<img src="${esc(poster)}" alt="" loading="lazy" decoding="async" />` : coverHTML(p)
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
    root.classList.remove("intro");
    fitText();
    window.addEventListener("resize", fitText);
    heroFluid?.start();
    footFluid?.start();
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  // Don't re-measure when a phone's address bar shows or hides mid-scroll;
  // that would shift pinned sections while the user is scrolling.
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Native scrolling (no smooth-scroll library) so the page responds instantly.
  const scrollToTarget = (target) => {
    const top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  };

  // anchor links
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2 && id !== "#") return;
      const target = id === "#top" || id === "#" ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      closeMenu();
      scrollToTarget(target);
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
  // wait for webfonts (so text measures correctly), but never longer than 2.5s
  const fontsReady = Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  fontsReady.then(() => {
    fitText();
    window.addEventListener("resize", () => {
      fitText();
    });
    init();
  });

  function init() {
    if (!motion) {
      staticDial();
      heroFluid?.start();
      footFluid?.start();
      setupCursor();
      setupMenu();
      return;
    }

    heroFluid?.start();
    heroIntro();

    heroScroll();
    reveals();
    manifesto();
    marquees();
    horizontalWork();
    stackCards();
    bigType();
    processDial();
    indexPreview();
    footer();
    setupCursor();
    setupMagnetic();
    setupMenu();
    navOnScroll();

    ScrollTrigger.refresh();
  }

  /* ------------------------------------------------------------------ *
   * Hero entrance
   * ------------------------------------------------------------------ */
  function heroIntro() {
    const tl = gsap.timeline({ delay: 0.1 });
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
    // everything now starts from its hidden state, so the page can be shown
    root.classList.remove("intro");
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
      scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true },
    });
    tl.to(scrubWords, { opacity: 1, ease: "none", stagger: 0.1, duration: 0.6 }, 0);
    $$(".pill", el).forEach((pill) => {
      gsap.from(pill, {
        scaleX: 0,
        transformOrigin: "left center",
        ease: "none",
        scrollTrigger: { trigger: pill, start: "top 85%", end: "top 55%", scrub: true },
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Marquee — infinite loop that speeds up & reverses with scroll
   * ------------------------------------------------------------------ */
  function marquees() {
    // page scroll speed (px per frame) and direction, decaying to 0 when scrolling stops
    let scrollV = 0;
    let lastScroll = 0;
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        scrollV = self.getVelocity() / 60;
        lastScroll = performance.now();
      },
    });

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
        const v = performance.now() - lastScroll < 120 ? scrollV : 0;
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
    const progressBar = $(".work__progress i");

    // Cards sliding under a still cursor would keep starting their hover effects
    // (the shadow glow and the screenshot scroll), which are costly to repaint
    // every frame. Ignore the pointer while the track moves.
    let hoverTimer;
    function pauseHover() {
      section.classList.add("is-scrolling");
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => section.classList.remove("is-scrolling"), 150);
    }

    // Cards lean with the speed of the track itself. The track glides between
    // mouse wheel notches, so the lean stays steady instead of springing back
    // toward zero after every notch; it settles once the track has stopped.
    const skewSetters = cards.map((c) => gsap.quickTo(c, "skewX", { duration: 0.6, ease: "power3.out" }));
    let lastX = 0;
    let lastT = 0;
    let skewTimer;
    function skewWithTrack() {
      const x = gsap.getProperty(track, "x");
      const t = performance.now();
      const v = lastT ? (x - lastX) / Math.max(t - lastT, 1) : 0; // px per ms
      lastX = x;
      lastT = t;
      skewSetters.forEach((set) => set(gsap.utils.clamp(-7, 7, v * 2.5)));
      clearTimeout(skewTimer);
      skewTimer = setTimeout(() => {
        lastT = 0;
        skewSetters.forEach((set) => set(0));
      }, 100);
    }

    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      // runs every frame the track moves, including while it glides to a stop
      onUpdate() {
        if (progressBar) gsap.set(progressBar, { scaleX: this.progress() });
        skewWithTrack();
        if (finePointer) pauseHover();
      },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: ".work__pin",
        // glide to the scroll position, so mouse wheel notches and fast flicks
        // move the track smoothly instead of in jumps
        scrub: 0.8,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });

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

      // On hover the full-page screenshot scrolls inside the frame. Cards show
      // the light poster image; the full one is decoded only while hovered,
      // which keeps the gallery from decoding six huge images as it scrolls.
      const img = $("img", card);
      const shot = $(".card__shot", card);
      if (img && shot) {
        const link = $(".card__link", card);
        const { poster, full } = img.dataset;
        let hovered = false;
        link.addEventListener("mouseenter", async () => {
          hovered = true;
          if (full !== poster && img.getAttribute("src") !== full) {
            const pre = new Image();
            pre.src = full;
            try {
              await pre.decode();
            } catch {
              return;
            }
            if (!hovered) return;
            img.src = full; // same top of page as the poster, so the swap is invisible
            if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
            if (!hovered) return;
          }
          const overflow = img.offsetHeight - shot.offsetHeight;
          if (overflow > 20) gsap.to(img, { y: -overflow, duration: Math.min(8, overflow / 300), ease: "power1.inOut", overwrite: true });
        });
        link.addEventListener("mouseleave", () => {
          hovered = false;
          gsap.to(img, {
            y: 0,
            duration: 1.2,
            ease: "expo.out",
            overwrite: true,
            onComplete: () => {
              if (!hovered && img.getAttribute("src") !== poster) img.src = poster;
            },
          });
        });
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
          scrollTrigger: { trigger: ".bigtype", start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
        }
      );
    });
  }

  /* ------------------------------------------------------------------ *
   * Process — the clock winds to 10:11 as you scroll the steps
   * ------------------------------------------------------------------ */
  // Static dial (no scroll animation): show it complete
  function staticDial() {
    $(".dial__progress")?.style.setProperty("stroke-dashoffset", "0");
    $$(".dial__nodes circle").forEach((n) => n.classList.add("is-on"));
    const track = $(".dial__count-track");
    if (track) track.style.transform = "translateY(-75%)";
    const status = $(".dial__status");
    if (status) {
      status.textContent = "Live";
      status.classList.add("is-live");
    }
  }

  function processDial() {
    const section = $(".process");
    if (!section) return;
    const steps = $$(".step", section);
    const nodes = $$(".dial__nodes circle", section);
    const track = $(".dial__count-track", section);
    const status = $(".dial__status", section);

    section.classList.add("is-pinned");
    gsap.set(steps, { opacity: 0, y: 60 });
    gsap.set(steps[0], { opacity: 1, y: 0 });

    const state = { p: 0 };
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${window.innerHeight * 3}`,
        pin: ".process__pin",
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    const dur = steps.length; // one unit per step
    tl.to(state, {
      p: 1,
      duration: dur,
      onUpdate: () => {
        const pct = Math.round(state.p * 100);
        status.textContent = pct >= 100 ? "Live" : `${pct}%`;
        status.classList.toggle("is-live", pct >= 100);
        nodes.forEach((n, i) => n.classList.toggle("is-on", state.p >= i / nodes.length));
      },
    }, 0);
    tl.to(".dial__progress", { strokeDashoffset: 0, duration: dur }, 0);
    tl.to(".dial__text", { rotation: -270, svgOrigin: "200 200", duration: dur }, 0);
    tl.to(".dial__inner", { rotation: 180, svgOrigin: "200 200", duration: dur }, 0);

    steps.forEach((step, i) => {
      if (i > 0) {
        tl.to(step, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, i - 0.1);
        tl.to(track, { yPercent: (-100 * i) / steps.length, duration: 0.35, ease: "power3.inOut" }, i - 0.15);
      }
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

    const xTo = gsap.quickTo(box, "x", { duration: 0.12, ease: "power2.out" });
    const yTo = gsap.quickTo(box, "y", { duration: 0.12, ease: "power2.out" });
    const rTo = gsap.quickTo(box, "rotation", { duration: 0.5, ease: "power3.out" });
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
      fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: SITE.timezone, timeZoneName: "short" });
    } catch {
      fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
    }
    const tick = () => {
      const parts = fmt.formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t)?.value || "";
      el.textContent = `${get("hour")}:${get("minute")} ${get("dayPeriod")} ${get("timeZoneName")}`;
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
    const ring = $(".cursor__ring", cursor);
    const label = $(".cursor__label", cursor);

    // positioned directly on every pointer event: no easing, no trailing
    window.addEventListener("pointermove", (e) => {
      ring.style.translate = `${e.clientX}px ${e.clientY}px`;
    }, { passive: true });

    document.addEventListener("pointerover", (e) => {
      const labelled = e.target.closest("[data-cursor]");
      cursor.classList.toggle("is-label", !!labelled);
      if (labelled) label.textContent = labelled.dataset.cursor;
    });
    document.addEventListener("pointerleave", () => cursor.classList.remove("is-label"));
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
      root.style.overflow = "hidden";
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
    root.style.overflow = "";
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
