// The choices resume settings allow, kept apart from the model so code
// without a database (the GitHub Pages demo) can use them too.
//
// By default a resume keeps to the essentials: every job (each trimmed to its
// best bullets), the top or latest two schools and projects, every
// certification, and the key skills. A limit of 0 means all.
const RESUME_LIMIT_DEFAULTS = { experience: 0, education: 2, projects: 2, certifications: 0 };
const RESUME_EXTRAS = ["achievements", "volunteering", "publications", "patents", "interests", "recommendations"];
// Sections that can move between a two-column resume's columns, and where to.
// left / right are the page's sides; side / main are the columns, wherever the design puts them
const RESUME_COLUMN_SECTIONS = ["summary", "skills", "experience", "education", "projects", "certifications", ...RESUME_EXTRAS];
const RESUME_COLUMN_PLACES = ["left", "right", "side", "main"];
const RESUME_SKILL_STYLES = ["boxes", "list", "bars", "dots", "inline"];

module.exports = { RESUME_LIMIT_DEFAULTS, RESUME_EXTRAS, RESUME_COLUMN_SECTIONS, RESUME_COLUMN_PLACES, RESUME_SKILL_STYLES };
