// The designed resume templates (the CV Maker keeps the plain, ATS-first
// ones). Each is a set of choices for one layout engine (ResumeDocument):
//
//   layout   "single" | "left" | "right"   where the sidebar is
//   header   "band" | "plain" | "centered" | "boxed" | "split" | "side" | "banner" | "bar"
//   avatar   "circle" | "square" | "box" | "none"   initials (profiles have no photo)
//   heading  section heading style: "rule" | "accent" | "fill" | "bar" | "caps" |
//            "serif" | "icon" | "lines" | "underline" | "tab"
//   skills   "bars" | "dots" | "tags" | "list" | "inline"
//   entries  "standard" | "dates" (dates in a left column) | "timeline"
//   side     sections in the sidebar, in order; the rest go in the main column
//
// Colours: accent (headings, links), sideBg / sideInk (sidebar), band (header).

const SANS = "\"Inter\", system-ui, sans-serif";

export const RESUME_DESIGNS = [
  {
    id: "sandstone", name: "Sandstone", tagline: "A warm beige column for contact, skills and education", tags: ["Two column", "Classic"],
    layout: "right", sideWidth: 31, header: "plain", avatar: "none", heading: "rule", skills: "list", entries: "standard",
    side: ["contact", "skills", "education", "certifications", "interests"],
    accent: "#8a5a2b", sideBg: "#f4ead9", sideInk: "#3b2f22", font: "\"DM Sans\", sans-serif", headFont: "\"DM Sans\", sans-serif"
  },
  {
    id: "ivy", name: "Ivy", tagline: "A centred serif classic with ruled section headings", tags: ["One column", "Classic", "ATS friendly"],
    layout: "single", header: "centered", avatar: "none", heading: "rule", skills: "inline", entries: "standard",
    accent: "#111111", font: "\"Libre Baskerville\", Georgia, serif", headFont: "\"Libre Baskerville\", Georgia, serif"
  },
  {
    id: "navy", name: "Navy Pro", tagline: "A navy sidebar with your name, projects and skills", tags: ["Two column", "Professional"],
    layout: "left", sideWidth: 34, header: "side", avatar: "none", heading: "underline", skills: "tags", entries: "standard",
    side: ["contact", "projects", "achievements", "skills", "certifications"],
    accent: "#2563eb", sideBg: "#1e2a44", sideInk: "#e5ecf8", font: SANS, headFont: SANS
  },
  {
    id: "timeline", name: "Timeline", tagline: "Initials badge, icon headings and dates down the left", tags: ["One column", "Modern"],
    layout: "single", header: "split", avatar: "circle", heading: "icon", skills: "tags", entries: "dates",
    accent: "#4d7c0f", font: "\"Merriweather\", Georgia, serif", headFont: "\"Manrope\", sans-serif"
  },
  {
    id: "crimson", name: "Crimson", tagline: "A bold red name band over a grey details column", tags: ["Two column", "Bold"],
    layout: "left", sideWidth: 32, header: "band", avatar: "none", heading: "caps", skills: "list", entries: "standard",
    side: ["contact", "skills", "education", "certifications"],
    accent: "#c0392b", band: "#c0392b", sideBg: "#f1f1f1", sideInk: "#222222", font: "\"Open Sans\", sans-serif", headFont: "\"Bricolage Grotesque\", sans-serif"
  },
  {
    id: "enhanced", name: "Enhanced", tagline: "Clean two columns with strong blue headings", tags: ["Two column", "Modern"],
    layout: "right", sideWidth: 34, header: "plain", avatar: "none", heading: "underline", skills: "tags", entries: "standard",
    side: ["projects", "achievements", "skills", "certifications", "interests"],
    accent: "#1d4ed8", sideBg: "#ffffff", sideInk: "#1f2937", font: SANS, headFont: SANS, divider: true
  },
  {
    id: "wave", name: "Wave", tagline: "A dark title strip and a soft grey details column", tags: ["Two column", "Modern"],
    layout: "left", sideWidth: 33, header: "split", headerDark: true, avatar: "circle", heading: "caps", skills: "dots", entries: "standard",
    side: ["contact", "education", "skills", "interests"],
    accent: "#334155", band: "#2b2f36", sideBg: "#e9e6e1", sideInk: "#2b2f36", font: "\"Manrope\", sans-serif", headFont: "\"Manrope\", sans-serif"
  },
  {
    id: "teal", name: "Teal Focus", tagline: "A teal sidebar with key achievements and courses", tags: ["Two column", "Professional"],
    layout: "left", sideWidth: 33, header: "side", avatar: "square", heading: "accent", skills: "tags", entries: "standard",
    side: ["contact", "achievements", "skills", "certifications", "interests"],
    accent: "#0f766e", sideBg: "#1f4f56", sideInk: "#e6f2f1", font: SANS, headFont: "\"Sora\", sans-serif"
  },
  {
    id: "framed", name: "Framed", tagline: "Your name in a ruled frame over quiet columns", tags: ["Two column", "Classic"],
    layout: "left", sideWidth: 31, header: "boxed", avatar: "none", heading: "caps", skills: "dots", entries: "standard",
    side: ["contact", "skills", "certifications", "interests"],
    accent: "#111827", sideBg: "#ffffff", sideInk: "#374151", font: "\"Open Sans\", sans-serif", headFont: "\"Cormorant Garamond\", serif", divider: true
  },
  {
    id: "lagoon", name: "Lagoon", tagline: "A slim lagoon sidebar with your name at the top", tags: ["Two column", "Modern"],
    layout: "left", sideWidth: 32, header: "side", avatar: "none", heading: "bar", skills: "list", entries: "standard",
    side: ["contact", "education", "skills", "certifications"],
    accent: "#0e7490", sideBg: "#155e63", sideInk: "#e0f2f1", font: "\"DM Sans\", sans-serif", headFont: "\"Fraunces\", serif"
  },
  {
    id: "milestones", name: "Milestones", tagline: "A dark name block and an icon timeline", tags: ["One column", "Executive"],
    layout: "single", header: "banner", headerDark: true, avatar: "none", heading: "icon", skills: "list", entries: "timeline",
    accent: "#1f2937", band: "#1f2937", font: "\"Manrope\", sans-serif", headFont: "\"Manrope\", sans-serif"
  },
  {
    id: "corporate", name: "Corporate", tagline: "Initials badge on the right and two tidy columns", tags: ["Two column", "Professional"],
    layout: "right", sideWidth: 33, header: "split", avatar: "circle", avatarRight: true, heading: "underline", skills: "tags", entries: "standard",
    side: ["projects", "achievements", "skills", "certifications"],
    accent: "#1e40af", sideBg: "#ffffff", sideInk: "#1f2937", font: SANS, headFont: SANS, divider: true
  },
  {
    id: "banner", name: "Banner", tagline: "A deep navy banner across the top", tags: ["Two column", "Bold"],
    layout: "right", sideWidth: 32, header: "banner", headerDark: true, avatar: "none", heading: "rule", skills: "tags", entries: "standard",
    side: ["projects", "skills", "certifications", "interests"],
    accent: "#1e3a8a", band: "#1f2a5c", sideBg: "#f5f7fb", sideInk: "#1f2937", font: SANS, headFont: SANS
  },
  {
    id: "ledgerline", name: "Ledger Line", tagline: "A black rule under a right-aligned name", tags: ["One column", "Minimal", "ATS friendly"],
    layout: "single", header: "bar", avatar: "none", heading: "caps", skills: "inline", entries: "standard",
    accent: "#111111", band: "#111111", font: "\"Open Sans\", sans-serif", headFont: "\"Open Sans\", sans-serif"
  },
  {
    id: "steel", name: "Steel", tagline: "A steel-blue sidebar with your name and skill dots", tags: ["Two column", "Professional"],
    layout: "left", sideWidth: 33, header: "side", avatar: "circle", heading: "underline", skills: "dots", entries: "standard",
    side: ["contact", "education", "skills", "certifications"],
    accent: "#1e40af", sideBg: "#2d4059", sideInk: "#e8eef6", font: SANS, headFont: SANS
  },
  {
    id: "rose", name: "Rose", tagline: "A magenta sidebar with skill dots and strengths", tags: ["Two column", "Creative"],
    layout: "right", sideWidth: 34, header: "plain", avatar: "circle", avatarInSide: true, heading: "fill", skills: "dots", entries: "standard",
    side: ["contact", "skills", "interests", "achievements"],
    accent: "#be185d", sideBg: "#c2185b", sideInk: "#fdeef4", font: "\"Poppins\", sans-serif", headFont: "\"Poppins\", sans-serif"
  },
  {
    id: "initials", name: "Initials", tagline: "A big initials circle on a blue sidebar", tags: ["Two column", "Modern"],
    layout: "left", sideWidth: 32, header: "plain", avatar: "circle", avatarInSide: true, bigAvatar: true, heading: "tab", skills: "list", entries: "standard",
    side: ["contact", "education", "skills", "certifications"],
    accent: "#1d75b8", sideBg: "#1d75b8", sideInk: "#eaf4fc", font: SANS, headFont: "\"Outfit\", sans-serif"
  },
  {
    id: "graphite", name: "Graphite", tagline: "A charcoal sidebar with your details on the right", tags: ["Two column", "Bold"],
    layout: "right", sideWidth: 33, header: "plain", avatar: "circle", avatarInSide: true, heading: "rule", skills: "bars", entries: "standard",
    side: ["contact", "skills", "education", "interests"],
    accent: "#111827", sideBg: "#23272f", sideInk: "#e5e7eb", font: SANS, headFont: "\"Space Grotesk\", sans-serif"
  },
  {
    id: "violet", name: "Violet Bars", tagline: "A violet sidebar with skill bars", tags: ["Two column", "Creative"],
    layout: "right", sideWidth: 32, header: "plain", avatar: "square", avatarRight: true, heading: "caps", skills: "bars", entries: "standard",
    side: ["contact", "skills", "education", "certifications"],
    accent: "#4338ca", sideBg: "#3730a3", sideInk: "#e0e7ff", font: SANS, headFont: SANS
  },
  {
    id: "monogram", name: "Monogram", tagline: "A monogram box, a black contact bar and a red accent", tags: ["Two column", "Bold"],
    layout: "right", sideWidth: 30, header: "bar", avatar: "box", avatarRight: true, heading: "lines", skills: "bars", entries: "standard",
    side: ["skills", "certifications", "education"],
    accent: "#dc2626", band: "#111111", sideBg: "#ffffff", sideInk: "#111111", font: "\"Open Sans\", sans-serif", headFont: "\"Archivo Black\", sans-serif"
  },
  {
    id: "forest", name: "Forest", tagline: "A deep green sidebar with details and skills", tags: ["Two column", "Classic"],
    layout: "left", sideWidth: 31, header: "side", avatar: "none", heading: "serif", skills: "bars", entries: "standard",
    side: ["contact", "skills", "certifications", "interests"],
    accent: "#14532d", sideBg: "#1c3b2b", sideInk: "#e3efe7", font: "\"Open Sans\", sans-serif", headFont: "\"DM Serif Display\", serif"
  },
  {
    id: "ruby", name: "Ruby Line", tagline: "A red top rule and a dense one-page layout", tags: ["One column", "Minimal", "ATS friendly"],
    layout: "single", header: "plain", topRule: true, avatar: "none", heading: "accent", skills: "inline", entries: "standard",
    accent: "#b91c1c", font: "\"Open Sans\", sans-serif", headFont: "\"Open Sans\", sans-serif"
  },
  {
    id: "sage", name: "Sage", tagline: "A soft sage column with serif headings and skill tags", tags: ["Two column", "Classic"],
    layout: "left", sideWidth: 32, header: "plain", avatar: "circle", avatarInSide: true, heading: "serif", skills: "tags", entries: "standard",
    side: ["contact", "skills", "education", "interests"],
    accent: "#3f6b4f", sideBg: "#e6efe6", sideInk: "#26372c", font: "\"DM Sans\", sans-serif", headFont: "\"Fraunces\", serif"
  },
  {
    id: "terracotta", name: "Terracotta", tagline: "A clay name band over a warm cream column", tags: ["Two column", "Creative"],
    layout: "right", sideWidth: 32, header: "band", avatar: "none", heading: "lines", skills: "dots", entries: "standard",
    side: ["contact", "skills", "certifications", "interests"],
    accent: "#b4532a", band: "#b4532a", sideBg: "#f8efe4", sideInk: "#40291c", font: "\"Open Sans\", sans-serif", headFont: "\"Bricolage Grotesque\", sans-serif"
  },
  {
    id: "scholar", name: "Scholar", tagline: "An academic one-pager with dates down the left", tags: ["One column", "Classic", "ATS friendly"],
    layout: "single", header: "centered", avatar: "none", heading: "underline", skills: "inline", entries: "dates",
    accent: "#7f1d1d", font: "\"Libre Baskerville\", Georgia, serif", headFont: "\"Cormorant Garamond\", serif"
  },
  {
    id: "plum", name: "Plum", tagline: "A deep plum banner with tabbed headings and skill bars", tags: ["Two column", "Bold"],
    layout: "left", sideWidth: 32, header: "banner", headerDark: true, avatar: "none", heading: "tab", skills: "bars", entries: "standard",
    side: ["contact", "skills", "education", "certifications"],
    accent: "#6b2158", band: "#4a1740", sideBg: "#f7eff5", sideInk: "#34152d", font: SANS, headFont: "\"Sora\", sans-serif"
  },
  {
    id: "meridian", name: "Meridian", tagline: "Initials badge, side-barred headings and a career timeline", tags: ["One column", "Modern"],
    layout: "single", header: "split", avatar: "square", heading: "bar", skills: "tags", entries: "timeline",
    accent: "#4338ca", font: SANS, headFont: "\"Outfit\", sans-serif"
  },
  {
    id: "onyx", name: "Onyx", tagline: "A black sidebar with gold headings and serif type", tags: ["Two column", "Executive"],
    layout: "left", sideWidth: 33, header: "side", avatar: "none", heading: "rule", skills: "list", entries: "standard",
    side: ["contact", "skills", "education", "certifications"],
    accent: "#a67c1e", sideBg: "#15151a", sideInk: "#efe7d3", font: "\"Open Sans\", sans-serif", headFont: "\"Playfair Display\", serif"
  }
];

export const RESUME_TAGS = ["All", ...new Set(RESUME_DESIGNS.flatMap((design) => design.tags))];

export const resumeDesignById = (id) => RESUME_DESIGNS.find((design) => design.id === id) || null;

// Colours a resume can switch its accent to
export const ACCENTS = ["#111827", "#1d4ed8", "#0f766e", "#15803d", "#b91c1c", "#be185d", "#7c3aed", "#b45309"];

if (import.meta.env.DEV) {
  const ids = new Set(RESUME_DESIGNS.map((design) => design.id));
  if (ids.size !== RESUME_DESIGNS.length) throw new Error("Two resume designs share an id");
}
