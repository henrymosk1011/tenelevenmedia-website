// Builds v1/index.html: version 1 of the site, encrypted behind a password.
//
//   PASSWORD='your password' npm run lock-v1
//
// Version 1's page is read from git (it lived at the site root up to the
// commit below), its stylesheet and scripts are inlined into one HTML file,
// and that file is encrypted with AES-256-GCM using a key derived from the
// password (PBKDF2, SHA-256, 600,000 rounds). v1/index.html then holds only
// the encrypted data and a small unlock form; the browser decrypts it when
// the right password is entered. The password itself is never stored.
//
// Shared files (js/projects.js, js/screenshots.js, the screenshots in
// assets/work and the GSAP library) stay public and are loaded live, so
// version 1 always shows the current project list.
//
// Note: this keeps version 1 off the public site, but its source is still in
// this repository's git history, which is public while the repo is public.

import { execFileSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const V1_COMMIT = process.argv[2] || "4140d2bc3ec6fc3c572d7f68278c2cd3190ffa9d";
const ITERATIONS = 600000;
const password = process.env.PASSWORD || "";

if (password.length < 12) {
  console.error("Set a password of at least 12 characters: PASSWORD='...' npm run lock-v1");
  process.exit(1);
}

const show = (path) => execFileSync("git", ["show", `${V1_COMMIT}:${path}`], { encoding: "utf8", maxBuffer: 1 << 26 });
const inlineScript = (src) => `<script>\n${show(src).replace(/<\/script/gi, "<\\/script")}\n</script>`;
const swap = (html, from, to) => {
  if (!html.includes(from)) throw new Error(`version 1 page no longer contains: ${from}`);
  return html.replace(from, () => to); // a function, so "$$" etc. in the code are kept as written
};

/* ---------- version 1 as one self-contained page ---------- */
let page = show("index.html");
page = swap(page, '<link rel="canonical" href="https://www.tenelevenmedia.com/" />', '<meta name="robots" content="noindex" />');
page = swap(page, '<meta property="og:url" content="https://www.tenelevenmedia.com/" />\n', "");
page = swap(page, "<title>TENELEVENMEDIA | Web Design Studio</title>", "<title>TENELEVENMEDIA | Version 1</title>");
page = swap(page, 'href="assets/favicon.svg"', 'href="../assets/favicon.svg"');
page = swap(page, '<link rel="stylesheet" href="css/style.css" />', `<style>\n${show("css/style.css")}\n</style>`);
page = swap(page, '<script src="vendor/gsap.min.js"></script>', '<script src="../vendor/gsap.min.js"></script>');
page = swap(page, '<script src="vendor/ScrollTrigger.min.js"></script>', '<script src="../vendor/ScrollTrigger.min.js"></script>');
page = swap(page, '<script src="js/projects.js"></script>', '<script src="../js/projects.js"></script>');
// the page now lives one folder down, so point screenshot paths back up to the root
page = swap(page, '<script src="js/screenshots.js"></script>', `<script src="../js/screenshots.js"></script>
  <script>
    (function () {
      var up = function (s) { return typeof s === "string" && s && !/^(https?:)?\\/\\/|^\\/|^data:/.test(s) ? "../" + s : s; };
      var shots = window.SCREENSHOTS || {};
      Object.keys(shots).forEach(function (k) { var v = shots[k]; shots[k] = typeof v === "string" ? up(v) : { poster: up(v.poster), full: up(v.full) }; });
      (window.PROJECTS || []).forEach(function (p) { if (p.image) p.image = up(p.image); });
    })();
  </script>`);
page = swap(page, '<script src="js/fluid.js"></script>', inlineScript("js/fluid.js"));
page = swap(page, '<script src="js/main.js"></script>', inlineScript("js/main.js"));

/* ---------- encrypt ---------- */
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(page)));
const b64 = (u8) => Buffer.from(u8).toString("base64");
const payload = [b64(salt), b64(iv), b64(sealed)].join(".");

/* ---------- the unlock page ---------- */
const lock = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TENELEVENMEDIA | Version 1</title>
  <meta name="robots" content="noindex" />
  <meta name="theme-color" content="#0c0c0d" />
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..900&family=Instrument+Serif:ital@1&family=JetBrains+Mono:wght@400;500&display=swap" />
  <!-- built by scripts/lock-v1.mjs: version 1 is encrypted below and needs the password to open -->
  <style>
    :root { --ink: #0c0c0d; --bone: #f1ede6; --dim: rgba(241, 237, 230, 0.74); --line: rgba(241, 237, 230, 0.2); --accent: #ff4d1f; --accent-text: #ff9a78; color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: radial-gradient(70vw 50vw at 20% 10%, rgba(107, 91, 255, 0.2), transparent 70%), radial-gradient(60vw 50vw at 90% 90%, rgba(255, 77, 31, 0.14), transparent 70%), var(--ink); color: var(--bone); font: 16px/1.5 Geist, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    main { width: min(100%, 420px); display: grid; gap: 1.4rem; }
    .mono { font: 500 12px/1.4 "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.04em; text-transform: uppercase; color: var(--dim); }
    .mono b { color: var(--accent-text); font-weight: 500; }
    h1 { margin: 0; font-size: clamp(2.6rem, 9vw, 3.6rem); font-weight: 800; line-height: 0.92; letter-spacing: -0.05em; }
    h1 em { font-family: "Instrument Serif", Georgia, serif; font-weight: 400; letter-spacing: -0.02em; }
    p { margin: 0; color: var(--dim); }
    form { display: grid; gap: 0.6rem; }
    label { font-weight: 600; }
    .row { display: flex; gap: 8px; }
    input { flex: 1; min-width: 0; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(241, 237, 230, 0.06); color: var(--bone); font: inherit; }
    button { padding: 12px 18px; border: 0; border-radius: 12px; background: var(--bone); color: var(--ink); font: 600 1rem Geist, system-ui, sans-serif; cursor: pointer; }
    button[disabled] { opacity: 0.7; cursor: progress; }
    :focus-visible { outline: 2px solid var(--bone); outline-offset: 3px; }
    .error { min-height: 1.5em; color: var(--accent-text); }
    a { color: var(--bone); }
  </style>
</head>
<body>
  <main>
    <p class="mono"><b>(Archive)</b> TENELEVENMEDIA</p>
    <h1>Version <em>one.</em></h1>
    <p>The previous version of the site, kept for reference. Enter the password to open it.</p>
    <form id="unlock">
      <label for="pw">Password</label>
      <div class="row">
        <input id="pw" name="password" type="password" autocomplete="current-password" required aria-describedby="err" autofocus />
        <button type="submit">Open</button>
      </div>
      <p class="error" id="err" role="alert"></p>
    </form>
    <p><a href="../">Back to the current site</a></p>
  </main>
  <script>
    (function () {
      var PAYLOAD = "${payload}";
      var ITERATIONS = ${ITERATIONS};
      var form = document.getElementById("unlock"), input = document.getElementById("pw"), err = document.getElementById("err"), button = form.querySelector("button");
      var bytes = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!window.crypto || !crypto.subtle) { err.textContent = "This browser can't open the page (it needs a secure https connection)."; return; }
        button.disabled = true; button.textContent = "Opening";
        err.textContent = "";
        try {
          var parts = PAYLOAD.split(".").map(bytes);
          var base = await crypto.subtle.importKey("raw", new TextEncoder().encode(input.value), "PBKDF2", false, ["deriveKey"]);
          var key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: parts[0], iterations: ITERATIONS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
          var html = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: parts[1] }, key, parts[2]));
          document.open();
          document.write(html);
          document.close();
        } catch (x) {
          button.disabled = false; button.textContent = "Open";
          err.textContent = "That password didn't work. Try again.";
          input.select();
        }
      });
    })();
  </script>
</body>
</html>
`;

mkdirSync("v1", { recursive: true });
writeFileSync("v1/index.html", lock);
console.log(`v1/index.html written (version 1 from ${V1_COMMIT.slice(0, 7)}, ${(page.length / 1024).toFixed(0)} KB encrypted)`);
