// What the data entry agent knows about each portfolio section, read from
// the section's Mongoose model: every editable field's type, whether it's
// required, its allowed values and length. A few rules live only in the
// controllers ("end year is required unless current"), so they're added
// here by hand. Records are always created through the section's own
// controller (see utils/callController.js), so the controller has the
// final say. Profile and Summary are single records: the agent updates them
// (asking for the required contact details only when there's no profile).

const { schemaOf } = require("../../utils/userDatabase");
// Registers every user model's schema
require("../../models/userModels");

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// Field hints the schema can't give: what it means and how to ask for it
const HINTS = {
  institution: { label: "school or university", ask: "Which school or university was it?" },
  degree: { label: "degree", ask: "What degree was it (for example M.S., B.Tech, MBA)?" },
  fieldOfStudy: { label: "field of study", ask: "What was the field of study?" },
  grade: { label: "grade or GPA" },
  currentlyStudying: { label: "still studying there" },
  jobTitle: { label: "job title", ask: "What was your job title?" },
  organization: { label: "organization", ask: "Which company or organization was it?" },
  currentlyWorking: { label: "still working there", ask: "Do you still work there? (yes or no)" },
  currentlyVolunteering: { label: "still volunteering", ask: "Are you still volunteering there? (yes or no)" },
  startYear: { label: "start year", ask: "What year did it start?" },
  endYear: { label: "end year", ask: "What year did it end?" },
  startMonth: { label: "start month" },
  endMonth: { label: "end month" },
  title: { label: "title", ask: "What's the title?" },
  name: { label: "name", ask: "What's the name?" },
  role: { label: "role", ask: "What was your role?" },
  category: { label: "category", ask: "Which category fits best?" },
  issuingOrganization: { label: "issuing organization", ask: "Who issued it?" },
  patentNumber: { label: "patent or application number", ask: "What's the patent or application number?" },
  publishedOn: { label: "publication date (YYYY-MM-DD)" },
  date: { label: "date (YYYY-MM-DD)" },
  firstName: { label: "first name", ask: "What's the first name?" },
  lastName: { label: "last name", ask: "What's the last name?" },
  email: { label: "email", ask: "What email should your profile show?" },
  phoneNumber: { label: "phone number", ask: "What's your phone number?" },
  addressLine: { label: "street address", ask: "What's your street address?" },
  country: { label: "country", ask: "Which country do you live in?" },
  stateProvince: { label: "state or province", ask: "Which state or province?" },
  city: { label: "city", ask: "Which city?" },
  postalCode: { label: "postal code", ask: "What's your postal code?" },
  linkedinUrl: { label: "LinkedIn URL", ask: "What's your LinkedIn profile URL?" },
  githubUrl: { label: "GitHub URL" },
  portfolioUrl: { label: "portfolio URL" },
  headline: { label: "headline" },
  roleTargeting: { label: "role targeting" },
  targetRoles: { label: "roles you're looking for" },
  content: { label: "summary", ask: "What should your professional summary say?" },
  rating: { label: "level (1 to 5)" },
  skillType: { label: "skill type" },
  isImportant: { label: "key skill" },
  relationship: { label: "relationship", ask: "How do you know them (for example manager, colleague, professor)?" },
  text: { label: "recommendation text", ask: "What did they write? Paste the recommendation." },
  recommenderTitle: { label: "their title" },
  recommenderOrganization: { label: "their organization" }
};

const PROFILE_CONTACT = ["firstName", "lastName", "email", "phoneNumber", "addressLine", "country", "stateProvince", "city", "postalCode", "linkedinUrl", "githubUrl", "portfolioUrl"];

const SECTIONS = [
  {
    id: "profile", label: "Profile", singular: "profile update", route: "/dashboard/profile",
    model: "Profile", singleton: true,
    fields: [...PROFILE_CONTACT, "headline", "roleTargeting", "targetRoles"],
    paths: { ...Object.fromEntries(PROFILE_CONTACT.map((name) => [name, `contact.${name}`])), headline: "roleDetails.headline", roleTargeting: "roleDetails.roleTargeting", targetRoles: "roleDetails.targetRoles" },
    // A new profile needs the contact details the profile form requires
    requiredWhenNew: ["firstName", "lastName", "email", "phoneNumber", "addressLine", "country", "stateProvince", "city", "postalCode", "linkedinUrl"],
    keys: [],
    keywords: /\b(my profile|contact details?|phone(?: number)?|e-?mail|linkedin|github (?:url|link|profile)|portfolio (?:url|link|site)|address|my name is|headline|role targeting|target role\b|i live in|(?:looking for|open to|targeting)\b.{0,60}?\b(?:roles?|jobs?|positions?|opportunit(?:y|ies))|target roles?)\b/i,
    describe: (d) => Object.keys(d).length ? `profile: ${Object.keys(d).map((key) => HINTS[key]?.label || key).join(", ")}` : "profile update"
  },
  {
    id: "summary", label: "Summary", singular: "summary", route: "/dashboard/summary",
    model: "Summary", singleton: true,
    fields: ["content"],
    keys: [],
    keywords: /\b(summary|bio|about me|professional summary|introduction)\b/i,
    describe: (d) => d.content ? `summary: "${d.content.slice(0, 60)}${d.content.length > 60 ? "…" : ""}"` : "summary"
  },
  {
    id: "skills", label: "Skills", singular: "skill", route: "/dashboard/skills",
    model: "UserSkill", controller: ["userSkillController", "createSkill"],
    fields: ["name", "rating", "skillType", "isImportant", "lastUsedYear"],
    // The controller gives a rating of 3 when none is given
    optional: ["rating"],
    keys: ["name"],
    keywords: /\b(skills?|proficient (?:in|with)|tech stack|i know how to use|key skill)\b/i,
    describe: (d) => d.name || "skill"
  },
  {
    id: "recommendations", label: "Recommendations", singular: "recommendation", route: "/dashboard/recommendations",
    model: "Recommendation", controller: ["recommendationController", "createRecommendation"],
    fields: ["kind", "firstName", "lastName", "relationship", "recommenderTitle", "recommenderOrganization", "text", "month", "year", "profileUrl"],
    // The controller requires the text for a recommendation
    required: ["text"],
    keys: ["firstName"],
    keywords: /\b(recommend\w*|reference|testimonial|endorse\w*|vouch\w*)\b/i,
    describe: (d) => [d.kind === "Reference" ? "Reference" : "Recommendation", (d.firstName || d.lastName) && `from ${[d.firstName, d.lastName].filter(Boolean).join(" ")}`].filter(Boolean).join(" ")
  },
  {
    id: "education", label: "Education", singular: "education entry", route: "/dashboard/education",
    model: "Education", controller: ["educationController", "createEducation"],
    fields: ["institution", "degree", "fieldOfStudy", "location", "startMonth", "startYear", "endMonth", "endYear", "currentlyStudying", "grade", "description"],
    keys: ["institution", "degree"],
    keywords: /\b(degree|university|college|school|graduat\w*|bachelor\w*|master\w*|m\.?s\.?|b\.?s\.?|b\.?tech|m\.?tech|mba|ph\.?d|gpa|cgpa|studied|major\w*|diploma)\b/i,
    describe: (d) => [d.degree, d.fieldOfStudy && (d.degree ? `in ${d.fieldOfStudy}` : d.fieldOfStudy), d.institution && `at ${d.institution}`].filter(Boolean).join(" ")
  },
  {
    id: "experience", label: "Experience", singular: "job", route: "/dashboard/experience",
    model: "Experience", controller: ["experienceController", "createExperience"],
    fields: ["jobTitle", "organization", "location", "locationType", "employmentType", "currentlyWorking", "startMonth", "startYear", "endMonth", "endYear", "summary"],
    keys: ["organization", "jobTitle"],
    // The controller requires these, the model doesn't
    required: ["startYear"],
    keywords: /\b(worked|work(?:ing)? (?:at|as|for)|job|joined|hired|intern(?:ship)?|employ\w*|position|company|engineer at|developer at)\b/i,
    describe: (d) => [d.jobTitle, d.organization && `at ${d.organization}`].filter(Boolean).join(" ")
  },
  {
    id: "projects", label: "Projects", singular: "project", route: "/dashboard/projects",
    model: "Project", controller: ["projectController", "createProject"],
    fields: ["title", "projectType", "description", "role", "startMonth", "startYear", "ongoing", "endMonth", "endYear", "status", "githubUrl", "demoUrl", "websiteUrl"],
    keys: ["title"],
    keywords: /\b(project|built|side project|hackathon|github|repo|app i made|open[- ]source)\b/i,
    describe: (d) => d.title || "project"
  },
  {
    id: "certifications", label: "Certifications", singular: "certification", route: "/dashboard/certifications",
    model: "Certification", controller: ["certificationController", "createCertification"],
    fields: ["name", "issuingOrganization", "issueMonth", "issueYear", "expirationMonth", "expirationYear", "credentialId", "credentialUrl"],
    keys: ["name"],
    keywords: /\b(certif\w*|certified|credential|license|licence)\b/i,
    describe: (d) => [d.name, d.issuingOrganization && `from ${d.issuingOrganization}`].filter(Boolean).join(" ")
  },
  {
    id: "achievements", label: "Achievements", singular: "achievement", route: "/dashboard/achievements",
    model: "Achievement", controller: ["achievementController", "createAchievement"],
    fields: ["title", "category", "issuer", "result", "month", "year", "description", "url"],
    keys: ["title"],
    keywords: /\b(award\w*|won|winner|scholarship|honou?r|prize|achievement|ranked|recogni[sz]ed)\b/i,
    describe: (d) => d.title || "achievement"
  },
  {
    id: "volunteering", label: "Volunteering", singular: "volunteering role", route: "/dashboard/volunteering",
    model: "Volunteering", controller: ["volunteeringController", "createVolunteering"],
    fields: ["organization", "role", "cause", "currentlyVolunteering", "startMonth", "startYear", "endMonth", "endYear", "description"],
    keys: ["organization", "role"],
    keywords: /\b(volunteer\w*|non[- ]?profit|charity|ngo)\b/i,
    describe: (d) => [d.role, d.organization && `at ${d.organization}`].filter(Boolean).join(" ")
  },
  {
    id: "publications", label: "Publications", singular: "publication", route: "/dashboard/publications",
    model: "Publication", controller: ["publicationController", "createPublication"],
    fields: ["title", "publisher", "publishedOn", "url", "description"],
    keys: ["title"],
    keywords: /\b(publish\w*|paper|journal|conference|article|arxiv)\b/i,
    describe: (d) => d.title || "publication"
  },
  {
    id: "patents", label: "Patents", singular: "patent", route: "/dashboard/patents",
    model: "Patent", controller: ["patentController", "createPatent"],
    fields: ["title", "patentNumber", "status", "date", "url", "description"],
    keys: ["title"],
    keywords: /\b(patent\w*)\b/i,
    describe: (d) => d.title || "patent"
  },
  {
    id: "interests", label: "Interests", singular: "interest", route: "/dashboard/interests",
    model: "Interest", controller: ["interestController", "createInterest"],
    fields: ["name", "category", "description"],
    keys: ["name"],
    keywords: /\b(interest(?:ed)? in|hobb(?:y|ies)|passion for|enjoy|love doing)\b/i,
    describe: (d) => d.name || "interest"
  }
];

// One field's spec, from the schema path
function fieldSpec(model, name, extraRequired, section) {
  const path = schemaOf(model).path(section.paths?.[name] || name);
  const hint = HINTS[name] || {};
  const options = path?.options || {};
  const instance = path?.instance;
  const enumValues = (path?.enumValues || []).filter((value) => value !== "" && value !== null);
  let type = "text";
  if (instance === "Array") type = "list";
  else if (instance === "Boolean") type = "boolean";
  else if (instance === "Number") type = /month$/i.test(name) ? "month" : /year$/i.test(name) ? "year" : "number";
  else if (enumValues.length) type = "enum";
  else if (options.match && String(options.match).includes("\\d{4}-\\d{2}-\\d{2}")) type = "date";
  else if (/url$/i.test(name)) type = "url";

  return {
    name,
    type,
    required: (Boolean(options.required) || extraRequired.includes(name)) && !(section.optional || []).includes(name),
    enum: enumValues,
    maxLength: options.maxlength || null,
    min: options.min ?? null,
    max: options.max ?? null,
    label: hint.label || name.replace(/([A-Z])/g, " $1").toLowerCase(),
    ask: hint.ask || null
  };
}

const specs = new Map(SECTIONS.map((section) => [section.id, {
  ...section,
  fieldSpecs: section.fields.map((name) => fieldSpec(section.model, name, section.required || [], section))
}]));

const specOf = (id) => specs.get(id) || null;
const allSpecs = () => [...specs.values()];

// A plain description of the sections, for prompts and the MCP tool
const schemaSummary = (ids = [...specs.keys()]) => ids.map((id) => {
  const spec = specs.get(id);
  return {
    section: id,
    label: spec.label,
    fields: spec.fieldSpecs.map((field) => ({
      name: field.name,
      type: field.type,
      required: field.required,
      ...(field.enum.length ? { options: field.enum } : {})
    }))
  };
});

// ---- Turning text into field values ---------------------------------------

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

function toMonth(value) {
  if (Number.isInteger(value) && value >= 1 && value <= 12) return value;
  const text = clean(value).toLowerCase();
  if (/^\d{1,2}$/.test(text) && Number(text) >= 1 && Number(text) <= 12) return Number(text);
  const index = MONTHS.findIndex((month) => text.startsWith(month.slice(0, 3)));
  return index >= 0 ? index + 1 : undefined;
}

function toYear(value) {
  const match = String(value ?? "").match(/\b(19\d{2}|20\d{2}|2100)\b/);
  return match ? Number(match[1]) : undefined;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = clean(value).toLowerCase();
  if (/^(y|yes|yeah|yep|true|still|currently|ongoing|present|i do|i am)\b/.test(text)) return true;
  if (/^(n|no|nope|false|not|ended|finished|completed)\b/.test(text)) return false;
  return undefined;
}

function toEnum(value, options) {
  const text = clean(value).toLowerCase();
  if (!text) return undefined;
  return options.find((option) => option.toLowerCase() === text)
    || options.find((option) => option.toLowerCase().startsWith(text) || text.startsWith(option.toLowerCase()))
    || options.find((option) => text.includes(option.toLowerCase()));
}

function toDate(value) {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const year = toYear(text);
  if (!year) return undefined;
  const month = toMonth(text.replace(String(year), "").trim()) || 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

// Values that must look like what they are, whatever filled them in
// Degree names: whole words in any case, abbreviations as written (MS,
// B.Tech) so "worked as a" isn't read as an A.S.; a bare "ms" answer counts
const DEGREE_WORDS = /\b(ph\.?\s?d|phd|doctor\w*|master'?s?|bachelor'?s?|associate'?s?|diploma|certificate|mba|b\.?\s?tech|m\.?\s?tech|b\.?\s?sc|m\.?\s?sc|high school|ged|post\s?graduate|pgdm?)\b/i;
const DEGREE_CODES = /(^|[^A-Za-z])(M\.?\s?S|M\.?\s?A|M\.?\s?Eng|B\.?\s?S|B\.?\s?E|B\.?\s?A|B\.?\s?Com|A\.?\s?A|A\.?\s?S|LLB|LLM|M\.?\s?D|J\.?\s?D)(\.|[^A-Za-z]|$)/;
const BARE_CODE = /^\s*(m\.?\s?s|m\.?\s?a|b\.?\s?s|b\.?\s?e|b\.?\s?a|m\.?\s?d)\.?\s*$/i;
const isDegree = (value) => value.split(/\s+/).length <= 8 && (DEGREE_WORDS.test(value) || DEGREE_CODES.test(value) || BARE_CODE.test(value));
// Names must name the thing: "A project" or "my new job" says what kind
// of entry it is, not what it's called
const { isGenericValue } = require("./textUnderstanding");
const named = (value) => !isGenericValue(value);
const SHAPES = {
  degree: isDegree,
  ...Object.fromEntries(["title", "name", "institution", "organization", "jobTitle", "role", "issuingOrganization", "publisher", "issuer",
    "firstName", "lastName", "relationship", "city", "country", "stateProvince", "recommenderOrganization"].map((field) => [field, named]))
};

// A value in the field's own type, or undefined when it doesn't fit
function coerce(field, value) {
  const result = coerceType(field, value);
  return result !== undefined && SHAPES[field.name] && !SHAPES[field.name](String(result)) ? undefined : result;
}

function coerceType(field, value) {
  if (value === null || value === undefined || value === "") return undefined;
  switch (field.type) {
    case "month": return toMonth(value);
    case "year": return toYear(value);
    case "number": return Number.isFinite(Number(value)) ? Number(value) : undefined;
    case "boolean": return toBoolean(value);
    case "enum": return toEnum(value, field.enum);
    case "date": return toDate(value);
    case "list": {
      const items = (Array.isArray(value) ? value : String(value).split(/,|;|\band\b|\n/))
        .map((item) => clean(item)).filter(Boolean).slice(0, 10);
      return items.length ? items : undefined;
    }
    case "url": {
      const text = clean(value);
      if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+\S*$/i.test(text)) return undefined;
      return /^https?:\/\//i.test(text) ? text : `https://${text}`;
    }
    default: {
      const text = clean(value);
      if (!text) return undefined;
      if (field.name === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text.toLowerCase() : undefined;
      if (/phone|mobile/i.test(field.name)) return /^\+?[\d\s().-]{7,20}$/.test(text) ? text : undefined;
      if (/Url$/.test(field.name)) {
        if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+\S*$/i.test(text)) return undefined;
        return /^https?:\/\//i.test(text) ? text : `https://${text}`;
      }
      return field.maxLength ? text.slice(0, field.maxLength) : text;
    }
  }
}

// Only the section's fields, each in its own type
function coerceAll(spec, data = {}) {
  const result = {};
  for (const field of spec.fieldSpecs) {
    const value = coerce(field, data[field.name]);
    if (value !== undefined) result[field.name] = value;
  }
  return result;
}

const isCurrent = (data) => data.currentlyStudying === true || data.currentlyWorking === true ||
  data.currentlyVolunteering === true || data.ongoing === true;

// Required fields still missing, in the order to ask for them
// exists: for single records (Profile), whether there already is one
function missingFields(spec, data, { exists = true } = {}) {
  const required = (field) => (spec.singleton ? !exists && (spec.requiredWhenNew || []).includes(field.name) : field.required);
  const missing = spec.fieldSpecs.filter((field) => required(field) && (data[field.name] === undefined || data[field.name] === ""));
  // Experience: a past job needs an end year, so ask whether it's current first
  if (spec.id === "experience" && data.startYear !== undefined && data.endYear === undefined) {
    if (data.currentlyWorking === undefined) missing.push(spec.fieldSpecs.find((field) => field.name === "currentlyWorking"));
    else if (data.currentlyWorking === false) missing.push(spec.fieldSpecs.find((field) => field.name === "endYear"));
  }
  return missing.filter(Boolean);
}

// Date problems worth fixing before the record goes to the buffer
function dateProblem(data) {
  for (const [start, end] of [["startYear", "endYear"], ["issueYear", "expirationYear"]]) {
    if (data[start] && data[end] && data[end] < data[start]) return `the ${end.replace("Year", "")} year is before the ${start.replace("Year", "")} year`;
  }
  if (isCurrent(data) && data.endYear) return "it's marked as current but has an end year";
  return null;
}

// The question for one missing field
function questionFor(spec, field) {
  if (field.ask) return field.ask;
  if (field.type === "enum") return `What's the ${field.label}?`;
  return `What's the ${field.label} for this ${spec.singular}?`;
}

// Quick replies the chat can show as buttons
function choicesFor(field) {
  if (field.type === "enum") return field.enum.slice(0, 8);
  if (field.type === "boolean") return ["Yes", "No"];
  return [];
}

// Picks the section from keywords, or null when unclear
function sectionFromText(text) {
  const hits = allSpecs().filter((spec) => spec.keywords.test(text));
  return hits.length === 1 ? hits[0].id : hits.length ? hits[0].id : null;
}

module.exports = {
  specOf, allSpecs, schemaSummary, coerce, coerceAll, missingFields, questionFor, choicesFor,
  sectionFromText, dateProblem, toYear, toMonth, MONTHS
};
