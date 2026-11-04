// Shared by the JobPilot page, its results and the Log Book

// Short names of everything required that the resume doesn't show
export const missingItems = ({ match, ats }) => [
  ...(match.blocked || []).map((condition) => `Not met: ${condition}`),
  ...match.profile.filter((item) => item.required && !item.found).map((item) => item.field),
  ...match.gaps,
  ...ats.checks.filter((item) => item.status === "fail").map((item) => `ATS: ${item.label}`)
];

export const scoreColor = (score) => (score >= 75 ? "success" : score >= 50 ? "warning" : "danger");
