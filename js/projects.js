/* ==========================================================================
   TENELEVENMEDIA: site content
   --------------------------------------------------------------------------
   window.SITE (below) is edited here: email, time zone and socials.

   window.PROJECTS, the portfolio, comes from the Portfolio page of the
   TENELEVEN admin dashboard. The "Portfolio sync" workflow
   (scripts/sync-portfolio.mjs) rewrites it from there every 30 minutes and
   takes the screenshots, so make changes there: edits made here are replaced
   at the next sync (see README.md, "Adding your projects").

   Each project:
     title    : project / client name (also names its screenshot files)
     url      : live website (shown as "Visit site")
     category : short label, e.g. "Ecommerce", "Musician", "Restaurant"
                (avoid dashes; the site is written without them)
     year     : (optional) year launched; leave it out to hide years
     image    : (optional) path to your own screenshot, e.g. "assets/work/acme.jpg"
     accent   : (optional) colour used for the generated cover when there is
                no screenshot yet, and for hover glows.
     capture  : (optional) "stitch", "reduced-motion" or
                "stitch-reduced-motion" for sites whose screenshots need it
                (see README.md, "Screenshots of each site").
   ========================================================================== */

window.SITE = {
  email: "hello@tenelevenmedia.com",
  // Pacific time; shows PDT in summer and PST in winter automatically
  timezone: "America/Los_Angeles",
  // Add profiles as you set them up, e.g.
  //   { label: "Instagram", url: "https://instagram.com/yourhandle" },
  // The Socials links stay hidden while this list is empty.
  socials: [],
};

window.PROJECTS = [
  {
    title: "cyberxLA", // brand spelling: lower case x, upper case LA
    url: "https://cyberx.la/",
    category: "Cybersecurity",
    image: "",
    accent: "#d6ff3f",
  },
  {
    title: "Scent and Story",
    url: "https://scentandstory.co/",
    category: "Perfume Bar",
    image: "",
    accent: "#d9aeb6",
  },
  {
    title: "Starlight Hospice",
    url: "https://www.starlighthospice.org/",
    category: "Hospice Care",
    image: "",
    accent: "#feca34",
  },
  {
    title: "Starlight Home Health",
    url: "https://www.starlighthh.com/",
    category: "Home Health Care",
    image: "",
    accent: "#fccc27",
  },
  {
    title: "hlix",
    url: "https://hlixlabs.com/",
    category: "Ecommerce",
    image: "",
    accent: "#33e6b0",
  },
  {
    title: "SMB CPA Group",
    url: "https://www.smbcpagroup.com/",
    category: "Accounting Firm",
    image: "",
    accent: "#ed3812",
  },
  {
    title: "Revive Drip Haus",
    url: "https://www.revivedriphaus.com/",
    category: "Mobile IV Therapy",
    image: "",
    accent: "#19a352",
  },
  {
    title: "The HummingBird Nest",
    url: "https://www.thehummingbirdnest.org/",
    category: "Child Development",
    image: "",
    accent: "#74b996",
  },
  {
    title: "The Social Club Kids",
    url: "https://www.thesocialclubkids.com/",
    category: "Kids Programs",
    image: "",
    accent: "#97c680",
  },
];
