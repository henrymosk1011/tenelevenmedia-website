/* ==========================================================================
   TENELEVENMEDIA — site content
   --------------------------------------------------------------------------
   This is the only file you need to edit to update the portfolio.

   Each project:
     title    – project / client name
     url      – live website (shown as "Visit site")
     category – short label, e.g. "E-commerce", "Musician", "Restaurant"
     year     – year launched
     image    – (optional) path to a screenshot, e.g. "assets/work/acme.jpg"
                Run `node scripts/screenshot.mjs` to generate these
                automatically from each project's url. Tall, full-page
                screenshots scroll inside the browser frame on hover.
     accent   – (optional) colour used for the generated cover when there is
                no screenshot yet, and for hover glows.
   ========================================================================== */

window.SITE = {
  email: "hello@tenelevenmedia.com",
  location: "United States",
  timezone: "America/New_York",
  socials: [
    { label: "Instagram", url: "https://instagram.com/" },
    { label: "LinkedIn", url: "https://linkedin.com/" },
    { label: "Behance", url: "https://behance.net/" },
    { label: "Dribbble", url: "https://dribbble.com/" },
  ],
};

window.PROJECTS = [
  {
    title: "Project One",
    url: "https://example.com",
    category: "Brand & Website",
    year: "2026",
    image: "",
    accent: "#ff4d1f",
  },
  {
    title: "Project Two",
    url: "https://example.com",
    category: "E-commerce",
    year: "2026",
    image: "",
    accent: "#6b5bff",
  },
  {
    title: "Project Three",
    url: "https://example.com",
    category: "Musician / Artist",
    year: "2025",
    image: "",
    accent: "#00c2a8",
  },
  {
    title: "Project Four",
    url: "https://example.com",
    category: "Small Business",
    year: "2025",
    image: "",
    accent: "#ffb21f",
  },
  {
    title: "Project Five",
    url: "https://example.com",
    category: "Portfolio",
    year: "2025",
    image: "",
    accent: "#ff3d8b",
  },
  {
    title: "Project Six",
    url: "https://example.com",
    category: "Landing Page",
    year: "2024",
    image: "",
    accent: "#3da5ff",
  },
];
