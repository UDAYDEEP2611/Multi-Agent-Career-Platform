// Choices for the Role Details on a profile. The client keeps the same lists in
// client/src/pages/Profile/roleOptions.js; change both together.

const ROLE_LIMITS = {
  maxRoles: 5,
  maxRoleLength: 80,
  maxLocations: 6,
  maxLocationLength: 120,
  maxIndustries: 5,
  maxHeadlineLength: 220
};

const EMPLOYMENT_TYPES = [
  "Full-time", "Part-time", "Contract", "Contract-to-hire", "W2", "C2C",
  "1099", "Internship", "Temporary", "Seasonal", "Apprenticeship", "Per diem"
];

const WORKPLACE_TYPES = ["On-site", "Hybrid", "Remote"];

const SERVICES = [
  "Freelancing", "Consulting", "Contract projects", "Part-time projects",
  "Advisory", "Mentoring", "Coaching", "Teaching & tutoring", "Training & workshops",
  "Technical writing", "Code review", "Speaking", "Volunteering"
];

const INDUSTRIES = [
  "Information Technology", "Software & SaaS", "Artificial Intelligence",
  "Cybersecurity", "Finance & Banking", "Insurance", "Healthcare",
  "Pharmaceuticals & Biotech", "Law & Legal Services", "Education",
  "Government & Public Sector", "Defense & Aerospace", "Consulting",
  "Manufacturing", "Automotive", "Energy & Utilities", "Telecommunications",
  "Retail & E-commerce", "Logistics & Supply Chain", "Media & Entertainment",
  "Marketing & Advertising", "Real Estate & Construction", "Hospitality & Travel",
  "Agriculture", "Non-profit"
];

module.exports = { ROLE_LIMITS, EMPLOYMENT_TYPES, WORKPLACE_TYPES, SERVICES, INDUSTRIES };
