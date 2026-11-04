// Choices shared by the Projects pages (mirror server/models/Project.js)
export const PROJECT_TYPES = [
  "Personal",
  "Academic",
  "Professional",
  "Open Source",
  "Research"
];

// The role a project gets unless the user names another
export const DEFAULT_PROJECT_ROLE = "Creator/Developer";

export const PROJECT_STATUSES = ["Planned", "In Progress", "Completed", "On Hold"];

export const ACHIEVEMENT_CATEGORIES = ["Outcome", "Metric", "Milestone", "Award", "Other"];

export const LINK_TYPES = [
  "GitHub",
  "Documentation",
  "Demo",
  "Publication",
  "Article",
  "Video",
  "Other"
];

export const LINK_ICONS = {
  GitHub: "bi-github",
  Documentation: "bi-journal-text",
  Demo: "bi-play-circle",
  Publication: "bi-file-earmark-text",
  Article: "bi-newspaper",
  Video: "bi-camera-video",
  Other: "bi-link-45deg"
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const shortMonth = (month) => MONTHS[month - 1].slice(0, 3);

export const formatMonthYear = (month, year) =>
  year ? `${month ? shortMonth(month) + " " : ""}${year}` : "";

// "Jan 2024 – Present", "2022 – 2023", or "" when no dates
export function formatProjectDates(project) {
  const start = formatMonthYear(project.startMonth, project.startYear);
  const end = project.ongoing
    ? "Present"
    : formatMonthYear(project.endMonth, project.endYear);

  return start || end ? `${start || "…"} – ${end || "…"}` : "";
}
