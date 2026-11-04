export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Sections the data entry agent can prepare entries for, by page
const SECTION_BY_PATH = {
  "/dashboard/profile": "profile",
  "/dashboard/summary": "summary",
  "/dashboard/skills": "skills",
  "/dashboard/recommendations": "recommendations",
  "/dashboard/education": "education",
  "/dashboard/experience": "experience",
  "/dashboard/projects": "projects",
  "/dashboard/certifications": "certifications",
  "/dashboard/achievements": "achievements",
  "/dashboard/volunteering": "volunteering",
  "/dashboard/publications": "publications",
  "/dashboard/patents": "patents",
  "/dashboard/interests": "interests"
};

export const sectionForPath = (pathname) => SECTION_BY_PATH[pathname.replace(/\/$/, "")] || null;
