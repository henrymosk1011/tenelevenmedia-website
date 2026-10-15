/* ==========================================================================
   TENELEVENMEDIA: site content
   --------------------------------------------------------------------------
   This is the only file you need to edit to update the portfolio.

   Each project:
     title    : project / client name
     url      : live website (shown as "Visit site")
     category : short label, e.g. "Ecommerce", "Musician", "Restaurant"
                (avoid dashes; the site is written without them)
     year     : (optional) year launched; leave it out to hide years
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
