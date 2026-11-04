// Choices for Role Details. The server keeps the same lists in
// server/utils/roleOptions.js; change both together.

export const ROLE_LIMITS = {
  maxRoles: 5,
  maxRoleLength: 80,
  maxLocations: 6,
  maxLocationLength: 120,
  maxIndustries: 5,
  maxHeadlineLength: 220
};

export const EMPLOYMENT_TYPES = [
  "Full-time", "Part-time", "Contract", "Contract-to-hire", "W2", "C2C",
  "1099", "Internship", "Temporary", "Seasonal", "Apprenticeship", "Per diem"
];

export const WORKPLACE_TYPES = ["On-site", "Hybrid", "Remote"];

export const SERVICES = [
  "Freelancing", "Consulting", "Contract projects", "Part-time projects",
  "Advisory", "Mentoring", "Coaching", "Teaching & tutoring", "Training & workshops",
  "Technical writing", "Code review", "Speaking", "Volunteering"
];

export const INDUSTRIES = [
  "Information Technology", "Software & SaaS", "Artificial Intelligence",
  "Cybersecurity", "Finance & Banking", "Insurance", "Healthcare",
  "Pharmaceuticals & Biotech", "Law & Legal Services", "Education",
  "Government & Public Sector", "Defense & Aerospace", "Consulting",
  "Manufacturing", "Automotive", "Energy & Utilities", "Telecommunications",
  "Retail & E-commerce", "Logistics & Supply Chain", "Media & Entertainment",
  "Marketing & Advertising", "Real Estate & Construction", "Hospitality & Travel",
  "Agriculture", "Non-profit"
];

export const emptyRoleDetails = {
  headline: "",
  targetRoles: [],
  employmentTypes: [],
  workplaceTypes: [],
  locations: [],
  services: [],
  industries: []
};

// "Texas, United States +4 more"
export function firstAndMore(list = []) {
  if (!list.length) return "";
  return list.length > 1 ? `${list[0]} +${list.length - 1} more` : list[0];
}
