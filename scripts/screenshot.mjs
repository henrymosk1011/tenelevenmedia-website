#!/usr/bin/env node
/* ==========================================================================
   Capture screenshots of every project in js/projects.js
   --------------------------------------------------------------------------
   npm install            (once — installs Playwright)
   npx playwright install chromium   (once — downloads the browser)
   npm run shots          (or: node scripts/screenshot.mjs)

   Options:
     --only <slug>        capture just one project (slug = lower-case title,
                          spaces → dashes, e.g. "project-one"), or several
                          separated by commas: --only one,two
     --max-height <px>    tallest capture in px (default 4800). Tall captures
                          scroll inside the browser frame on hover.
     --viewport           capture only the first screen (1440×900)
     --stitch             capture one screen at a time and join them. Use it
                          for sites whose animations reverse once scrolled
                          past, which show up as blank gaps otherwise.
     --reduced-motion     load the site with "reduce motion" turned on. Use it
                          for sites with pinned sections, which come out blank
                          in a full-page capture and doubled when stitched.
     --report <file>      also write which projects were captured and which
                          failed, as JSON (used by scripts/sync-portfolio.mjs)

   A project can ask for --stitch and/or --reduced-motion itself with
   capture: "stitch", "reduced-motion" or "stitch-reduced-motion" in
   js/projects.js (the admin dashboard sets this per site).

   Saves JPEGs to assets/work/ and writes js/screenshots.js, which the site
   reads automatically. Projects with an explicit `image` keep that image.
   Each full-page capture also gets a "-poster" copy cropped to the top of the
   page, which is what the cards show; the full image loads on hover.
   ========================================================================== */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};

const only = opt("only", null)?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const report = opt("report", null);
const maxHeight = parseInt(opt("max-height", "4800"), 10);
const viewportOnly = flag("viewport");
const stitch = flag("stitch");
const reducedMotion = flag("reduced-motion");

const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-");

// Load the project list exactly as the browser would.
const sandbox = { window: {} };
vm.runInNewContext(await readFile(path.join(ROOT, "js/projects.js"), "utf8"), sandbox);
const projects = (sandbox.window.PROJECTS || []).filter((p) => p.url && (!only || only.includes(slugify(p.title))));

// Keep previously captured screenshots when running with --only.
const existing = { window: {} };
try {
  vm.runInNewContext(await readFile(path.join(ROOT, "js/screenshots.js"), "utf8"), existing);
} catch {}
const map = { ...(existing.window.SCREENSHOTS || {}) };

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. Run `npm install` then `npx playwright install chromium`.");
  process.exit(1);
}

// Screenshot the page a screen at a time, as a visitor sees it, and join the
// pieces on a canvas. Pieces are taken every half screen and only their top
// half is kept, so each part of the page is captured after it has been on
// screen long enough to finish animating in. The first and last pieces are
// kept whole, and the first is drawn last so hero videos have no seam.
// Fixed and sticky headers are kept in the first piece only.
async function stitchCapture(page, height) {
  const { width, height: vh } = page.viewportSize();
  const step = Math.floor(vh / 2);
  const tiles = [];
  for (let y = 0; ; y += step) {
    const top = await page.evaluate((y) => (window.scrollTo(0, y), window.scrollY), y);
    const last = top < y || top + vh >= height;
    await page.waitForTimeout(1000);
    // Hide fixed or sticky headers. Checked on every piece, since some headers
    // only become fixed on scroll.
    if (tiles.length) {
      await page.evaluate(() => {
        for (const el of document.querySelectorAll("body *")) {
          const { position } = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if ((position === "fixed" || position === "sticky") && r.top < 50 && r.bottom > 0 && r.height < 200) {
            el.style.visibility = "hidden";
          }
        }
      });
    }
    tiles.push({ top, keep: last || !tiles.length ? vh : step, src: `data:image/png;base64,${(await page.screenshot()).toString("base64")}` });
    if (last) break;
  }
  const canvasPage = await page.context().newPage();
  const jpeg = await canvasPage.evaluate(
    async ({ tiles, width, height }) => {
      const canvas = Object.assign(document.createElement("canvas"), { width, height });
      const ctx = canvas.getContext("2d");
      for (const t of [...tiles.slice(1), tiles[0]]) {
        const img = new Image();
        img.src = t.src;
        await img.decode();
        ctx.drawImage(img, 0, 0, width, t.keep, 0, t.top, width, t.keep);
      }
      return canvas.toDataURL("image/jpeg", 0.82);
    },
    { tiles, width, height }
  );
  await canvasPage.close();
  return Buffer.from(jpeg.split(",")[1], "base64");
}

// Crop the top of a capture to the cards' 16:10 frame.
async function writePoster(context, file, poster) {
  const canvasPage = await context.newPage();
  const src = `data:image/jpeg;base64,${(await readFile(path.join(ROOT, file))).toString("base64")}`;
  const jpeg = await canvasPage.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const height = Math.min(img.height, Math.round(img.width / 1.6));
    const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height });
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.82);
  }, src);
  await canvasPage.close();
  await writeFile(path.join(ROOT, poster), Buffer.from(jpeg.split(",")[1], "base64"));
}

await mkdir(path.join(ROOT, "assets/work"), { recursive: true });
const browser = await chromium.launch();
// One browser context per motion setting, since a project can ask for reduced motion itself.
const contexts = {};
const contextFor = async (reduce) =>
  (contexts[reduce] ??= await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: reduce ? "reduce" : "no-preference",
  }));
const captured = [];
const failed = [];

for (const p of projects) {
  const slug = slugify(p.title);
  const file = `assets/work/${slug}.jpg`;
  const capture = String(p.capture || "");
  const stitchThis = stitch || capture.includes("stitch");
  const context = await contextFor(reducedMotion || capture.includes("reduced-motion"));
  const page = await context.newPage();
  process.stdout.write(`→ ${p.title} (${p.url}) … `);
  try {
    await page.goto(p.url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Scroll through the page so lazy-loaded images and scroll animations fire.
    // Small steps and a pass one screen past the capture height, so reveal
    // animations near the bottom edge get triggered too.
    await page.evaluate(async (limit) => {
      const step = window.innerHeight * 0.5;
      const end = Math.min(document.documentElement.scrollHeight, limit + window.innerHeight);
      for (let y = 0; y < end; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 300));
      }
      window.scrollTo(0, 0);
    }, maxHeight);
    await page.waitForTimeout(1500);

    const height = viewportOnly
      ? 900
      : Math.min(maxHeight, await page.evaluate(() => document.documentElement.scrollHeight));

    if (stitchThis && !viewportOnly) {
      await writeFile(path.join(ROOT, file), await stitchCapture(page, height));
    } else {
      await page.screenshot({
        path: path.join(ROOT, file),
        type: "jpeg",
        quality: 82,
        fullPage: !viewportOnly,
        clip: { x: 0, y: 0, width: 1440, height },
      });
    }
    if (viewportOnly) {
      map[slug] = file;
    } else {
      const poster = `assets/work/${slug}-poster.jpg`;
      await writePoster(context, file, poster);
      map[slug] = { poster, full: file };
    }
    captured.push(slug);
    console.log(`saved ${file} (${height}px tall)`);
  } catch (err) {
    failed.push(slug);
    console.log(`failed: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();

const out = `/* Auto-generated by scripts/screenshot.mjs — maps project slugs to screenshots.
   Safe to leave empty; projects without a screenshot get a generated cover. */
window.SCREENSHOTS = ${JSON.stringify(map, null, 2)};
`;
await writeFile(path.join(ROOT, "js/screenshots.js"), out);
console.log(`\nUpdated js/screenshots.js with ${Object.keys(map).length} screenshot(s).`);
if (report) await writeFile(report, JSON.stringify({ captured, failed }, null, 2));
