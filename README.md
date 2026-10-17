# TENELEVENMEDIA — website

Portfolio site for the TENELEVENMEDIA web design studio. It's a static site (plain HTML, CSS and JS) with no build step, so it runs on any static host.

## What's on the page

The homepage plays like a film as you scroll. One fixed WebGL canvas (Three.js) sits behind the page, and the scroll position drives a camera through seven chapters:

| Chapter | What plays |
| --- | --- |
| **Intro** | A liquid chrome core with orbit rings in front of a giant `TENELEVEN` wordmark |
| **Studio** | The core burns away into about 40,000 particles that stream into a spiralling tunnel while the paragraph lights up word by word |
| **Rhythm** | The particles settle into glowing sound wave ridgelines |
| **Work** | A corridor of floating, curved project screens. Each site scrolls inside its screen as you fly past; click a screen or its caption to visit |
| **Services** | The particles assemble a browser window, a torus knot, the ✺ mark and a shield, one per service |
| **Process** | A dial that fills step by step and lands on **Live** |
| **Contact** | The core re-forms, molten orange, between the two lines of "Let's make something loud." |

There's a timeline along the bottom like a video player: drag or click it to jump, or press **Play** and the page scrolls itself through the whole film (about 71 seconds). Any scroll, swipe or key press hands control back. The menu links fast forward to their chapter.

- **Scrolling** is the browser's own (no smooth-scroll library). Text is tied straight to the scrollbar; the 3D catches up over about a tenth of a second so it moves fluidly.
- **Phones and slower machines** get fewer particles and a lower resolution automatically, and the resolution drops further if frames start running slow.
- **Tuning:** `DURATION` (Play length) and `FOLLOW` (how quickly the 3D catches up with the scrollbar) are at the top of `js/main.js`. The camera path, colours and timing for each chapter are keyframes in `build()` in `js/scene.js`.

### Accessibility (WCAG 2.2 AA)

The site is built to meet WCAG 2.2 level AA, the standard ADA claims are usually measured against:

- **Motion switch** in the nav turns the 3D off (or on) for anyone, and the choice is remembered. Without a choice, the system *reduce motion* setting decides. With motion off, the same content shows as a still page that scrolls normally, with a grid of project screenshots. Browsers without WebGL 2 get the still page too.
- **Zoom and small windows:** if the film's layout doesn't fit (200% zoom, phone in landscape, very short windows), the page switches to the still version automatically, so nothing is clipped and nothing scrolls sideways.
- **Keyboard:** every link and control is reachable with Tab and shows a focus ring. Focusing something in a faded out chapter brings that chapter on screen. The timeline is a real slider (arrow keys, Page Up/Down) and Play can be paused.
- **Screen readers:** one `h1`, an `h2` for every chapter, the studio paragraph read as one sentence, links that say where they go and that they open a new tab, and the 3D canvas hidden from assistive tech.
- **Contrast:** all text meets 4.5:1 (3:1 for large text), measured against the pixels actually rendered behind it, including the 3D. Small orange text uses the lighter `--accent-text`, and text over the film has a soft dark halo.

**How it was checked:** axe-core (WCAG 2.0, 2.1 and 2.2 A/AA rules) at every chapter on desktop and phone, in the film and the still page; a contrast check of every visible piece of text against a screenshot of what's behind it; a Tab walk confirming each stop is visible, unobscured and ringed; zoom/reflow at 320px wide, 200% and 400%; and tests of the Motion switch, the remembered setting and the slider. All passed. Automated tools can't cover everything, so before advertising formal compliance have it tested with VoiceOver and NVDA by a person (ideally an outside audit).

**WAVE:** WebAIM's WAVE checks contrast from CSS colours, including text that is hidden at the moment, and it counts an element's own `opacity` against its text. So fades are always put on a wrapper (a chapter, `.panel`, `.step__more`, `.work__intro`), never on the element that directly holds the text. That keeps every piece of text at full contrast whenever it's shown, and WAVE reports 0 contrast errors.

When editing: keep new text above 4.5:1 (use `--bone-dim` or brighter for small grey text, `--accent-text` for small orange text), fade wrappers rather than text elements, and don't hide content behind `opacity: 0` without checking it with the keyboard.

## Version 1 (`/v1/`, password protected)

The previous design (GSAP horizontal gallery, liquid gradient hero, stacking service cards) is kept at **www.tenelevenmedia.com/v1/** behind a password. It still loads the current `js/projects.js` and screenshots, so it always shows today's project list.

The page is encrypted, not just hidden: `v1/index.html` holds version 1 as AES-256-GCM encrypted data (key from the password via PBKDF2, 600,000 rounds) plus a small unlock form, and the browser decrypts it only when the right password is entered. The password is never stored anywhere.

To change the password (or rebuild after changing the shared files version 1 uses):

```bash
PASSWORD='your new password' npm run lock-v1
```

then commit the new `v1/index.html`. Use at least 12 characters (a long passphrase is best). The script rebuilds version 1 from git commit `4140d2b`, the last commit where it was the homepage.

Keep in mind: this keeps version 1 off the public site and out of search engines, but its source code is still in this repository's git history, which anyone can browse while the repository is public. For real privacy, make the repository private (GitHub Pages from a private repo needs a paid GitHub plan).

The old preview address `/next/` now redirects to the homepage.

## Adding your projects

Everything you'll usually change is in **`js/projects.js`**:

```js
window.SITE = {
  email: "hello@tenelevenmedia.com",
  timezone: "America/Los_Angeles",   // used by "Studio time" in the footer (PST/PDT)
  socials: [ { label: "Instagram", url: "https://instagram.com/..." }, ... ],
};

window.PROJECTS = [
  {
    title: "Client Name",
    url: "https://client-site.com",
    category: "E-commerce",
    year: "2026",         // optional; leave out to hide years
    image: "",            // optional — see screenshots below
    accent: "#ff4d1f",    // colour of the generated cover / hover glow
  },
  ...
];
```

The project screens, captions, the project count and the 01 to 09 index are all built from this list.

## Screenshots of each site

Until a project has a screenshot, it gets a generated cover in its `accent` colour, so the site never looks empty. To capture real screenshots automatically:

```bash
npm install
npx playwright install chromium
npm run shots                 # captures every project
npm run shots -- --only client-name   # just one (slug = title in kebab-case)
npm run shots -- --viewport           # first screen only instead of full page
npm run shots -- --only client-name --stitch   # if a capture has blank gaps (see below)
npm run shots -- --only client-name --reduced-motion   # if a site pins sections (see below)
```

This saves JPEGs to `assets/work/` and writes `js/screenshots.js`, which the site picks up automatically. Each capture also gets a `-poster.jpg` copy cropped to the top of the page: the 3D screens show that light image, and on desktops the full-page capture (up to 4800px tall by default) loads as the camera approaches and scrolls inside the screen as you fly past.

Some sites, often Webflow builds, hide sections again once you scroll past them, so those sections come out blank in a full-page capture. `--stitch` fixes that by capturing one screen at a time and joining them.

Sites that pin sections in place while you scroll (Scent and Story is one) come out with blank gaps in a normal capture and doubled sections when stitched. `--reduced-motion` loads the site with the system "reduce motion" setting on, which on sites that support it shows every section in place with no pinning. If a site ignores that setting, the capture comes out the same as a normal one. If photos far down the page come out as blank boxes, add `--stitch` as well, so every part of the page is captured on screen (that's how Scent and Story was captured).

You can also use your own image: put it in `assets/work/` and set `image: "assets/work/your-file.jpg"` on the project.

## Running locally

```bash
npm run dev        # http://localhost:3000
# or
python3 -m http.server 3000
```

Opening `index.html` straight from the file system mostly works, but a local server is closer to the real hosting.

## Deploying

The site is static, so any of these work:

- **GitHub Pages:** go to Settings → Pages → Deploy from branch → `main` / root. The `.nojekyll` file is already there, and the `CNAME` file sets the custom domain to `www.tenelevenmedia.com`.
- **Netlify / Vercel / Cloudflare Pages:** import the repo with no build command and `/` as the output folder.

### Custom domain (www.tenelevenmedia.com)

The domain is registered at Squarespace. Add the custom domain on the GitHub side first (the `CNAME` file on `main` does this), then in Squarespace → Domains → tenelevenmedia.com → DNS → DNS Settings → **Custom records**, point the web records at GitHub Pages:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `www` | `henrymosk1011.github.io` |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

Leave the other records alone: the `MX`, `autodiscover` CNAME and SPF `TXT` records run the Microsoft 365 email, and the `googlehosted.com` CNAME is a Google verification record.

Then in GitHub → Settings → Pages, confirm the custom domain reads `www.tenelevenmedia.com`, wait for the DNS check to pass, and tick **Enforce HTTPS**. The bare `tenelevenmedia.com` redirects to `www` automatically.

## Customising

- **Colours:** the CSS variables at the top of `css/style.css` (`--ink`, `--bone`, `--accent`, `--violet`, `--accent-text`). The 3D colours are in `PAL` at the top of `js/scene.js`, and each chapter's particle and sky colours are keyframes in `build()`.
- **Fonts:** [Geist](https://fonts.google.com/specimen/Geist) for display and body, [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) for italic accents, and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) for labels. They're loaded from Google Fonts in `index.html`. To try another typeface, change the family in that `<link>` and the `--f-display` variable in `css/style.css`.
- **Copy:** all text lives in `index.html`. The site copy is written without dashes, so keep it that way when editing, including in project categories.

## Files

```
index.html            page markup and copy
css/style.css         all styles
js/projects.js        ← your projects, email, socials
js/screenshots.js     auto-generated screenshot map
js/main.js            scroll, timeline, Motion switch, chapter text
js/scene.js           the 3D film (Three.js scene, shaders, camera keyframes)
js/timeline.js        timing shared by the page and the 3D
vendor/three/         Three.js 0.185 (self-hosted)
vendor/gsap*.js       GSAP 3.13 + ScrollTrigger, used by version 1
v1/index.html         version 1, encrypted (built by scripts/lock-v1.mjs)
next/index.html       redirect from the old preview address
scripts/screenshot.mjs  Playwright screenshot capture
scripts/lock-v1.mjs   builds the password protected version 1
assets/               favicon, project screenshots
CNAME                 custom domain for GitHub Pages
```

Three.js is MIT licensed. GSAP is used under the [GreenSock standard license](https://gsap.com/standard-license) (free, including for commercial sites).
