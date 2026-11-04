// What the design agent can work with: the built-in designs (ids and names
// match client/src/pages/Portfolio/designs.js), the fonts the designs
// already load, the portfolio sections and a few named colours.

const DESIGNS = [
  ["mono", "Mono"], ["midnight", "Midnight"], ["editorial", "Editorial"], ["fresh", "Fresh"], ["terminal", "Terminal"],
  ["aurora", "Aurora"], ["brutal", "Brutal"], ["bento", "Bento"], ["swiss", "Swiss"], ["sidebar", "Sidebar"],
  ["neon", "Neon"], ["notebook", "Notebook"], ["essay", "Essay"], ["timeline", "Timeline"], ["executive", "Executive"],
  ["retro", "Retro OS"], ["studio", "Studio"], ["split", "Split"], ["resume", "Resume"], ["blueprint", "Blueprint"],
  ["zen", "Zen"], ["gazette", "Gazette"], ["polaroid", "Polaroid"], ["arcade", "Arcade"], ["cosmos", "Cosmos"],
  ["ledger", "Ledger"], ["boarding", "Boarding Pass"], ["metro", "Metro"], ["museum", "Museum"], ["vinyl", "Vinyl"],
  ["botanical", "Botanical"], ["memphis", "Memphis"], ["launch", "Launch"], ["dossier", "Dossier"], ["noir", "Noir"],
  ["candy", "Candy"], ["circuit", "Circuit"], ["ide", "Code Editor"], ["atlas", "Atlas"], ["slate", "Slate"]
].map(([id, name]) => ({ id, name }));

// Designs that draw their sections from the shared section list, so hiding,
// reordering and renaming sections works everywhere in them. The other
// five lay their sections out by hand: there, only optional sections
// (projects, certifications…) can be hidden.
const FIXED_LAYOUT = ["mono", "midnight", "editorial", "fresh", "terminal"];

const FONTS = [
  "Inter", "DM Sans", "Manrope", "Poppins", "Open Sans", "Outfit", "Sora", "Space Grotesk", "Bricolage Grotesque", "Syne",
  "Playfair Display", "DM Serif Display", "Fraunces", "Libre Baskerville", "Merriweather", "Cormorant Garamond",
  "Instrument Serif", "Alegreya", "Shippori Mincho", "JetBrains Mono", "IBM Plex Mono", "Space Mono", "Special Elite",
  "Unbounded", "Archivo Black", "Bungee", "Caveat", "Permanent Marker", "Press Start 2P", "VT323"
];

const SECTIONS = ["about", "experience", "education", "skills", "projects", "certifications", "achievements",
  "recommendations", "volunteering", "publications", "patents", "interests"];
const CORE_SECTIONS = ["about", "experience", "education", "skills"];

const SECTION_WORDS = {
  about: /\babout( me)?\b|\bsummary\b|\bbio\b/i,
  experience: /\bexperience\b|\bjobs?\b|\bwork history\b|\bcareer\b/i,
  education: /\beducation\b|\bschools?\b|\bdegrees?\b/i,
  skills: /\bskills?\b/i,
  projects: /\bprojects?\b/i,
  certifications: /\bcertifications?\b|\bcerts?\b/i,
  achievements: /\bachievements?\b|\bawards?\b/i,
  recommendations: /\brecommendations?\b|\breferences?\b|\btestimonials?\b/i,
  volunteering: /\bvolunteer(ing)?\b/i,
  publications: /\bpublications?\b|\bpapers?\b/i,
  patents: /\bpatents?\b/i,
  interests: /\binterests?\b|\bhobbies\b/i
};

const COLORS = {
  red: "#dc2626", crimson: "#b91c1c", orange: "#ea580c", amber: "#d97706", gold: "#b8860b", yellow: "#ca8a04",
  lime: "#65a30d", green: "#16a34a", "forest green": "#1f6f43", "dark green": "#14532d", emerald: "#059669",
  teal: "#0d9488", cyan: "#0891b2", sky: "#0284c7", blue: "#2563eb", navy: "#1e3a8a", indigo: "#4f46e5",
  violet: "#7c3aed", purple: "#9333ea", magenta: "#c026d3", pink: "#db2777", rose: "#e11d48", brown: "#92400e",
  black: "#111111", grey: "#6b7280", gray: "#6b7280", silver: "#94a3b8", maroon: "#7f1d1d", coral: "#f97362", mint: "#10b981"
};

const designById = (id) => DESIGNS.find((design) => design.id === id) || null;

// "the code editor one" -> "ide"
function designFromText(text) {
  const lower = String(text || "").toLowerCase();
  return [...DESIGNS].sort((a, b) => b.name.length - a.name.length)
    .find((design) => new RegExp(`\\b${design.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower) ||
      new RegExp(`\\b${design.id}\\b`).test(lower))?.id || null;
}

module.exports = { DESIGNS, FIXED_LAYOUT, FONTS, SECTIONS, CORE_SECTIONS, SECTION_WORDS, COLORS, designById, designFromText };
