// The resume designs a user can pick. All are one column with real text
// (no tables, images or text in graphics), so ATS parsers read them in order.
//
// entry: how each job / degree heading is laid out
//   "orgFirst"   line 1: organization (bold) … location; line 2: role (italic) … dates
//   "roleFirst"  line 1: role (bold) … dates/location; line 2: organization (italic) … the other
//   "stacked"    small grey "Organization | dates", then the role in bold
// Skills always print as category bullets: "• Machine Learning: PyTorch, ..."

export const RESUME_TEMPLATES = [
  {
    // Reviewer-recommended settings for AI/ML resumes: Calibri-style font, 21pt name, 9.5pt contact, 12pt headings,
    // 11pt job titles, 10.5pt bullets, ~1.08 line spacing
    id: "technical",
    name: "Technical (AI/ML)",
    description: "Recommended for engineering roles: compact Calibri, navy headings",
    swatch: "#1f3a68",
    entry: "orgFirst",
    datesFirst: true,
    educationFirst: false,
    contactSeparator: " | ",
    labels: { summary: "Summary", experience: "Experience", projects: "Projects", education: "Education", skills: "Technical Skills" }
  },
  {
    id: "harvard",
    name: "Harvard",
    description: "Dense serif layout used by business and law schools",
    swatch: "#1f2937",
    entry: "orgFirst",
    educationFirst: true,
    contactSeparator: " | ",
    labels: { summary: "Summary", experience: "Professional Experience", projects: "Projects", education: "Education", skills: "Technical Skills" }
  },
  {
    id: "modern",
    name: "Modern Minimal",
    description: "Clean sans-serif with a bold name and contact icons",
    swatch: "#4b5563",
    entry: "stacked",
    educationFirst: true,
    icons: true,
    labels: { summary: "Summary", experience: "Work Experience", projects: "Projects", education: "Education", skills: "Technical Skills" }
  },
  {
    id: "classic",
    name: "Classic",
    description: "Traditional serif, great for students and engineers",
    swatch: "#111827",
    entry: "orgFirst",
    educationFirst: true,
    contactSeparator: " | ",
    labels: { summary: "Summary", experience: "Work Experience", projects: "Projects", education: "Education", skills: "Technical Skills" }
  },
  {
    id: "professional",
    name: "Professional",
    description: "Serif with bold numbers that make results stand out",
    swatch: "#374151",
    entry: "roleFirst",
    educationFirst: true,
    contactSeparator: "  |  ",
    boldNumbers: true,
    labels: { summary: "Summary", experience: "Professional Experience", projects: "Projects", education: "Education", skills: "Technical Skills" }
  },
  {
    id: "centered",
    // id kept as "centered" so saved choices still work
    name: "Elegant",
    description: "Serif title-case headings over a light sans-serif body",
    swatch: "#6b7280",
    entry: "orgFirst",
    educationFirst: false,
    contactSeparator: "  •  ",
    labels: { summary: "Summary", experience: "Experience", projects: "Projects", education: "Education", skills: "Technical Skills" }
  },
  {
    id: "blue",
    name: "Blue Accent",
    description: "Warm serif with a blue name and headings",
    swatch: "#2f5577",
    entry: "roleFirst",
    datesFirst: true,
    degreeFirst: true,
    educationFirst: false,
    icons: true,
    labels: { summary: "Summary", experience: "Professional Experience", projects: "Projects", education: "Education", skills: "Technical Skills" }
  }
];

export const templateById = (id) =>
  RESUME_TEMPLATES.find((template) => template.id === id) || RESUME_TEMPLATES[0];

// Sections the user can add beyond the main five, in the order they print
export const EXTRA_SECTIONS = [
  { key: "certifications", idsKey: "certificationIds", title: "Certifications", icon: "bi-patch-check" },
  { key: "achievements", idsKey: "achievementIds", title: "Achievements & Awards", icon: "bi-trophy" },
  { key: "volunteering", idsKey: "volunteeringIds", title: "Volunteering", icon: "bi-people" },
  { key: "publications", idsKey: "publicationIds", title: "Publications", icon: "bi-journal-text" },
  { key: "patents", idsKey: "patentIds", title: "Patents", icon: "bi-lightbulb" },
  { key: "interests", idsKey: "interestIds", title: "Interests", icon: "bi-heart" }
];

// "default" follows the template; "experience" or "education" overrides it.
// Added sections come after Skills.
export function sectionOrder(template, order) {
  const educationFirst = order === "default" ? template.educationFirst : order === "education";
  const main = educationFirst
    ? ["summary", "education", "experience", "projects", "skills"]
    : ["summary", "experience", "projects", "education", "skills"];
  return [...main, ...EXTRA_SECTIONS.map((section) => section.key)];
}

// Every resume uses 0.5 inch margins on US Letter
export const RESUME_MARGIN = { value: "0.5in", inches: 0.5 };
