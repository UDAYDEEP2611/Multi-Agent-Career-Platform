const { allSpecs, specOf } = require("./sectionSpecs");
const { classifySection } = require("./textUnderstanding");
const { correctedText } = require("../nlp/wordAnalyzer");
const { predict } = require("../nlp/trainedModels");

// Reads a chat message's structure before any model sees it:
//
// - Which section: every signal adds weight. What the user asks for
//   ("add a project", "to my skills") counts most, then labelled lines
//   ("Project name:", "Degree:"), then the first line's keywords, then
//   keywords anywhere, then the Naive Bayes classifier's probabilities. A
//   description that mentions "job-match" can't outvote "Add a project".
// - Labelled lines: "Project name: UltraUnityVerse", "Type: Personal" and a
//   "Description" heading followed by a paragraph are read straight into
//   the section's fields.

// The word after "add a …" or "to my …", and the section it means
const NOUNS = [
  [/^projects?$/, "projects"],
  [/^(jobs?|positions?|roles?|internships?|experiences?|work|employment|employer)$/, "experience"],
  [/^(degrees?|educations?|schools?|universit\w*|colleges?|masters?|bachelors?|ph\.?d)$/, "education"],
  [/^(certifications?|certificates?|certs?|licen[cs]es?|credentials?)$/, "certifications"],
  [/^(awards?|achievements?|activit(?:y|ies)|honou?rs?|scholarships?|prizes?)$/, "achievements"],
  [/^(volunteering|volunteer)$/, "volunteering"],
  [/^(publications?|papers?|articles?)$/, "publications"],
  [/^patents?$/, "patents"],
  [/^(interests?|hobb(?:y|ies))$/, "interests"],
  [/^skills?$/, "skills"],
  [/^(recommendations?|references?|testimonials?|endorsements?)$/, "recommendations"],
  [/^(summary|bio|about)$/, "summary"],
  [/^(profile|contact|headline|phone|email|linkedin|address|name)$/, "profile"]
];

const sectionForNoun = (word) => NOUNS.find(([pattern]) => pattern.test(String(word || "")))?.[1] || null;

// "add a project", "create my new certification", "update my summary"
const REQUESTED = /\b(?:add|create|record|enter|put|save|include|new|another|update|change|edit|set|fix)\s+(?:(?:a|an|my|the|new|another|one|this|some)\s+){0,3}([a-z.]+)/gi;
// "… to my skills", "… in my profile", "… as a project"
const TARGET = /\b(?:to|in|into|under|for)\s+(?:my|the)\s+([a-z]+)(?:\s+section)?\b|\bas\s+(?:a|an|my)\s+(?:new\s+)?([a-z]+)\b/gi;

// Field names people write as labels, by field
const LABELS = {
  title: ["project name", "project title", "name", "title", "project", "paper", "paper title", "award", "achievement", "patent title"],
  name: ["name", "certification", "certificate", "certification name", "skill", "interest"],
  description: ["description", "about", "details", "overview", "what it does", "summary"],
  summary: ["summary", "description", "about", "details", "responsibilities"],
  content: ["summary", "bio", "about me"],
  role: ["role", "my role", "position"],
  projectType: ["type", "project type", "category", "kind"],
  status: ["status", "state", "stage"],
  githubUrl: ["github", "repo", "repository", "source", "source code", "code"],
  demoUrl: ["demo", "live demo", "live", "demo url"],
  websiteUrl: ["website", "site", "url", "link", "homepage"],
  startYear: ["start", "started", "start year", "from", "start date", "since"],
  endYear: ["end", "ended", "end year", "to", "until", "end date", "finished"],
  institution: ["school", "university", "college", "institution", "institute"],
  degree: ["degree", "qualification"],
  fieldOfStudy: ["field", "field of study", "major", "subject", "specialization"],
  grade: ["gpa", "cgpa", "grade", "score"],
  jobTitle: ["job title", "title", "position", "role", "designation"],
  organization: ["company", "organization", "organisation", "employer", "firm", "nonprofit"],
  location: ["location", "place", "city"],
  employmentType: ["employment type", "type", "job type"],
  issuingOrganization: ["issuer", "issued by", "issuing organization", "provider", "authority", "from"],
  issueYear: ["issued", "issue year", "issue date", "date", "year"],
  expirationYear: ["expires", "expiration", "expiry", "valid until"],
  credentialId: ["credential id", "credential", "license number", "id"],
  credentialUrl: ["credential url", "verify", "verification", "url", "link"],
  publisher: ["publisher", "journal", "conference", "venue", "published in"],
  publishedOn: ["published", "published on", "date"],
  patentNumber: ["patent number", "application number", "number"],
  issuer: ["issuer", "given by", "awarded by", "from", "organization"],
  result: ["result", "rank", "position", "place"],
  category: ["category", "type"],
  cause: ["cause"],
  rating: ["level", "rating", "proficiency"],
  skillType: ["type", "skill type"],
  firstName: ["first name", "given name"],
  lastName: ["last name", "surname", "family name"],
  relationship: ["relationship", "relation", "how we know each other"],
  recommenderTitle: ["their title", "recommender title"],
  recommenderOrganization: ["their company", "their organization", "recommender organization"],
  text: ["recommendation", "text", "what they said", "quote"],
  email: ["email", "e mail", "mail"],
  phoneNumber: ["phone", "phone number", "mobile", "cell"],
  addressLine: ["address", "street", "street address"],
  city: ["city", "town"],
  stateProvince: ["state", "province", "region"],
  country: ["country"],
  postalCode: ["postal code", "zip", "zip code", "pin", "pin code"],
  linkedinUrl: ["linkedin", "linkedin url"],
  portfolioUrl: ["portfolio", "portfolio url", "personal website"],
  headline: ["headline", "tagline"],
  targetRoles: ["target roles", "roles", "looking for", "open to"]
};

const norm = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const LABEL_LINE = /^\s*(?:[-•*]\s*)?([A-Za-z][A-Za-z0-9 ./&()'-]{0,34}?)\s*[:：=]\s*(.+?)\s*$/;
const HEADING_LINE = /^\s*(description|summary|about|details|overview|responsibilities|what it does|recommendation)\s*:?\s*$/i;
const isUrlScheme = (label) => /^(https?|ftp|mailto)$/i.test(label.trim());

// The field a label names in this section, or null
function fieldForLabel(spec, label) {
  const key = norm(label);
  for (const field of spec.fieldSpecs) if ((LABELS[field.name] || []).includes(key)) return field.name;
  const byLabel = spec.fieldSpecs.find((field) => norm(field.label) === key || norm(field.name) === key);
  return byLabel?.name || null;
}

// Labels that name a field in only some sections point at those sections
// ("Degree:" -> education); generic ones ("Name:", "Date:") point nowhere
const GENERIC_LABELS = new Set(["name", "title", "type", "description", "summary", "about", "details", "date", "year", "url", "link",
  "from", "to", "status", "role", "category", "level", "number", "id", "text", "start", "end", "location", "city"]);

function sectionsForLabel(label) {
  if (GENERIC_LABELS.has(norm(label))) return [];
  return allSpecs().filter((spec) => fieldForLabel(spec, label)).map((spec) => spec.id);
}

function labelledLines(text) {
  return String(text || "").split(/\r?\n/).map((line) => line.match(LABEL_LINE)).filter(Boolean)
    .filter((match) => !isUrlScheme(match[1])).map((match) => ({ label: match[1].trim(), value: match[2].trim() }));
}

// { data, extras } from labelled lines and description paragraphs
function readLabelled(spec, text) {
  const data = {};
  const extras = [];
  const descField = ["description", "summary", "content", "text"].find((name) => spec.fieldSpecs.some((field) => field.name === name));
  let paragraph = null;

  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (HEADING_LINE.test(line)) {
      paragraph = [];
      continue;
    }
    const match = line.match(LABEL_LINE);
    if (match && !isUrlScheme(match[1])) {
      paragraph = null;
      const field = fieldForLabel(spec, match[1]);
      if (field && data[field] === undefined) data[field] = match[2].trim();
      else if (!field) extras.push({ label: match[1].trim(), value: match[2].trim() });
      continue;
    }
    if (paragraph) {
      paragraph.push(line);
      if (descField) data[descField] = paragraph.join(" ");
    }
  }

  // Labels this section has no field for go in its description, so nothing
  // the user wrote is lost ("Tagline: Your Career, Unified")
  const structured = Object.keys(data).some((name) => name !== descField);
  if (descField && extras.length && structured) {
    const kept = extras.filter((item) => item.value.split(/\s+/).length <= 40).map((item) => `${item.label}: ${item.value}`);
    if (kept.length) data[descField] = [data[descField], kept.join(". ")].filter(Boolean).join("\n\n");
  }
  return { data, extras };
}

// { section, confident, scores, reasons, method }
async function scoreSections(text) {
  const scores = Object.fromEntries(allSpecs().map((spec) => [spec.id, 0]));
  const reasons = [];
  const add = (id, points, why) => {
    if (!id || !(id in scores)) return;
    scores[id] += points;
    reasons.push(`${why} → ${specOf(id).label} (+${points})`);
  };

  // Typos and shorthand fixed first ("add a projct"), for reading only
  const read = correctedText(text);
  const lower = read.toLowerCase();
  for (const match of lower.matchAll(REQUESTED)) add(sectionForNoun(match[1]), 6, `you asked to "${match[0].trim()}"`);
  for (const match of lower.matchAll(TARGET)) add(sectionForNoun(match[1] || match[2]), 6, `"${match[0].trim()}"`);
  for (const { label } of labelledLines(text)) for (const id of sectionsForLabel(label)) add(id, 3, `the label "${label}:"`);

  const firstLine = read.split(/\r?\n/).find((line) => line.trim()) || "";
  for (const spec of allSpecs()) {
    if (spec.keywords.test(firstLine)) add(spec.id, 2, "the first line's wording");
    else if (spec.keywords.test(read)) add(spec.id, 1, "wording further down");
  }

  // The trained models (ml/train.py) carry more weight than the small one
  const trained = predict("section", text);
  if (trained?.known >= 0.3) {
    for (const item of trained.ranked.slice(0, 2)) {
      if (item.p < 0.2 || !(item.label in scores)) continue;
      scores[item.label] += 3 * item.p;
      reasons.push(`trained models ${Math.round(item.p * 100)}% → ${specOf(item.label).label}`);
    }
  }
  const ml = await classifySection(read);
  for (const item of ml.ranked.slice(0, 3)) {
    if (item.p < 0.15) continue;
    scores[item.label] += 2 * item.p;
    reasons.push(`${ml.method} classifier ${Math.round(item.p * 100)}% → ${specOf(item.label).label}`);
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [[top, best], [, next]] = ranked;
  // Confident: a clear winner, or something the user asked for outright
  const confident = best >= 2 && (best >= next * 1.6 || best - next >= 3);
  return { section: best > 0 ? top : null, confident, scores: ranked.filter(([, score]) => score > 0), reasons, method: ml.method };
}

module.exports = { scoreSections, readLabelled, labelledLines, fieldForLabel, sectionForNoun };
