/* ==========================================================================
   TENELEVENMEDIA: site content
   --------------------------------------------------------------------------
   This is the only file you need to edit to update the portfolio.

   Each project:
     title    : project / client name
     url      : live website (shown as "Visit site")
     category : short label, e.g. "Ecommerce", "Musician", "Restaurant"
                (avoid dashes; the site is written without them)
     year     : year launched
     image    : (optional) path to a screenshot, e.g. "assets/work/acme.jpg"
                Run `node scripts/screenshot.mjs` to generate these
                automatically from each project's url. Tall, full-page
                screenshots scroll inside the browser frame on hover.
     accent   : (optional) colour used for the generated cover when there is
                no screenshot yet, and for hover glows.
   ========================================================================== */

window.SITE = {
  email: "hello@tenelevenmedia.com",
  // Pacific time; shows PDT in summer and PST in winter automatically
  timezone: "America/Los_Angeles",
  socials: [
    { label: "Instagram", url: "https://instagram.com/" },
    { label: "LinkedIn", url: "https://linkedin.com/" },
    { label: "Behance", url: "https://behance.net/" },
    { label: "Dribbble", url: "https://dribbble.com/" },
  ],
};

window.PROJECTS = [
  {
    title: "Hlix Labs",
    url: "https://hlixlabs.com/",
    category: "Brand & Website",
    year: "2026",
    image: "",
    accent: "#ff4d1f",
  },
  {
    title: "SMB CPA Group",
    url: "https://www.smbcpagroup.com/",
    category: "Accounting Firm",
    year: "2026",
    image: "",
    accent: "#3da5ff",
  },
  {
    title: "Revive Drip Haus",
    url: "https://www.revivedriphaus.com/",
    category: "Wellness",
    year: "2026",
    image: "",
    accent: "#00c2a8",
  },
  {
    title: "The Hummingbird Nest",
    url: "https://www.thehummingbirdnest.org/",
    category: "Nonprofit",
    year: "2026",
    image: "",
    accent: "#6b5bff",
  },
  {
    title: "The Social Club Kids",
    url: "https://www.thesocialclubkids.com/",
    category: "Kids & Family",
    year: "2026",
    image: "",
    accent: "#ff3d8b",
  },
];
