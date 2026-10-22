#!/usr/bin/env node
/* ==========================================================================
   Portfolio sync: makes the site's project list match the admin dashboard
   --------------------------------------------------------------------------
   The Portfolio page of the TENELEVEN admin dashboard is where projects are
   added, ordered, hidden and renamed. This script reads that list (the
   database's public portfolio_feed(), which returns only what the site already
   shows to everyone) and:

     1. rewrites window.PROJECTS in js/projects.js (window.SITE and everything
        above it are left alone),
     2. takes screenshots of projects that don't have one yet, or that asked
        for a new one ("New screenshot" in the dashboard), with
        scripts/screenshot.mjs,
     3. writes js/portfolio.json: what the site now shows, which the dashboard
        reads to tell you what's live.

   The "Portfolio sync" GitHub workflow runs it every 30 minutes, and right
   away when the dashboard's "Publish now" asks it to, then commits the result.

   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   node scripts/sync-portfolio.mjs [options]

     --plan               only work out what would change; write nothing
     --feed-out <file>    save the list that was read (for a later --feed)
     --feed <file>        use a saved list instead of reading the database
     --no-shots           don't take screenshots
   ========================================================================== */

import { readFile, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : undefined;
};
const plan = flag("plan");
const noShots = flag("no-shots");

// Exactly js/main.js's slugify(), which names the screenshot files.
const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-");

/** Writes `key=value` for the workflow's later steps (and prints it). */
async function output(key, value) {
  console.log(`${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`, { flag: "a" });
}
const notice = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::notice::${msg}` : msg);
const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `warning: ${msg}`);

// ---- 1. Read the dashboard's portfolio ---------------------------------------

async function readFeed() {
  if (opt("feed")) return JSON.parse(await readFile(opt("feed"), "utf8"));
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) return null;
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(`${url}/rest/v1/rpc/portfolio_feed`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) return await r.json();
      last = new Error(`the database answered ${r.status}: ${(await r.text()).slice(0, 200)}`);
    } catch (e) {
      last = e;
    }
    await new Promise((res) => setTimeout(res, attempt * 5000));
  }
  throw last;
}

const HEX = /^#[0-9a-f]{6}$/;
const CAPTURES = new Set(["auto", "stitch", "reduced-motion", "stitch-reduced-motion"]);
const DASHES = /[-‐‑‒–—―]/;

/** Checks every entry before anything is written; a bad list changes nothing. */
function validate(feed) {
  if (!Array.isArray(feed)) throw new Error("the portfolio feed isn't a list");
  const slugs = new Set();
  return feed.map((p, i) => {
    const where = `portfolio entry ${i + 1}`;
    if (!p || typeof p !== "object") throw new Error(`${where} isn't an object`);
    const title = String(p.title ?? "").trim();
    const slug = slugify(title);
    if (!title || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`${where} has no usable title`);
    if (slugs.has(slug)) throw new Error(`two entries are called "${title}"`);
    slugs.add(slug);
    let url;
    try {
      url = new URL(p.url);
    } catch {
      throw new Error(`${title} has no valid web address`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${title}'s address isn't a website`);
    const category = String(p.category ?? "").trim();
    if (DASHES.test(category)) throw new Error(`${title}'s category has a dash (the site is written without them)`);
    if (p.year != null && !/^\d{4}$/.test(String(p.year))) throw new Error(`${title}'s year isn't four digits`);
    const accent = HEX.test(String(p.accent)) ? String(p.accent) : "#ff4d1f";
    const capture = CAPTURES.has(p.capture) ? p.capture : "auto";
    const shot_version = Number.isInteger(p.shot_version) && p.shot_version > 0 ? p.shot_version : 1;
    if (typeof p.id !== "string" || !p.id) throw new Error(`${title} has no id`);
    return { id: p.id, title, slug, url: url.href, category, year: p.year == null ? null : String(p.year), accent, capture, shot_version };
  });
}

// ---- 2. What the site has now ----------------------------------------------------

async function loadWindow(file) {
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(await readFile(path.join(ROOT, file), "utf8"), sandbox);
  } catch {}
  return sandbox.window;
}
async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, file), "utf8"));
  } catch {
    return fallback;
  }
}

/** js/projects.js with its PROJECTS list replaced; everything before it (SITE, comments) is kept. */
async function projectsJs(items) {
  const src = await readFile(path.join(ROOT, "js/projects.js"), "utf8");
  const at = src.search(/^(\/\/[^\n]*\n)*window\.PROJECTS\s*=/m);
  if (at < 0) throw new Error("js/projects.js has no window.PROJECTS to replace");
  const list = items.map((p) => ({
    title: p.title,
    url: p.url,
    category: p.category,
    ...(p.year ? { year: p.year } : {}),
    accent: p.accent,
    ...(p.capture !== "auto" ? { capture: p.capture } : {}),
  }));
  return `${src.slice(0, at)}// Written by scripts/sync-portfolio.mjs from the admin dashboard's Portfolio
// page. Changes made here are replaced at the next sync: make them there.
window.PROJECTS = ${JSON.stringify(list, null, 2)};
`;
}

// ---- Run --------------------------------------------------------------------------

let feed;
try {
  feed = await readFeed();
} catch (e) {
  // A paused or unreachable database isn't the site's problem: leave it as it is.
  warn(`Couldn't read the portfolio from the dashboard (${e.message}). The site is unchanged.`);
  await output("connected", "false");
  process.exit(0);
}
if (feed === null) {
  notice("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY aren't set, so there's no dashboard to sync from yet. The site is unchanged.");
  await output("connected", "false");
  process.exit(0);
}
if (opt("feed-out")) await writeFile(opt("feed-out"), JSON.stringify(feed));

const items = validate(feed);
if (!items.length) {
  // Never empty the portfolio by accident (a fresh database, a bad query…).
  throw new Error("The dashboard's portfolio is empty, so nothing was changed. Show at least one project on the Portfolio page.");
}

const shots = (await loadWindow("js/screenshots.js")).SCREENSHOTS || {};
const previous = await readJson("js/portfolio.json", { items: [] });
const prevById = new Map((previous.items || []).map((x) => [x.id, x]));
/**
 * The screenshot version the site has: from the last sync, or (before the first one)
 * whatever's already there. A project the last sync didn't have, or whose address
 * changed, gets a new screenshot even when one by its title exists: that's a client's
 * new site taking the old one's place.
 */
function hasVersion(p) {
  if (!shots[p.slug]) return 0;
  const prev = prevById.get(p.id);
  if (prev) return prev.url === p.url ? prev.shot_version : 0;
  return previous.items?.length ? 0 : p.shot_version;
}
const needShot = items.filter((p) => hasVersion(p) < p.shot_version);
const nextJs = await projectsJs(items);
const jsChanged = nextJs !== (await readFile(path.join(ROOT, "js/projects.js"), "utf8"));

await output("connected", "true");
await output("shots", noShots ? 0 : needShot.length);
console.log(`${items.length} project(s) in the dashboard; js/projects.js ${jsChanged ? "changes" : "is up to date"}; ${needShot.length} screenshot(s) to take${needShot.length ? `: ${needShot.map((p) => p.slug).join(", ")}` : ""}.`);
if (plan) process.exit(0);

await writeFile(path.join(ROOT, "js/projects.js"), nextJs);

// Screenshots, which read the js/projects.js just written.
const captured = new Set();
if (needShot.length && !noShots) {
  const report = path.join(tmpdir(), `portfolio-shots-${process.pid}.json`);
  try {
    execFileSync(process.execPath, [path.join(ROOT, "scripts/screenshot.mjs"), "--only", needShot.map((p) => p.slug).join(","), "--report", report], { stdio: "inherit", cwd: ROOT });
    for (const s of JSON.parse(await readFile(report, "utf8")).captured) captured.add(s);
  } catch (e) {
    warn(`Screenshots didn't finish (${e.message}). Those projects show their colour cover until the next sync tries again.`);
  } finally {
    await rm(report, { force: true });
  }
  const missed = needShot.filter((p) => !captured.has(p.slug)).map((p) => p.title);
  if (missed.length) warn(`No screenshot yet for ${missed.join(", ")}. The next sync tries again.`);
}

// What the site shows now, for the dashboard. A screenshot request only counts
// as done once it's captured, so a failed one is retried next time.
const after = (await loadWindow("js/screenshots.js")).SCREENSHOTS || {};
const liveItems = items.map((p) => ({
  id: p.id, title: p.title, url: p.url, category: p.category, year: p.year, accent: p.accent,
  shot_version: captured.has(p.slug) ? p.shot_version : Math.min(p.shot_version, hasVersion(p)),
  shot: !!after[p.slug],
}));
// Keep the old timestamp when nothing changed, so a quiet sync makes no commit.
const same = JSON.stringify(liveItems) === JSON.stringify(previous.items);
const feedOut = { synced_at: same && previous.synced_at ? previous.synced_at : new Date().toISOString(), items: liveItems };
await writeFile(path.join(ROOT, "js/portfolio.json"), JSON.stringify(feedOut, null, 2) + "\n");
console.log(same && !jsChanged && !captured.size ? "Nothing changed." : "Portfolio updated.");
