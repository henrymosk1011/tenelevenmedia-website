# TENELEVENMEDIA — website

Portfolio site for the TENELEVENMEDIA web design studio. It's a static site (plain HTML, CSS and JS) with no build step, so it runs on any static host.

## What's on the page

| Section | Motion |
| --- | --- |
| **Hero** | Plays its entrance animation as soon as the page loads (there's no loading screen). WebGL liquid gradient that follows the cursor, a giant `TENELEVEN` wordmark, and a rotating badge that scrolls you down when clicked. The hero pins while the next section slides over it |
| **About** | The paragraph lights up word by word as you scroll |
| **Marquee** | Two crossing tape bands that loop forever, speed up as you scroll and reverse when you scroll back |
| **Selected work** | Pinned **horizontal scroll** gallery. Cards skew with scroll speed, screenshots shift inside their frames, and hovering a card scrolls through the full-page screenshot |
| **Services** | Sticky cards that stack on top of each other, shrinking and dimming as the next one arrives |
| **Big type** | Huge rows of text that slide sideways in opposite directions as you scroll |
| **Process** | Pinned section with a dial: the ring fills, a marker lights up and the big step number rolls over for each of the four steps, ending on **Live** |
| **Index** | A list of every project. A floating preview follows the cursor |
| **Contact** | Footer revealed from behind the page with a second liquid gradient, a magnetic "Start a project" button and the current studio time |

Throughout the site: a "Visit ↗" label that appears next to the pointer over projects, magnetic buttons, a full-screen menu that opens as a circle, film grain, and a nav that hides as you scroll down.

**Scrolling and the mouse respond instantly.** The site uses the browser's own scrolling (no smooth-scroll library), every scroll animation is tied directly to the scroll position with no catch-up delay, and the normal system cursor is never hidden or replaced.

**Accessibility:** if someone has *reduce motion* turned on in their system settings, the site switches off the pinning, scroll animation and WebGL animation. The gallery becomes a normal swipeable row and the process dial is shown complete. Keyboard focus is visible, and there's a skip link.

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
    year: "2026",
    image: "",            // optional — see screenshots below
    accent: "#ff4d1f",    // colour of the generated cover / hover glow
  },
  ...
];
```

The horizontal gallery, the project count, the index list and the cursor previews are all built from this list.

## Screenshots of each site

Until a project has a screenshot, it gets a generated cover in its `accent` colour, so the site never looks empty. To capture real screenshots automatically:

```bash
npm install
npx playwright install chromium
npm run shots                 # captures every project
npm run shots -- --only client-name   # just one (slug = title in kebab-case)
npm run shots -- --viewport           # first screen only instead of full page
```

This saves JPEGs to `assets/work/` and writes `js/screenshots.js`, which the site picks up automatically. Full-page captures (up to 4800px tall by default) scroll inside the browser frame when you hover a card.

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

The domain is registered at Squarespace. In Squarespace → Domains → tenelevenmedia.com → DNS → DNS Settings, delete the **Squarespace Defaults** record set (its `A @` and `CNAME www` records point at Squarespace's servers), make sure domain forwarding is off, then add these under **Custom records**:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `www` | `henrymosk1011.github.io` |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

Then in GitHub → Settings → Pages, confirm the custom domain reads `www.tenelevenmedia.com`, wait for the DNS check to pass, and tick **Enforce HTTPS**. The bare `tenelevenmedia.com` redirects to `www` automatically.

## Customising

- **Colours:** the CSS variables at the top of `css/style.css` (`--ink`, `--bone`, `--accent`, `--violet`). The liquid gradient colours are passed into `new Fluid(...)` in `js/main.js`.
- **Fonts:** [Geist](https://fonts.google.com/specimen/Geist) for display and body, [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) for italic accents, and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) for labels. They're loaded from Google Fonts in `index.html`. To try another typeface, change the family in that `<link>` and the `--f-display` variable in `css/style.css`.
- **Copy:** all text lives in `index.html`. The site copy is written without dashes, so keep it that way when editing, including in project categories.

## Files

```
index.html            page markup and copy
css/style.css         all styles
js/projects.js        ← your projects, email, socials
js/screenshots.js     auto-generated screenshot map
js/main.js            animations and interactions
js/fluid.js           WebGL liquid gradient
vendor/               GSAP 3.13 + ScrollTrigger (self-hosted)
scripts/screenshot.mjs  Playwright screenshot capture
assets/               favicon, project screenshots
CNAME                 custom domain for GitHub Pages
```

GSAP is used under the [GreenSock standard license](https://gsap.com/standard-license) (free, including for commercial sites).
