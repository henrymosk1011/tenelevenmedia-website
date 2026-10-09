# TENELEVENMEDIA — website

Portfolio site for the TENELEVENMEDIA web design studio. It's a static site (plain HTML, CSS and JS) with no build step, so it runs on any static host.

## What's on the page

| Section | Motion |
| --- | --- |
| **Preloader** | A clock counts up from `00:00` to `10:11`, then the columns lift away |
| **Hero** | WebGL liquid gradient that follows the cursor, a giant `TENELEVEN` wordmark, a rotating badge. The hero pins while the next section slides over it |
| **About** | The paragraph lights up word by word as you scroll |
| **Marquee** | Two crossing tape bands that loop forever, speed up as you scroll and reverse when you scroll back |
| **Selected work** | Pinned **horizontal scroll** gallery. Cards skew with scroll speed, screenshots shift inside their frames, and hovering a card scrolls through the full-page screenshot |
| **Services** | Sticky cards that stack on top of each other, shrinking and dimming as the next one arrives |
| **Big type** | Huge rows of text that slide sideways in opposite directions as you scroll |
| **Process** | Pinned section where an analogue clock winds from 12:00 to **10:11** through the four steps |
| **Index** | A list of every project. A floating preview follows the cursor |
| **Contact** | Footer revealed from behind the page with a second liquid gradient, a magnetic "Start a project" button and a live studio clock |

Throughout the site: Lenis smooth scrolling, a custom cursor with labels, magnetic buttons, a full-screen menu that opens as a circle, film grain, and a nav that hides as you scroll down.

**Accessibility:** if someone has *reduce motion* turned on in their system settings, the site switches off the smooth scrolling, pinning and WebGL animation. The gallery becomes a normal swipeable row and the clock shows 10:11 without animating. Keyboard focus is visible, and there's a skip link.

## Adding your projects

Everything you'll usually change is in **`js/projects.js`**:

```js
window.SITE = {
  email: "hello@tenelevenmedia.com",
  timezone: "America/New_York",   // used by the "Studio time" clock
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

- **GitHub Pages:** go to Settings → Pages → Deploy from branch → `main` / root. The `.nojekyll` file is already there.
- **Netlify / Vercel / Cloudflare Pages:** import the repo with no build command and `/` as the output folder.

## Customising

- **Colours:** the CSS variables at the top of `css/style.css` (`--ink`, `--bone`, `--accent`, `--violet`). The liquid gradient colours are passed into `new Fluid(...)` in `js/main.js`.
- **Fonts:** [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) for display and body, [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) for italic accents, and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) for labels. They're loaded from Google Fonts in `index.html`.
- **Copy:** all text lives in `index.html`.

## Files

```
index.html            page markup and copy
css/style.css         all styles
js/projects.js        ← your projects, email, socials
js/screenshots.js     auto-generated screenshot map
js/main.js            animations and interactions
js/fluid.js           WebGL liquid gradient
vendor/               GSAP 3.13 + ScrollTrigger, Lenis 1.3 (self-hosted)
scripts/screenshot.mjs  Playwright screenshot capture
assets/               favicon, project screenshots
```

GSAP is used under the [GreenSock standard license](https://gsap.com/standard-license) (free, including for commercial sites). Lenis is MIT licensed.
