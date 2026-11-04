const { mentions } = require("../resume/atsRules");
const { dictionaryKeywords } = require("../resume/skillDictionary");
const { aliasesOf, knownSkill } = require("../resume/resumeQuality");
const { priorityOf, findQualifications, PREFERRED, DEGREES } = require("./requirements");
const { experienceYears, degreeLevel } = require("./evidence");
const { EQUIVALENT, RELATED, PARTIAL, CONCEPTS, CANONICAL, INFERENCES } = require("./skillRelations");
const { jobInfoOf } = require("./jobInfo");
const { synonymsOf, abbreviationId } = require("./abbreviations");

// Job Match Assessment: compares any resume with any job, for every kind of
// role, by the substance of the experience rather than copied phrases.
//
// Three separate results:
//   Semantic fit   M = 0.40 required + 0.30 responsibilities + 0.15 preferred
//                  + 0.10 domain + 0.05 education (weights of categories that
//                  don't apply are shared out proportionally)
//   Eligibility    work authorization, clearance, mandatory licenses,
//                  location, minimum years: Met / Not Met / Unknown
//   Keywords       coverage of the job's terms, for the ATS check
//
// Each requirement gets a match type and a score anchor: direct 100%,
// equivalent 95% (PySpark for Spark), related 70% (Airflow for AWS Glue, with
// the consideration stated), partial 40% (Docker for Kubernetes), listed only
// 40% (70% when the job asks only for familiarity), missing 0. Evidence
// confidence is reported separately. Responsibilities are split into their
// capabilities (design, deploy, monitor, optimize) and scored one by one.
//
// Code finds and checks everything; when Ollama is running, the JD Analyst
// agent adds requirements the rules missed (each must be in the job's own
// text) and the Evidence agent matches duties worded differently (each match
// must share words with its bullet). Nothing on the resume is invented.

const STOPWORDS = new Set(("a an and or of for to in on with by from using across over into via as at is are was were be been " +
  "that this these those it its our your you we they their will would can could should may must not no all any each " +
  "such other more most well also including include includes etc ability able strong excellent good work working " +
  "role team teams job candidate experience experienced years year new").split(" "));

// "managing" "managed" "manages" -> "manag"
const stem = (word) => word.replace(/(ing|ed|es|s|ment|ments)$/, "").replace(/(.)\1$/, "$1");
const wordsOf = (text) => new Set((String(text).toLowerCase().match(/[a-z][a-z0-9+#]+/g) || [])
  .filter((word) => word.length > 2 && !STOPWORDS.has(word)).map(stem));

// ---- Reading the job ----

// Bullet symbols or a list number ("1.", "2)"), never the number in "5+ years"
const BULLET = /^(?:[•●▪◦‣∙·\-*–]+|\d{1,2}[.)](?!\d))\s*/;
const JOB_SECTIONS = [
  ["ignore", /\b(benefits|perks|about (us|the (company|team))|who we are|compensation|salary|pay range|equal (employment )?opportunity|what we offer|why join|our (mission|values|culture)|location|how to apply|privacy policy|terms of (service|use)|share this job|job alerts|sign up|powered by)\b/i],
  ["preferred", /\b(preferred|nice[- ]to[- ]have|bonus|desired|desirable|a plus|additional (skills|qualifications))\b/i],
  ["responsibilities", /\b(responsibilit\w*|what you('| wi)ll do|duties|day[- ]to[- ]day|accountabilit\w*|what you will be doing|in this role|the role|your role|your impact|job summary)\b/i],
  ["required", /\b(requirements?|qualifications?|required|must[- ]haves?|what you('ll| will)? bring|what we('re| are) looking for|who you are|skills|minimum|basic|competencies|you have|about you)\b/i]
];
const QUALIFICATION_WORDS = /\b(years?|degree|bachelor|master|diploma|certif\w*|licen[cs]\w*|proficien\w*|knowledge of|experience (with|in|using)|familiar\w*|ability to|skill(ed|s)? in|expertise|understanding of|background in)\b/i;

const isHeading = (line) => line.length <= 70 && !/[.!?]$/.test(line.replace(/:$/, "")) && line.split(/\s+/).length <= 8;

// What a job line is, before anything is scored:
//   section     a heading that starts responsibilities / required / preferred
//   subheading  a structural label inside a section ("Technical Proficiency:",
//               "Junior skills:"): kept as the items' group, never scored
//   labeled     "Collaboration: Work with clients...": the label is the group,
//               the rest is the item
//   item        anything else
// A list ("Basic NLP, computer vision, or generative AI") is an item even
// when it's short and starts with a heading word.
const SUBSECTION = /^(?:[\w/-]+\s+){0,2}(?:skills|competencies|proficiency|performance|expertise|requirements|qualifications|experience|education|compliance)$/i;
function classifyLine(line, current) {
  if (BULLET.test(line) && !/^\d{1,2}\s*(?:-|–|to)/.test(line)) return { type: "item", text: line.replace(BULLET, "") };
  const labeled = line.match(/^([A-Z][\w/&' -]{1,40}):\s+(\S.{9,})$/);
  if (labeled) return { type: "labeled", label: labeled[1].trim(), text: labeled[2].trim() };
  const colon = /:\s*$/.test(line);
  const listLike = /,|\s\/\s|\(/.test(line);
  if (!isHeading(line) || (listLike && !colon)) return { type: "item", text: line };
  const bare = line.replace(/:\s*$/, "").trim();
  const kind = (JOB_SECTIONS.find(([, pattern]) => pattern.test(bare)) || [])[0];
  // Inside a section, "Junior skills:" or "Technical Proficiency:" groups items; it doesn't start a new section
  if (kind && !(current && current !== "ignore" && colon && SUBSECTION.test(bare) && !/^(minimum|basic|required|preferred|core)\b/i.test(bare))) return { type: "section", kind };
  // A colon line or a capitalized short label is structure, not a requirement
  if (colon || /^[A-Z][\w&/-]*(?:\s+(?:[A-Z][\w&/-]*|of|and|&|to|for|the)){0,5}$/.test(bare)) return { type: "subheading", label: bare };
  return { type: "item", text: line };
}

// How important a sentence says its ask is, whatever section it's in:
//   excluded   "No prior experience required", "Kafka is not required": not asked
//   preferred  "Java and JavaScript are a plus", "Python preferred but not required"
//   optional   "optional", "if applicable": asked, but weighs half a preference
//   mandatory  "must", "is required", "essential" (and not negated)
//   null       the section decides
const NOT_NEEDED = /\b(?:no (?:prior |previous |formal )?(?:experience|degree|certifications?|background)(?: \w+)? (?:is |are )?(?:required|necessary|needed|expected)|without (?:any )?(?:prior|previous|formal) experience|(?:is|are) not (?:required|necessary|needed|expected|a requirement)|not a requirement|no need for)\b/i;
const SOFTENED = /\b(?:preferred|prefer|a plus|nice[- ]to[- ]have|bonus|desirable|ideally|helpful|beneficial|an advantage|advantageous|but not (?:required|mandatory|necessary))\b/i;
const OPTIONAL = /\b(?:optional|if applicable)\b/i;
const MANDATORY = /\b(?:must|required|mandatory|essential)\b/i;
// A bracketed aside ("(Python is a plus)") is about its own term, not the
// whole sentence: it doesn't make the line a preference
function importanceOf(text) {
  const sentence = text.replace(/\([^)]*\)/g, " ");
  if (NOT_NEEDED.test(sentence) && !SOFTENED.test(sentence)) return "excluded";
  if (SOFTENED.test(sentence)) return "preferred";
  if (OPTIONAL.test(sentence)) return "optional";
  if (MANDATORY.test(sentence)) return "mandatory";
  return null;
}
// "Python is required, but Java is a plus" / "Must have: Python; nice to have: Go":
// clauses of different importance become separate asks
function clausesOf(sentence) {
  const parts = sentence.split(/\s*;\s*|,?\s+(?:but(?! not\b)|while|whereas)\s+|,\s+and\s+(?=[^,]*\b(?:a plus|preferred|nice[- ]to[- ]have|bonus|not required)\b)/i).map((part) => part.trim()).filter((part) => part.length >= 4);
  if (parts.length < 2) return [sentence];
  const levels = parts.map(importanceOf);
  // One importance throughout (or a negation that needs its clause): keep the sentence whole
  if (new Set(levels.map((level) => level || "section")).size < 2 || levels.some((level, index) => level === null && /^(?:not|but)\b/i.test(parts[index]))) return [sentence];
  return parts;
}

// The job's lines grouped as responsibilities, required and preferred.
// headings: the structural lines left out of scoring; groups: item -> its
// sub-heading or label (the hierarchy, kept as metadata)
function jobSections(jobDescription) {
  const lines = jobDescription.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections = { responsibilities: [], required: [], preferred: [] };
  const headingsSeen = [];
  const groups = {};
  const ignored = [];
  // Asks the job says aren't needed, and how important each kept ask is
  const excluded = [];
  const importance = {};
  let current = null;
  let group = "";
  let headings = 0;

  for (const line of lines) {
    const kind = classifyLine(line, current);
    if (kind.type === "section") {
      current = kind.kind;
      group = "";
      headings += 1;
      continue;
    }
    if (kind.type === "subheading") {
      if (current && current !== "ignore") headingsSeen.push(kind.label);
      group = kind.label;
      continue;
    }
    if (current === "ignore") ignored.push(line);
    if (!current || current === "ignore") continue;
    const label = kind.type === "labeled" ? kind.label : group;
    // A paragraph is split into sentences, each its own item
    for (const sentence of kind.text.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      let item = sentence.trim().replace(/[;,]$/, "");
      // "Experience:" / "Junior (0 to 4 years)": the range belongs to its label
      if (/^experience$/i.test(label) && /\d\s*(?:-|–|to)\s*\d+\s*(?:years?|yrs)/i.test(item)) item = `${item.replace(/\)$/, "")} of experience${item.endsWith(")") ? ")" : ""}`;
      if (item.length < 4 || item.length > 300) continue;
      // Each clause where it belongs: "Java is a plus" in Requirements is a preference
      const clauses = current === "responsibilities" ? [item] : clausesOf(item);
      clauses.forEach((clause, index) => {
        // "Must have: Python; nice to have: Go": the label speaks for the first clause
        const level = current === "responsibilities" ? null : importanceOf(clause) || (index === 0 && kind.type === "labeled" ? importanceOf(label) : null);
        if (level === "excluded") {
          excluded.push(clause);
          return;
        }
        const target = level === "preferred" || level === "optional" ? "preferred" : current;
        // A short clause ("Python") counts only as part of a split sentence
        if (clause.length < (clauses.length > 1 ? 2 : 12)) return;
        sections[target].push(clause);
        if (label) groups[clause] = label;
        if (level) importance[clause] = level;
      });
    }
  }
  Object.defineProperty(sections, "headings", { value: headingsSeen, enumerable: false });
  Object.defineProperty(sections, "groups", { value: groups, enumerable: false });
  // Benefits, EEO and other boilerplate, kept out of domain detection
  Object.defineProperty(sections, "ignored", { value: ignored, enumerable: false });
  Object.defineProperty(sections, "excluded", { value: excluded, enumerable: false });
  Object.defineProperty(sections, "importance", { value: importance, enumerable: false });

  // No headings: sort the sentences by what they ask for
  if (!headings) {
    for (const sentence of jobDescription.split(/(?<=[.!?])\s+|\n+/).map((text) => text.replace(BULLET, "").trim())) {
      if (sentence.length < 12 || sentence.length > 300) continue;
      if (JOB_SECTIONS[0][1].test(sentence)) continue;
      // Asks for a qualification, or names skills and tools
      if (QUALIFICATION_WORDS.test(sentence) || dictionaryKeywords(sentence).length) {
        const level = importanceOf(sentence);
        if (level === "excluded") excluded.push(sentence);
        else sections[level === "preferred" || level === "optional" || PREFERRED.test(sentence) ? "preferred" : "required"].push(sentence);
        if (level && level !== "excluded") importance[sentence] = level;
      }
      else if (/^(you will|you'll|responsible for|[A-Z][a-z]+(e|ate|ize|ign|ain|ort|ild|lop|age|ct|ew|ve|eed|ish|ess|ent|ute|ure|end|yze)s?\b)/.test(sentence)) sections.responsibilities.push(sentence);
    }
  }
  return sections;
}

// "Experience with QuickBooks, payroll processing and month-end close"
// -> QuickBooks, payroll processing, month-end close
const LEAD_INS = /\b(?:experience (?:(?:\w+ing)\s+)?(?:with|in|using|on)|experience (?:implementing|building|developing|designing)|knowledge of|proficien(?:cy|t) (?:in|with)|familiar(?:ity)? with|skilled in|expertise in|understanding of|background in|certifi(?:ed|cation) in|hands-on with|working knowledge of|working with)\s+([^.;:()]+)/gi;
// Ends on a letter or digit: "AI-enabled" gives no "AI-"
const ACRONYM = /\b[A-Z][A-Z0-9&+/-]{0,6}[A-Z0-9]\b/g;
const NOT_KEYWORDS = new Set(["US", "USA", "EEO", "EOE", "AND", "OR", "THE", "II", "III", "IV", "OK", "TX", "CA", "NY", "LLC", "INC", "FAQ", "ID", "PTO"]);

// Too broad to be a requirement on their own
const GENERIC_TERMS = new Set(["software", "technology", "technologies", "data", "systems", "engineering", "development", "tools", "a related field", "related field", "computer science", "industry", "business",
  "workflow", "workflows", "automation", "platforms", "solutions", "applications", "technical discipline", "related technical discipline"]);

function phrasesFrom(items) {
  const phrases = [];
  for (const raw of items) {
    // "generation (RAG), or agentic frameworks", "such as prompt design": lists continue
    const item = raw.replace(/[()]/g, ", ").replace(/\b(?:such as|e\.g\.|for example|including|like)\s/gi, ", ");
    for (const match of item.matchAll(LEAD_INS)) {
      // ", and model lifecycle management" -> "model lifecycle management"
      phrases.push(...match[1].split(/\s*,\s*(?:and|or)?\s*|\s+(?:and|or|as well as)\s+/i));
    }
    phrases.push(...(item.match(ACRONYM) || []).filter((word) => !NOT_KEYWORDS.has(word)));
  }
  return phrases
    .map((phrase) => phrase.replace(/^(?:(?:a|an|the|and|or|strong|solid|deep|working|basic|advanced|modern|common|related|relevant|similar|other|using|developing|integrating|building|implementing|designing)\s+)+/i, "").replace(/\s+(?:concepts|methods|environments|technologies)$/i, "").trim())
    .filter((phrase) => phrase.length >= 2 && phrase.split(/\s+/).length <= 4 && !/^\d/.test(phrase) && !/^(e\.g|etc)\.?$/i.test(phrase) && !GENERIC_TERMS.has(phrase.toLowerCase()));
}

// "LLM" and "Large Language Models" are one term (see abbreviations.js)
const sameTerm = (a, b) => a.toLowerCase() === b.toLowerCase() || mentions(a, b) || mentions(b, a) || (Boolean(abbreviationId(a)) && abbreviationId(a) === abbreviationId(b));

function uniqueTerms(terms) {
  const kept = [];
  for (const term of terms) if (!kept.some((other) => sameTerm(other, term))) kept.push(term);
  return kept;
}


// ---- Reading the resume ----

// Internships, academic and volunteer work: counted, but not as
// full-time professional experience
const NOT_PROFESSIONAL = /\b(intern(ship)?|trainee|apprentice|student|volunteer|teaching assistant|research assistant|graduate assistant|fellow(ship)?)\b/i;

// A professional proof of concept: real hands-on work, limited in scope
const POC = /\b(?:prototype\w*|proofs? of concept|poc|pilot(?:ed)?|mvp|hackathon)\b/i;
const monthOf = (date) => (date?.year ? date.year * 12 + ((date.month || 1) - 1) : null);

function resumeEvidence(resume, now = new Date()) {
  const fromJob = (item) => (NOT_PROFESSIONAL.test(`${item.title} ${item.organization}`) ? "internship" : "work");
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const bullets = [
    ...resume.experience.flatMap((item) => item.bullets.map((text, index) => ({
      text, source: fromJob(item), where: `${[item.title, item.organization].filter(Boolean).join(" at ")}, bullet ${index + 1}`,
      // When the work was done (for recency); undated jobs stay unknown
      end: item.current ? thisMonth : monthOf(item.end) ?? monthOf(item.start), thisMonth,
      ...(POC.test(text) ? { scope: "poc" } : {})
    }))),
    ...resume.projects.flatMap((item) => {
      const credibility = projectCredibility(`${item.title} ${item.bullets.join(" ")}`);
      return item.bullets.map((text, index) => ({ text, source: "project", credibility, where: `Project "${item.title}", bullet ${index + 1}` }));
    })
  ].map((bullet) => ({ ...bullet, words: wordsOf(bullet.text) }));
  // Job titles: "Software Engineer" for a year is software engineering experience
  const titles = resume.experience.filter((item) => item.title && item.title !== "Role").map((item) => ({
    text: item.title, source: fromJob(item), where: `Job title at ${item.organization}`, words: wordsOf(item.title)
  }));
  const listed = [resume.summary || "", ...resume.skills.technical, ...resume.skills.soft, ...resume.education.map((item) => item.degree), ...(resume.other || [])].join("\n");
  const all = `${listed}\n${bullets.map((bullet) => bullet.text).join("\n")}`;
  // A public code profile and projects: public work, which isn't by itself a
  // contribution to someone else's open-source project
  const publicCodeUrl = resume.contact?.github || (all.match(/\b(?:https?:\/\/)?(?:github|gitlab)\.com\/[\w-]+/i) || [])[0] || "";
  // Every non-bullet line with its section, so any credit can cite the exact text it rests on
  const lines = [
    ...resume.skills.technical.map((text) => ({ text, section: "Skills" })),
    ...resume.skills.soft.map((text) => ({ text, section: "Skills" })),
    ...String(resume.summary || "").split(/(?<=[.!?])\s+/).filter(Boolean).map((text) => ({ text, section: "Summary" })),
    ...resume.education.map((item) => ({ text: item.degree, section: "Education" })),
    ...(resume.certifications || []).map((text) => ({ text, section: "Certifications" })),
    ...(resume.other || []).map((text) => ({ text, section: "Other sections" })),
    ...resume.projects.map((item) => ({ text: item.title, section: "Projects" })),
    ...resume.experience.filter((item) => item.organization).map((item) => ({ text: item.organization, section: "Experience" })),
    ...(publicCodeUrl ? [{ text: publicCodeUrl, section: "Contact line" }] : [])
  ].filter((line) => line.text && line.text.trim()).map((line) => ({ ...line, words: wordsOf(line.text) }));
  return {
    bullets, titles, listed, all, lines, initials: initialsOf(all), credentials: (resume.other || []).join("\n"),
    publicCode: Boolean(publicCodeUrl), publicCodeUrl, projects: resume.projects.filter((item) => item.bullets.length).map((item) => item.title)
  };
}


// The exact resume line that names a term (skills first), as evidence
function lineNaming(evidence, term) {
  const line = evidence.lines.find((entry) => names(entry.text, term)) ||
    (/^[A-Z]{2,6}$/.test(term) ? evidence.lines.find((entry) => initialsOf(entry.text).has(term)) : null);
  return line ? { text: line.text, where: line.section, section: line.section, source: "listed" } : null;
}
// The line (or bullet) a whole-resume match came from
function lineAt(evidence, text) {
  const bullet = evidence.bullets.find((entry) => entry.text.includes(text) || text.includes(entry.text));
  if (bullet) return { text: bullet.text, where: bullet.where, source: bullet.source };
  const line = evidence.lines.find((entry) => entry.text.includes(text.trim()) || text.includes(entry.text));
  return { text: line ? line.text : text.trim(), where: line ? line.section : "Resume", section: line?.section, source: "listed" };
}
// For a match against the skills/education/certifications text as a whole:
// the one line sharing the most of these words
function lineSharing(evidence, text) {
  const words = wordsOf(text);
  const ranked = evidence.lines.map((line) => ({ line, shared: [...words].filter((word) => line.words.has(word)).length })).filter((entry) => entry.shared).sort((a, b) => b.shared - a.shared);
  const line = ranked[0]?.line;
  return line ? { text: line.text, where: line.section, source: "listed" } : null;
}

// Initials of word runs on the resume, so "BSN" matches "Bachelor of
// Science in Nursing" and "RN" matches "Registered Nurse", in any field
const MINOR = new Set(["of", "in", "and", "the", "for", "&"]);
function initialsOf(text) {
  const found = new Set();
  for (const line of text.split(/\n|[,;:()|]/)) {
    const words = line.split(/\s+/).filter((word) => /^[A-Za-z]/.test(word) && !MINOR.has(word.toLowerCase()));
    for (let start = 0; start < words.length; start += 1) {
      for (let length = 2; length <= 5 && start + length <= words.length; length += 1) {
        const run = words.slice(start, start + length);
        // Spelled-out names are capitalized ("Registered Nurse", not "provided patient")
        if (run.every((word) => /^[A-Z]/.test(word))) found.add(run.map((word) => word[0]).join("").toUpperCase());
      }
    }
  }
  return found;
}


// The bullet sharing the most words with a duty, and how much of the duty it covers
function bestBullet(text, bullets) {
  const words = wordsOf(text);
  if (!words.size) return { score: 0, bullet: null };
  let best = { score: 0, bullet: null };
  for (const bullet of bullets) {
    const shared = [...words].filter((word) => bullet.words.has(word)).length;
    const score = shared / words.size;
    if (score > best.score) best = { score, bullet };
  }
  return best;
}



// ---- Matching one requirement term ----

// Default score anchors. The credit a requirement finally gets also depends
// on how deep the job asks for it (depthOf) and how strong the evidence is.
const ANCHOR = { direct: 1, equivalent: 0.95, related: 0.85, partial: 0.65, listed: 0.5, missing: 0 };
const DEPTH = /(deploy|production|prod\b|scal|monitor|test|latency|throughput|users|customers|patients|clients|led|manag|improv|reduc|increas|\d)/i;

// How deep the job expects a skill: 1 familiarity, 2 hands-on, 3 proficient or expert
function depthOf(wording, text = "") {
  if (wording === "proficient" || /\b(expert\w*|advanced|administ\w*|architect\w*|deep expertise|in-depth|mastery)\b/i.test(text)) return 3;
  if (wording === "familiarity" || wording === "working" || /\b(basic|basics of|exposure to|comfortable (?:with|using)|everyday)\b/i.test(text)) return 1;
  return 2;
}

// Credit for each match type at each depth. A related technology or a
// listing alone proves less the deeper the job asks; a partial relation
// (Docker for Kubernetes) earns nothing when expertise is required.
const CREDIT = {
  direct: [1, 1, 1],
  equivalent: [0.95, 0.95, 0.95],
  related: [0.85, 0.85, 0.7],
  // Contextually inferred, not verified: allowed for familiarity, flagged
  // for hands-on asks, never enough for proficiency or expertise
  inferred: [0.8, 0.6, 0],
  partial: [0.65, 0.35, 0],
  listed: [0.7, 0.5, 0.3],
  // Possible evidence the engine can't interpret: no provisional credit,
  // but kept apart from confirmed gaps for manual review
  uncertain: [0, 0, 0],
  // Plausible but not established: shown for confirmation, not as a gap
  confirm: [0, 0, 0],
  // Said by the candidate in JobPilot, not on the resume (see CREDIT_CONFIRMED)
  confirmed: [0.85, 0.75, 0.5],
  missing: [0, 0, 0]
};
const DEPTH_WORDS = ["familiarity", "hands-on experience", "proficiency"];

// How credible a project is as evidence, from its own description
// What was actually built decides, not where: a tutorial shows learning; an
// academic or independent project shows implementation; a deployed one with
// users shows more. kind: independent | academic | tutorial
function projectCredibility(text) {
  if (/\b(tutorial|udemy|coursera|followed along|course exercise|guided project|codealong|code-along)\b/i.test(text)) return { value: 0.45, tier: "tutorial or course exercise", kind: "tutorial" };
  if (text.length < 80) return { value: 0.45, tier: "minimally described project", kind: "independent" };
  const academic = /\b(course project|class project|coursework|capstone|thesis|dissertation|semester|university|academic|graduate project|lab project)\b/i.test(text);
  const kind = academic ? "academic" : "independent";
  if (/\b(production|live|in use|adopted|downloads|active users)\b/i.test(text) && /\d/.test(text)) return { value: 0.95, tier: `${kind} project in production with usage`, kind };
  if (/\b(deployed|hosted|launched|ci\/cd|unit tests?|tested|monitor\w*)\b/i.test(text)) return { value: 0.9, tier: `deployed ${kind} project`, kind };
  if (/\b(prototype|proof of concept|poc|hackathon|demo|mvp)\b/i.test(text)) return { value: 0.7, tier: "prototype or proof of concept", kind };
  return { value: 0.8, tier: `working end-to-end ${kind} project`, kind };
}

// Where a credit's evidence comes from, strongest first
const SOURCE_LABELS = {
  production: "Production professional experience", poc: "Professional proof-of-concept", work: "Professional experience",
  internship: "Internship", independent: "Independent project", academic: "Academic project", tutorial: "Tutorial or course exercise",
  listed: "Skills list only", confirmed: "Candidate-confirmed (self-reported)", inferred: "Inferred from work", none: "No evidence"
};
function evidenceSourceOf(found, match) {
  if (match === "confirmed") return SOURCE_LABELS.confirmed;
  if (match === "inferred" || match === "confirm") return SOURCE_LABELS.inferred;
  if (match === "listed") return SOURCE_LABELS.listed;
  if (!found.length) return SOURCE_LABELS.none;
  const rank = (bullet) => (bullet.source === "work" ? (bullet.scope === "poc" ? "poc" : DEPTH.test(bullet.text) ? "production" : "work") : bullet.source === "internship" ? "internship" : bullet.credibility?.kind || "independent");
  const order = ["production", "work", "poc", "internship", "independent", "academic", "tutorial"];
  return SOURCE_LABELS[found.map(rank).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]];
}

// How deep the evidence goes, in the job's terms (compared with what it asks)
function proficiencyShown(found, match) {
  if (match === "listed") return "listed only";
  if (match === "confirmed") return "self-reported";
  if (["inferred", "confirm"].includes(match)) return "inferred";
  if (!found.length) return match === "missing" ? "not shown" : "stated";
  if (found.some((bullet) => bullet.source === "work" && bullet.scope !== "poc" && DEPTH.test(bullet.text))) return "production experience";
  if (found.some((bullet) => bullet.source === "work" || bullet.source === "internship")) return "hands-on (work)";
  if (found.every((bullet) => bullet.credibility?.kind === "tutorial")) return "learning (tutorial)";
  return "hands-on (project)";
}

// Old evidence counts a little less: all of it more than 7 years ago is
// worth 90%. Projects and undated jobs have no date, so no adjustment.
const STALE_MONTHS = 84;
function recencyOf(found) {
  const dated = found.filter((bullet) => bullet.end !== null && bullet.end !== undefined);
  if (!dated.length) return null;
  const latest = Math.max(...dated.map((bullet) => bullet.end));
  const monthsAgo = Math.max(0, dated[0].thisMonth - latest);
  // An undated project beside it may be recent: then nothing is stale
  return { lastShown: Math.floor(latest / 12), monthsAgo, stale: monthsAgo > STALE_MONTHS && dated.length === found.length };
}

// How much one bullet's source counts at a depth. Projects and internships
// prove implementation; they prove enterprise-depth proficiency only as far
// as their credibility goes.
function sourceFactor(bullet, depth) {
  // A professional proof of concept is real work with limited scope
  if (bullet.source === "work") return bullet.scope === "poc" && depth === 3 ? 0.85 : 1;
  if (bullet.source === "internship") return depth === 3 ? 0.85 : 1;
  const credibility = bullet.credibility?.value ?? 0.8;
  if (depth === 3) return credibility;
  return credibility < 0.6 ? Math.min(1, credibility + 0.2) : 1;
}

// The relation table entry for a term: the longest key the term names
// strict (for tables that grant credit): the term's other words must be
// generic ("DevOps tools", "CI/CD pipelines"), so a product ("Azure DevOps")
// doesn't borrow the broad practice's equivalents
const GENERIC_SUFFIX = new Set(("tools tooling tool platform platforms concepts concept experience skills systems system frameworks framework libraries library pipelines pipeline " +
  "models model databases database services service environment environments development programming practices practice applications application workflows workflow " +
  "solutions technologies technology stack modern basic using with and of in " +
  // The maker's name in a product's own name ("Apache Kafka", "Microsoft Power BI"); platform
  // prefixes (Azure, AWS, GCP) are left out so "Azure DevOps" isn't generic DevOps
  "apache microsoft amazon google oracle ibm the").split(" "));
function relationFor(table, term, strict = false) {
  const lower = term.toLowerCase();
  const keys = Object.keys(table).filter((key) => {
    if (lower === key) return true;
    if (!mentions(term, key)) return false;
    if (!strict) return true;
    const rest = lower.replace(new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), " ").split(/[\s/-]+/).filter(Boolean);
    return rest.every((word) => GENERIC_SUFFIX.has(word));
  });
  return keys.sort((a, b) => b.length - a.length)[0];
}

// Relations that are never credit, whatever a table or an agent says:
// knowing the related thing isn't having done the exact one
const NEVER = [
  [/\blangchain\b/i, /\bcomputer vision\b/i], [/\bprompt\b/i, /\bsection 508\b|\baccessibility\b/i], [/\bci\/cd\b|\bgithub actions\b/i, /\bazure devops\b/i],
  [/\bpython\b/i, /^java$/i], [/\bdocker\b/i, /\bkubernetes administration\b/i], [/^rag$|retrieval-augmented/i, /\bgraphrag\b/i],
  [/\bteam|cross-functional|releases?\b/i, /\bagile\b|\bscrum\b/i], [/\bcompliance\b|\brbac\b|\bsecurity\b/i, /\bfederal\b|\bfedramp\b|\bfisma\b/i],
  // One cloud doesn't prove another
  [/\b(aws|amazon)\b/i, /^(azure|gcp|google cloud|oci)\b/i], [/\bazure\b/i, /^(aws|amazon|gcp|google cloud|oci)\b/i],
  [/\b(gcp|google cloud)\b/i, /^(aws|amazon|azure|oci)\b/i], [/\boci\b|oracle cloud/i, /^(aws|amazon|azure|gcp|google cloud)\b/i]
];
const forbidden = (term, via) => Boolean(via) && NEVER.some(([from, to]) => from.test(via) && to.test(term) && !to.test(via));

// Every name of a term: itself, its aliases and its abbreviation or
// expansion. A context-sensitive short form ("CV") counts only where the
// text is about its field (computer vision, not a curriculum vitae).
const namesOf = (term) => [{ name: term }, ...aliasesOf(term).map((name) => ({ name })), ...synonymsOf(term)];
const names = (text, term) => namesOf(term).some(({ name, context }) => mentions(text, name) && (!context || context.test(text)));

// Which bullets name any of these terms (by any of their names)
const bulletsNaming = (terms, bullets) => bullets.filter((bullet) => terms.some((term) => names(bullet.text, term)));

// How clearly the resume shows it, separate from how well it matches
function confidenceOf(found, listed) {
  if (found.some((bullet) => bullet.source === "work" && DEPTH.test(bullet.text))) return "high";
  if (found.some((bullet) => bullet.source === "project" && (bullet.credibility?.value ?? 0) >= 0.9 && DEPTH.test(bullet.text))) return "high";
  if (found.some((bullet) => bullet.source !== "project" || (bullet.credibility?.value ?? 0) >= 0.6)) return "moderate";
  if (found.length) return "low";
  return listed ? "low" : "none";
}

// "role-based access controls" -> RBAC (three or more words, so short
// pairs don't collide with unrelated acronyms)
function acronymOf(term) {
  const words = term.split(/[\s-]+/).filter((word) => word && !MINOR.has(word.toLowerCase()));
  if (words.length < 3 || words.length > 6 || words.some((word) => !/^[A-Za-z]/.test(word))) return "";
  return words.map((word) => word[0].toUpperCase()).join("");
}

// Credit for a skill the candidate says they have but the resume doesn't
// show: below listed-and-demonstrated, and a reminder to put it on the resume
const CREDIT_CONFIRMED = [0.85, 0.75, 0.5];
function confirmedBy(term, depth, inference, result) {
  return {
    ...result("confirmed", inference?.found || [], {
      via: inference ? inference.signals.join(", ") : undefined,
      reason: `${term}: confirmed by you (self-reported), not shown on the resume (${Math.round(CREDIT_CONFIRMED[depth - 1] * 100)}%). Add it to the relevant bullet so employers and ATS see it.`
    }),
    score: CREDIT_CONFIRMED[depth - 1], confidence: "low", confirmedByCandidate: true
  };
}

// Which inference rule applies, and the bullets and signals that support it.
// Only bullets count (real, attributable work), never skills lists.
function inferenceFor(term, evidence) {
  const key = relationFor(INFERENCES, term);
  if (!key) return null;
  const rule = INFERENCES[key];
  const signals = [];
  const found = [];
  for (const [label, signal] of rule.signals) {
    const bullets = evidence.bullets.filter((bullet) => signal.test(bullet.text));
    if (!bullets.length) continue;
    signals.push(label);
    found.push(...bullets.filter((bullet) => !found.includes(bullet)));
  }
  const missingSignals = rule.signals.map(([label]) => label).filter((label) => !signals.includes(label));
  return signals.length >= (rule.min || 1) ? { rule, found, signals: [...new Set(signals)], missingSignals } : null;
}

// Is this a technology the engine knows (so "missing" is meaningful)?
const isKnown = (term) => Boolean(knownSkill(term)) || new RegExp(STANDARDS.source).test(term) || [EQUIVALENT, RELATED, PARTIAL, INFERENCES].some((table) => relationFor(table, term));

// Matches one term: { match, score, depth, confidence, evidence, via?, note?, reason? }
// wording and text: how the job asks for it, which sets the depth
function matchTerm(term, evidence, wording = "required", text = "") {
  const depth = depthOf(wording, `${text} ${term}`);
  const listedHit = (terms) => terms.some((each) => names(evidence.listed, each));
  const result = (match, found, extra = {}) => {
    const recency = recencyOf(found);
    const factor = (found.length ? Math.max(...found.map((bullet) => sourceFactor(bullet, depth))) : 1) * (recency?.stale ? 0.9 : 1);
    const score = Math.round(CREDIT[match][depth - 1] * factor * 100) / 100;
    const projectsOnly = found.length && found.every((bullet) => bullet.source === "project");
    const notes = [
      extra.note,
      projectsOnly ? `Shown in a project (${found[0].credibility?.tier || "project"}, as described by the candidate and not independently verified), not in work experience.` : "",
      recency?.stale ? `Last shown in ${recency.lastShown}, over ${Math.floor(STALE_MONTHS / 12)} years ago (90%).` : ""
    ].filter(Boolean);
    return {
      match, score, depth,
      proficiency: { asked: DEPTH_WORDS[depth - 1], shown: proficiencyShown(found, match) },
      source: evidenceSourceOf(found, match),
      ...(recency ? { recency } : {}),
      confidence: confidenceOf(found, match !== "missing"),
      evidence: found.slice(0, 3).map((bullet) => ({ text: bullet.text, where: bullet.where, source: bullet.source })),
      ...(extra.via ? { via: extra.via } : {}),
      ...(notes.length ? { note: notes.join(" ") } : {}),
      ...(score < 1 ? { reason: extra.reason || reasonFor(match, term, extra.via, depth, score) } : {})
    };
  };

  // "Azure or AWS (beyond just Bedrock)": the excluded thing doesn't count
  // as the term ("AWS Bedrock" isn't AWS beyond Bedrock). Bullets are read
  // without it; evidence still cites the original bullet.
  const beyond = (text.match(/\(\s*(?:beyond|other than|not just|excluding|in addition to)\s+(?:just\s+|only\s+)?([^)]+?)\s*\)/i) || [])[1];
  const pool = beyond
    ? evidence.bullets.map((bullet) => ({ ...bullet, text: bullet.text.replace(new RegExp(`\\b(?:(?:${escapeRegex(term)}|amazon|aws|azure|google)\\s+)?${escapeRegex(beyond)}\\b`, "gi"), "") }))
    : evidence.bullets;
  const original = (found) => found.map((bullet) => evidence.bullets.find((entry) => entry.where === bullet.where) || bullet);
  const excludedTool = (tool) => Boolean(beyond) && (mentions(tool, beyond) || mentions(beyond, tool));

  // Direct: the term itself in a bullet, or its acronym ("role-based access
  // controls" written as RBAC)
  const direct = original(bulletsNaming([term], pool));
  if (direct.length) return result("direct", direct);
  // The candidate's own answer about an inferred or unconfirmed skill
  const answer = evidence.confirmations?.get(term.toLowerCase());
  const acronym = acronymOf(term);
  const abbreviated = acronym ? evidence.bullets.filter((bullet) => new RegExp(`\\b${acronym}s?\\b`).test(bullet.text)) : [];
  if (abbreviated.length) return { ...result("direct", abbreviated), note: `Written as ${acronym}.` };

  // An achievement (publications, open-source work) is on the resume or it
  // isn't; a modifier ("ML" in "open-source ML projects") earns nothing
  const concept = conceptFor(term);
  if (concept && CONCEPTS[concept].whole) {
    const line = evidence.all.split("\n").find((text) => CONCEPTS[concept].shows.test(text));
    // Public projects on GitHub show public work, not a contribution to
    // another project: partial, and said so. A project with no public code
    // profile doesn't count at all.
    if (!line && concept === "open-source contributions" && evidence.publicCode && evidence.projects?.length) {
      return {
        ...result("partial", [], { reason: `No contribution to an existing open-source project is shown. You have a public code profile and ${evidence.projects.length === 1 ? "a project" : "projects"} (${evidence.projects.slice(0, 2).join(", ")}): public work, not an open-source contribution (${Math.round(CREDIT.partial[depth - 1] * 100)}%).` }),
        achievement: true, confidence: "low",
        evidence: [{ text: evidence.publicCodeUrl, where: "Contact line", source: "listed" }, { text: evidence.projects[0], where: "Projects", source: "project" }],
        note: "A public personal project isn't a contribution to someone else's open-source project; if you've had pull requests merged into one, name the project."
      };
    }
    if (!line) return { ...result("missing", []), achievement: true, reason: `No ${concept} on the resume.` };
    return { ...result("direct", []), achievement: true, confidence: "moderate", evidence: [lineAt(evidence, line)] };
  }

  // The same skill in other words: a concept's concrete wording, or the
  // term's own words in another form and order ("Engineered features")
  const reworded = concept ? bulletsShowingConcept(concept, evidence.bullets) : [];
  const shown = reworded.length ? reworded : bulletsRewording(term, evidence.bullets);
  if (shown.length) {
    const phrase = concept ? (shown[0].text.match(CONCEPTS[concept].shows) || [])[0] : "";
    return { ...result("direct", shown), shownAs: phrase || "the same words in another form", note: `Shown in other words${phrase ? `: "${phrase}"` : ""}.` };
  }

  // An occupation held as a job title ("software engineering" <- "Software Engineer")
  const titled = (evidence.titles || []).filter((title) => mentions(title.text, term) || bulletsRewording(term, [title]).length || (term.split(/\s+/).length === 2 && rootOf(term.split(/\s+/)[0]) === rootOf((title.text.match(/[A-Za-z]+/g) || [])[0] || "") && rootOf(term.split(/\s+/)[1]).slice(0, 5) === rootOf((title.text.match(/[A-Za-z]+/g) || [])[1] || "").slice(0, 5)));
  if (titled.length) return { ...result("direct", titled), note: `Held as a job title: ${titled[0].text}.` };

  // Equivalent technology in a bullet (PySpark for Spark). "GitHub Actions"
  // is a CI service, not GitHub repository work: it supports an inference
  // about Git, not an equivalence
  const equivalentKey = relationFor(EQUIVALENT, term, true);
  if (equivalentKey) {
    for (const tool of EQUIVALENT[equivalentKey]) {
      if (forbidden(term, tool) || excludedTool(tool)) continue;
      const found = bulletsNaming([tool], pool.map((bullet) => (/^github$/i.test(tool) ? { ...bullet, text: bullet.text.replace(/github actions/gi, "") } : bullet)))
        .map((bullet) => evidence.bullets.find((original) => original.where === bullet.where) || bullet);
      if (found.length) return result("equivalent", found, { via: tool });
    }
  }

  // A license or certification in its own section is the evidence for it.
  // Only for credentials (RN, PMP, "AWS Certified ..."): a certificate that
  // names a tool ("AWS Generative AI and AI Agents") lists it, it doesn't show work
  const isCredential = /\b(certifi\w*|licen[cs]\w*|registered)\b/i.test(term) || (/^[A-Z]{2,6}$/.test(term) && !knownSkill(term));
  const credential = isCredential && [term, ...aliasesOf(term)].some((name) => mentions(evidence.credentials, name));
  if (credential) {
    const line = [term, ...aliasesOf(term)].map((name) => evidence.lines.find((entry) => mentions(entry.text, name))).find(Boolean);
    return { ...result("direct", []), confidence: "moderate", evidence: [{ text: line ? line.text : term, where: line ? line.section : "Certifications & licenses", source: "credential" }] };
  }

  // Strongly related technology in a bullet: credited with its consideration
  const relatedKey = relationFor(RELATED, term, true);
  if (relatedKey) {
    for (const tool of RELATED[relatedKey].tools) {
      if (forbidden(term, tool)) continue;
      const found = bulletsNaming([tool], evidence.bullets);
      if (found.length) return result("related", found, { via: tool, note: RELATED[relatedKey].note });
    }
  }

  // Contextually inferred from real work (Git from CI/CD pipelines)
  const inference = answer === "no" ? null : inferenceFor(term, evidence);
  if (answer === "yes") return confirmedBy(term, depth, inference, result);
  if (inference) {
    // Listed by name or by an equivalent ("version control" with Git in the skills)
    const listed = listedHit([term]) || Boolean(equivalentKey && listedHit(EQUIVALENT[equivalentKey]));
    const { rule, found, signals, missingSignals } = inference;
    // A practice shown through enough of its parts in real work is demonstrated, by another name
    if (rule.demonstratedAt && signals.length >= rule.demonstratedAt) {
      return {
        ...result("equivalent", found, {
          via: signals.join(", "),
          reason: `${term} is shown through its parts in your work: ${signals.join(", ")}${missingSignals.length ? `; not shown: ${missingSignals.join(", ")}` : ""} (${Math.round(CREDIT.equivalent[depth - 1] * 100)}%).`
        }),
        components: { shown: signals, notShown: missingSignals },
        note: `Demonstrated through its components (${signals.length} of ${rule.signals.length}), not named as ${term} in a bullet.${listed ? ` ${term} is also listed.` : ""}`
      };
    }
    const match = rule.confirmOnly || depth === 3 ? "confirm" : "inferred";
    // A practice made of parts (MLOps): each part is checked, and credit
    // follows how many are actually shown (never full, never above 85%)
    const componentCredit = rule.components && match === "inferred" ? Math.min(0.85, 0.95 * signals.length / rule.signals.length) : 0;
    const inferred = {
      ...result(match, found, {
        via: signals.join(", "),
        note: `${match === "confirm" ? "Plausible" : "Strongly inferred"}: the work shown (${signals.join(", ")}) normally involves ${rule.implies}. ${rule.caveat}${listed ? ` ${term} is also listed.` : ""}`,
        reason: match === "confirm"
          ? `${term} isn't established${depth === 3 ? " at the depth the job asks" : ""}; ${signals.join(", ")} make it plausible. Needs confirmation.`
          : `Inferred, not verified: ${signals.join(", ")} suggest ${rule.implies} (${Math.round(CREDIT.inferred[depth - 1] * 100)}% for ${DEPTH_WORDS[depth - 1]}).`
      }),
      confidence: "low", inferred: true, confirm: rule.confirm, question: rule.question,
      ...(rule.components ? { components: { shown: signals, notShown: missingSignals } } : {})
    };
    if (componentCredit > inferred.score) {
      inferred.score = Math.round(componentCredit * 100) / 100;
      inferred.reason = `Parts of ${term} shown: ${signals.join(", ")}; not shown: ${missingSignals.join(", ") || "none"} (${Math.round(inferred.score * 100)}%).`;
    }
    // Listed and inferred: two independent signs of the same skill support
    // each other, but neither is a bullet showing it, so it stays inferred and
    // below an equivalent (at most 90%)
    const listedScore = listed ? CREDIT.listed[depth - 1] : 0;
    if (listedScore && match === "inferred" && inferred.score > 0) {
      const combined = Math.min(0.9, 1 - (1 - inferred.score) * (1 - listedScore));
      return {
        ...inferred, score: Math.round(combined * 100) / 100, corroborated: true,
        reason: `${term} is listed and implied by your work (${signals.join(", ")}), but no bullet shows it directly (${Math.round(combined * 100)}%; inferred, not verified).`
      };
    }
    if (listedScore > inferred.score) return { ...inferred, match: "listed", score: listedScore, source: SOURCE_LABELS.listed, proficiency: { ...inferred.proficiency, shown: "listed only" } };
    return inferred;
  }

  // Listed (skills, summary, education) or spelled out, but in no bullet
  if (listedHit([term]) || (/^[A-Z]{2,6}$/.test(term) && evidence.initials.has(term))) {
    return { ...result("listed", []), mentions: (evidence.all.match(new RegExp(`\\b${escapeRegex(term)}\\b`, "gi")) || []).length, evidence: [lineNaming(evidence, term) || { text: term, where: "Skills, summary or education", source: "listed" }] };
  }

  // Related, but doesn't establish the skill (Docker for Kubernetes)
  const partialKey = relationFor(PARTIAL, term);
  if (partialKey) {
    for (const tool of PARTIAL[partialKey].tools) {
      const found = bulletsNaming([tool], evidence.bullets);
      if (!found.length) continue;
      // Same area, no shared capability (LangGraph for persistent memory): noted, not credited
      if (PARTIAL[partialKey].noCredit) {
        return { ...result("missing", found, { via: tool, note: PARTIAL[partialKey].note, reason: `${tool} doesn't demonstrate ${term}. ${PARTIAL[partialKey].note}` }), score: 0 };
      }
      return result("partial", found, { via: tool, note: PARTIAL[partialKey].note });
    }
  }

  if (equivalentKey && listedHit(EQUIVALENT[equivalentKey])) {
    const via = EQUIVALENT[equivalentKey].find((tool) => listedHit([tool]));
    return { ...result("listed", [], { via }), evidence: [lineNaming(evidence, via) || { text: via, where: "Skills list (an equivalent)", source: "listed" }] };
  }

  // The Equivalence agent's suggestion for an unfamiliar term. Credited only
  // when code can support it from the bullet: equivalent or subskill at the
  // related anchor, related at the partial anchor. Unsupported claims are
  // kept for review with no credit.
  const suggested = evidence.semantic?.get(term.toLowerCase());
  if (suggested && forbidden(term, suggested.tool)) {
    return { ...result("missing", []), needsReview: true, reason: `${suggested.tool} never demonstrates ${term}; the Equivalence agent's suggestion was rejected.` };
  }
  if (suggested) {
    const found = evidence.bullets.filter((bullet) => bullet === suggested.bullet);
    const agentNote = suggested.relationship ? ` Agent: ${suggested.relationship}` : "";
    if (!suggested.supported) {
      return {
        ...result("uncertain", found, { via: suggested.tool, reason: `The Equivalence agent linked ${term} to ${suggested.tool}, but the cited bullet doesn't show ${term} itself, so it isn't credited. Review it.` }),
        score: 0, uncertain: true, needsReview: true, agentRelation: suggested.relation,
        note: `Agent suggestion (${suggested.relation}), not credited: no support for ${term} in the cited bullet.${agentNote}`
      };
    }
    const match = suggested.relation === "related" ? "partial" : "related";
    return {
      ...result(match, found, {
        via: suggested.tool,
        note: `Relation suggested by the Equivalence agent (${suggested.relation}); the cited bullet names ${suggested.tool} and says something of ${term}, but it needs review.${agentNote}`,
        reason: `AI-judged ${suggested.relation} relation: the resume shows ${suggested.tool} for ${term}. Needs review.`
      }),
      needsReview: true, agentRelation: suggested.relation
    };
  }

  const missing = result("missing", []);
  if (isKnown(term)) return missing;
  // An unfamiliar term: a bullet about the same work may be evidence the
  // engine can't interpret (Uncertain), or there's nothing (Not demonstrated)
  // Only the unknown word(s) leave the context ("Zorblax" in "Zorblax stream processing")
  const unknownTokens = term.split(/\s+/).filter((token) => /^[A-Z]/.test(token) && !knownSkill(token));
  const removed = wordsOf(unknownTokens.length ? unknownTokens.join(" ") : term);
  const context = text ? new Set([...wordsOf(text)].filter((word) => !removed.has(word) && !NOT_CONTEXT.has(word))) : new Set();
  const candidate = context.size ? bestBullet([...context].join(" "), evidence.bullets) : { score: 0 };
  if (candidate.bullet && candidate.score >= 0.34) {
    return {
      ...result("uncertain", [candidate.bullet], { reason: `The engine doesn't know ${term}; this bullet may be relevant, but that can't be established. Review it manually.` }),
      score: 0, uncertain: true
    };
  }
  return { ...missing, unfamiliar: true, note: "Not a technology the engine knows, so it was matched by exact name only; no possibly related bullet was found." };
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Why a requirement got less than full credit
function reasonFor(match, term, via, depth, score) {
  const asked = DEPTH_WORDS[depth - 1];
  const pct = `${Math.round(score * 100)}%`;
  switch (match) {
    case "equivalent": return `${via} is equivalent to ${term} (${pct}).`;
    case "related": return `${via} is strongly related to ${term} but isn't ${term} itself (${pct}${depth === 3 ? `; the job asks for ${asked}` : ""}).`;
    case "partial": return depth === 1
      ? `${via} shares some capabilities with ${term} (${pct}); the job asks only for familiarity.`
      : `${via} is in the same area but doesn't demonstrate ${term}; the job asks for ${asked} (${pct}).`;
    case "listed": return `${term} is listed but not demonstrated in any work; the job asks for ${asked} (${pct}).`;
    case "missing": return `${term} isn't demonstrated on the resume.`;
    default: return score < 1 ? `Evidence is from a project or internship, which counts less for ${asked} (${pct}).` : "";
  }
}

// ---- Requirements from the job ----

// How deep the job's wording expects a requirement to be
function wordingOf(text) {
  // "Preferred but not mandatory" isn't a must
  if (/\bnot (?:required|mandatory|necessary|essential)\b/i.test(text)) return "preferred";
  if (/\b(must[- ]have|must\b|mandatory|non[- ]negotiable|essential)\b/i.test(text)) return "mandatory";
  if (/\b(familiar\w*|exposure|awareness|basic understanding)\b/i.test(text)) return "familiarity";
  if (/\bworking knowledge\b/i.test(text)) return "working";
  if (/\b(proficien\w*|expert\w*|advanced|deep|strong|extensive)\b/i.test(text)) return "proficient";
  if (/\b(experience (with|in|using)|hands-on)\b/i.test(text)) return "experience";
  if (PREFERRED.test(text)) return "preferred";
  return "required";
}
const WORDING_WEIGHT = { mandatory: 1.5, proficient: 1.1, required: 1, experience: 1, working: 0.8, familiarity: 0.6, preferred: 1 };
const WORDING_LABEL = {
  mandatory: "Must have", proficient: "Proficient", required: "Required", experience: "Hands-on experience",
  working: "Working knowledge", familiarity: "Familiarity", preferred: "Preferred"
};

// Technology-shaped names a dictionary may not know: letters with digits
// (OAuth2, EC2, S3) or inner capitals (GraphQL, PostgreSQL). They're what the
// requirement is about, so they're terms, never just context.
const TECH_TOKEN = /\b(?:[A-Za-z]+\d+[A-Za-z0-9]*|[A-Z][a-z]+[A-Z][A-Za-z0-9]*)\b/g;

// Too broad to count as a matched skill, or to make two lines the same requirement
const BROAD_TERMS = new Set(["ai", "ml", "ai/ml", "it", "data", "cloud", "apis", "api", "software"]);

// The concept a term names ("model optimization" -> performance optimization)
const conceptFor = (term) => Object.keys(CONCEPTS).find((key) => key === term.toLowerCase() || CONCEPTS[key].asks.test(term));
// One id per requirement, whatever it's called (Copilot = GitHub Copilot)
// and one id for an abbreviation and its expansion (LLM = Large Language Model)
const canonicalOf = (term) => {
  const lower = term.toLowerCase().replace(/\s+/g, " ").trim();
  if (CANONICAL[lower]) return abbreviationId(CANONICAL[lower]) || CANONICAL[lower];
  return conceptFor(lower) || abbreviationId(lower) || lower;
};

// The terms a requirement line asks for. A longer phrase the tables know
// ("ML libraries", "generative AI platforms") replaces the shorter term inside it.
function termsOf(text) {
  const conceptPhrases = Object.values(CONCEPTS).map((concept) => (text.match(concept.asks) || [])[0]).filter(Boolean);
  const found = [...conceptPhrases, ...dictionaryKeywords(text), ...(text.match(TECH_TOKEN) || []), ...phrasesFrom([text])];
  const known = (term) => conceptFor(term) || [EQUIVALENT, RELATED, PARTIAL].some((table) => table[term.toLowerCase()]);
  const preferred = found.map((term) => found.find((other) => other.length > term.length && mentions(other, term) && known(other)) || term);
  return uniqueTerms(preferred).slice(0, 8);
}

// Words reduced to a shared root: "Engineered features" and "feature
// engineering", "managed the model lifecycle" and "model lifecycle management"
const rootOf = (word) => word.toLowerCase()
  .replace(/(?:i[sz]ations?|i[sz]ing|i[sz]ed|i[sz]es|i[sz]e)$/, "iz")
  .replace(/(?:ations?|ating|ated|ates|ate)$/, "at")
  .replace(/(?:ments?|ings?|ed|es|s)$/, "")
  .replace(/e$/, "")
  .replace(/(.)\1$/, "$1");
const ROOT_SKIP = new Set(["of", "the", "and", "a", "an", "to", "with", "for", "in", "on"]);

// Bullets that say a multi-word skill in other word forms or order: every
// content word's root within six words of each other
function bulletsRewording(term, bullets) {
  const roots = term.toLowerCase().split(/[\s/-]+/).filter((word) => word.length > 2 && !ROOT_SKIP.has(word)).map(rootOf);
  if (roots.length < 2 || roots.length > 4) return [];
  return bullets.filter((bullet) => {
    const tokens = (bullet.text.toLowerCase().match(/[a-z][a-z0-9+#]*/g) || []).map(rootOf);
    return tokens.some((token, start) => token === roots[0] || roots.includes(token)
      ? roots.every((root) => tokens.slice(Math.max(0, start - 6), start + 7).includes(root))
      : false);
  });
}

// Bullets that demonstrate a concept (see CONCEPTS)
const bulletsShowingConcept = (key, bullets) => {
  const concept = CONCEPTS[key];
  return bullets.filter((bullet) => concept.shows.test(bullet.text) && (!concept.with || concept.with.test(bullet.text)));
};

// Words that say how much, not what: left out of a requirement's context
const NOT_CONTEXT = new Set(("experience experienced proficiency proficient knowledge familiarity familiar working strong solid hands-on hands " +
  "based using use with development developing develop skills skill ability understanding background expertise expert level advanced " +
  "years year plus preferred required must have including etc demonstrated proven good excellent deep " +
  "active current valid license licensed licensure certification certifications certified registered minimum related field " +
  "similar concepts concept methods method environment environments task tasks modern basic other technologies technology tool tools " +
  "platform platforms application applications junior senior assisting relevant " +
  // Operators ("at least one of") and categories the matched tools already imply
  // ("AWS" is a cloud platform; "Python" a programming language)
  "least one two three four any all both either each every cloud language languages programming scripting framework frameworks deep learning " +
  // Comfort and everyday wording, example markers, and what a language or tool already implies
  // ("written code in Python", "comfortable with everyday developer tools like Git")
  "comfortable confident everyday daily like such well written write writing code coding developer developers plus " +
  // How much is asked, not what: "hands-on exposure to"
  "exposure exposed").split(" ").map((word) => stem(word)));

// What a requirement asks beyond its tools: "Python-based API integration"
// -> { api, integration }. Used to tell distinct capabilities apart.
// Another name for one of the terms ("Basic Git / version control") is the
// same ask, not context
function contextOf(text, terms) {
  const ids = new Set(terms.map((term) => canonicalOf(term)));
  const otherNames = [...Object.keys(EQUIVALENT), ...Object.keys(INFERENCES), ...Object.keys(CANONICAL)]
    .filter((name) => mentions(text, name) && (ids.has(canonicalOf(name)) || (EQUIVALENT[name] || []).some((tool) => terms.some((term) => sameTerm(tool, term)))));
  const termWords = new Set([...terms, ...otherNames].flatMap((term) => [...wordsOf(term)]));
  // Examples ("e.g., Claude, OpenAI, or similar") are alternatives to the
  // tools, not more to show: one shown example already covers them
  const examples = new Set([...text.matchAll(new RegExp(EXAMPLES.source, "gi"))].flatMap((found) => [...wordsOf(found[0])]));
  return new Set([...wordsOf(text)].filter((word) => !termWords.has(word) && !NOT_CONTEXT.has(word) && !examples.has(word)));
}

// A requirement's identity: its tools, what it asks of them, and how deep.
// Two requirements are the same only if all three match.
const capabilityKey = (term, context, depth) => `${term.toLowerCase()}|${[...context].sort().join(" ")}|${depth}`;
const sameContext = (a, b) => {
  if (!a.size && !b.size) return true;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(a.size, b.size) >= 0.8;
};

// Teamwork, judged by what the bullets describe (working with engineers,
// clients, stakeholders, cross-functional teams), not by the word "collaborate"
// People must be on the other side: "agents collaborate over A2A" isn't teamwork
const TEAMWORK = /\b(?:collaborat\w*|partner(?:ed|ing)?|work(?:ed|ing)?(?: closely)?|coordinat\w*|liais\w*|align\w*) with (?:[\w-]+ ){0,3}?(?:teams?|engineers|analysts|(?:data )?scientists|stakeholders|clients|customers|business users|users|managers|leaders|partners|designers|product owners)\b|\bcross-functional\b|\bstakeholders?\b|\bclient-facing\b|\bmentor(?:ed|ing)? (?:\d+ )?(?:junior|new|engineers|analysts|interns|developers)\b|\bled (?:a )?team\b|\bteam of \d+\b/i;
const TEAMWORK_WORDS = /^(collaborat|partner|communicat|coordinat|stakeholder|teamwork|cross|liais)/;
function teamworkPart(evidence) {
  const answer = evidence.confirmations?.get("team collaboration");
  const found = answer === "no" ? [] : evidence.bullets.filter((bullet) => TEAMWORK.test(bullet.text));
  const base = { capability: "Team collaboration", confirmKey: "team collaboration" };
  if (found.length) {
    const phrase = (found[0].text.match(TEAMWORK) || [])[0];
    return { ...base, match: "direct", score: Math.round(sourceFactor(found[0], 2) * 100) / 100, confidence: found.length > 1 ? "high" : "moderate", evidence: found.slice(0, 2).map((bullet) => ({ text: bullet.text, where: bullet.where, source: bullet.source })), note: `Teamwork described: "${phrase}".` };
  }
  if (answer === "yes") return { ...base, match: "confirmed", score: 0.75, confidence: "low", evidence: [], confirmedByCandidate: true, reason: "Team collaboration: confirmed by you (self-reported), not described on the resume. Say who you worked with in a bullet." };
  if (answer === "no") return { ...base, match: "missing", score: 0, confidence: "none", evidence: [], reason: "You said this isn't part of your experience." };
  return { ...base, match: "confirm", score: 0, confidence: "none", evidence: [], reason: "No explicit collaboration with engineers, clients or stakeholders is described. Review whether your project work involved them." };
}

// A qualification line: its terms matched one by one (plus, when it asks
// for something specific, how well the bullets show that), or (no terms) the
// best bullet sharing its words. claimed: capabilities already scored in
// another requirement; identical ones aren't counted twice.
function scoreQualification(text, evidence, category, claimed = new Map()) {
  const unverified = unverifiedPractice(text, category, evidence);
  if (unverified) return unverified;
  const wording = category === "preferred" ? (wordingOf(text) === "familiarity" ? "familiarity" : "preferred") : wordingOf(text);
  const asked = requirementText(text);
  // "AI" or "IT" alone isn't a skill to match: such a line is judged by its wording
  const all = termsOf(asked).filter((term) => !BROAD_TERMS.has(term.toLowerCase()));
  // Achievements (publications, open source) are judged as a whole, without a context check
  // Hands-on verbs ("building", "deploying") are implied by the tool in a work
  // bullet; what's asked beyond the tools is the rest ("integration", "security")
  const context = all.some((term) => CONCEPTS[conceptFor(term)]?.whole) ? new Set() : new Set([...contextOf(asked, all)].filter((word) => !ACTION_VERBS.has(word)));
  const depth = depthOf(wording, text);
  const isClaimed = (term) => [...claimed.values()].some((other) => other.term === term.toLowerCase() && other.depth === depth && sameContext(other.context, context));
  // "Contributions to open-source ML projects": the achievement is the
  // requirement; "ML" only describes it
  const achievement = all.filter((term) => CONCEPTS[conceptFor(term)]?.whole);
  const terms = (achievement.length ? achievement : all).filter((term) => !isClaimed(term));
  // The same capability already scored elsewhere: shown, but not counted again
  if (all.length && !terms.length) {
    return { text, category, wording, kind: "qualification", duplicate: true, match: "direct", score: 0, confidence: "none", evidence: [], reason: `The same requirement is already counted elsewhere (${all.join(", ")}).` };
  }
  terms.forEach((term) => claimed.set(capabilityKey(term, context, depth), { term: term.toLowerCase(), context, depth }));

  if (terms.length) {
    const parts = terms.map((term) => ({ term, ...matchTerm(term, evidence, wording, text) }));
    // "Written code in at least one language (Python is a plus)": any language
    // shown meets the ask; the named one is only a preference
    if (ANY_LANGUAGE.test(asked)) {
      for (const part of parts.filter((entry) => LANGUAGE.test(entry.term) && entry.score < 0.95)) {
        const other = LANGUAGE_NAMES.map((name) => ({ name, ...matchTerm(name, evidence, wording, text) })).filter((entry) => entry.name.toLowerCase() !== part.term.toLowerCase()).sort((a, b) => b.score - a.score)[0];
        if (!other || other.score <= part.score) continue;
        Object.assign(part, { ...other, term: part.term, via: other.name, anyLanguage: true, reason: `The job asks for at least one language; ${other.name} is shown (${pct(other.score)}). ${part.term} is only a plus.` });
        delete part.name;
      }
    }
    const reasons0 = [];
    // "Azure or AWS": the best alternative counts; "Python, Java": each one does
    const { score: termScore, groups, ambiguity } = combineTerms(asked, parts, evidence.job);
    if (ambiguity) {
      const [any, all] = ambiguity.interpretations;
      reasons0.push(`The job lists ${ambiguity.terms.join(", ")} without "and" or "or". Read with the rest of the job, it ${ambiguity.likely === "any" ? "most likely means any one" : ambiguity.likely === "all" ? "most likely means all of them" : "could mean either"} (any one ${Math.round(any.confidence * 100)}%, all ${Math.round(all.confidence * 100)}%${ambiguity.reasons.length ? `: ${ambiguity.reasons.join("; ")}` : ""}). ${Math.round(ambiguity.asAny * 100)}% if any one is needed, ${Math.round(ambiguity.asAll * 100)}% if all are; scored ${Math.round(ambiguity.score * 100)}%, weighing both readings.`);
    }
    const alternatives = groups.filter((group) => group.mode === "any" && group.terms.length > 1);
    // An alternative that wasn't needed isn't a gap
    // An alternative that wasn't needed isn't a gap; one tied with the chosen one counts the same
    for (const part of parts) part.alternative = alternatives.some((group) => group.terms.includes(part.term) && !group.chosen.includes(part.term) && group.score > 0 && part.score < group.score);
    // "collaborating in Agile environments and using DevOps tools": teamwork is
    // its own capability, judged from what the bullets describe
    const teamwork = [...context].some((word) => TEAMWORK_WORDS.test(word)) ? teamworkPart(evidence) : null;
    if (teamwork) for (const word of [...context]) if (TEAMWORK_WORDS.test(word)) context.delete(word);
    const capabilityParts = teamwork ? [teamwork] : [];
    // Each capability counts on its own: missing Agile doesn't erase DevOps credit.
    // Fit leaves out parts that only need confirmation; the evidence score counts them as 0
    const units = [...groups.map((group) => ({ score: group.score, confirmOnly: group.confirmOnly })), ...capabilityParts.map((part) => ({ score: part.score, confirmOnly: part.match === "confirm" }))];
    const unitScore = units.reduce((sum, unit) => sum + unit.score, 0) / units.length;
    const assessable = units.filter((unit) => !unit.confirmOnly);
    const unitFit = assessable.length ? assessable.reduce((sum, unit) => sum + unit.score, 0) / assessable.length : null;
    // "Python-based API integration": the bullets must also show the API integration
    let contextResult = null;
    if (context.size) {
      // Bullets, plus the certifications, skills and education sections
      const { score: overlap, bullet } = bestBullet([...context].join(" "), [...evidence.bullets, { text: evidence.listed, where: "Skills, education or certifications", source: "listed", words: wordsOf(evidence.listed) }]);
      const value = overlap >= 0.5 ? 1 : overlap >= 0.25 ? 0.5 : 0;
      contextResult = { value, bullet: bullet?.text === evidence.listed ? lineSharing(evidence, [...context].join(" ")) : bullet };
    }
    const blend = (value) => (contextResult ? value * 0.6 + contextResult.value * 0.4 * (value > 0 ? 1 : 0) : value);
    const score = blend(capabilityParts.length ? unitScore : termScore);
    const fitScore = unitFit === null ? null : blend(unitFit);
    const order = ["direct", "equivalent", "related", "inferred", "confirmed", "partial", "listed", "confirm", "uncertain", "missing"];
    // The weakest needed term sets the type; some shown and some not is partial
    const weakest = parts.filter((part) => !part.alternative && !part.alternativeLikely).map((part) => part.match).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
    const lineMatch = score === 0
      ? (parts.every((part) => part.match === "uncertain") ? "uncertain" : [...parts, ...capabilityParts].every((part) => part.match === "confirm") ? "confirm" : "missing")
      : ["missing", "uncertain", "confirm"].includes(weakest) ? "partial" : weakest;
    const reasons = [...parts.filter((part) => !part.alternative && !part.alternativeLikely).map((part) => part.reason).filter(Boolean), ...reasons0];
    for (const group of alternatives) {
      const needed = group.operator?.startsWith("at least") ? `${group.operator.replace(" of", "")} of` : "Any one of";
      reasons.push(`${needed} ${group.terms.join(" / ")} satisfies this (${group.operator})${group.flexible ? ", or a tool that does the same job" : ""}; ${group.score > 0 ? `${group.chosen.join(" and ")} counted` : "none is demonstrated"}.`);
    }
    if (contextResult && contextResult.value < 1) {
      reasons.push(`What it asks beyond the tools (${[...context].join(", ")}) is ${contextResult.value ? "only partly" : "not"} demonstrated.`);
    }
    return {
      text, category, wording, kind: "qualification", match: lineMatch, score: Math.round(score * 100) / 100,
      confidence: confidenceRank(parts.map((part) => part.confidence)), terms: parts,
      fitScore: fitScore === null ? null : Math.round(fitScore * 100) / 100,
      ...(capabilityParts.length ? { capabilities: capabilityParts } : {}),
      ...(alternatives.length ? { logic: groups.map(({ mode, operator, terms: names, chosen, best, flexible, score: groupScore }) => ({ mode, operator, terms: names, chosen, best, flexible, score: Math.round(groupScore * 100) / 100 })) } : {}),
      ...(ambiguity ? { ambiguity } : {}),
      ...(contextResult ? { capability: { asks: [...context], score: contextResult.value, evidence: contextResult.bullet && contextResult.value ? { text: contextResult.bullet.text, where: contextResult.bullet.where } : null } } : {}),
      ...(reasons.length ? { reason: [...new Set(reasons)].join(" ") } : {}),
      ...(parts.some((part) => part.uncertain) ? { uncertain: true } : {})
    };
  }
  const { score, bullet: best } = bestBullet(text, [...evidence.bullets, { text: evidence.listed, where: "Skills, summary or education", source: "listed", words: wordsOf(evidence.listed) }]);
  const bullet = best?.text === evidence.listed ? lineSharing(evidence, text) : best;
  const value = score >= 0.6 ? 1 : score >= 0.3 ? 0.5 : 0;
  return {
    text, category, wording, kind: "qualification",
    match: value === 1 ? "direct" : value ? "partial" : "missing", score: value,
    confidence: value ? (bullet?.source === "work" ? "moderate" : "low") : "none",
    evidence: value && bullet ? [{ text: bullet.text, where: bullet.where, source: bullet.source }] : [],
    ...(value < 1 ? { reason: value ? "Only some of this requirement's wording is demonstrated in one bullet." : "Not demonstrated on the resume." } : {})
  };
}

// How a requirement's terms combine:
//   "Python, JavaScript, Java"                 all of them
//   "Azure or AWS", "NLP, CV, or GenAI"        any one (the best one counts)
//   "DevOps tools (e.g., Azure DevOps, GitHub)" the examples stand in for
//   "LLM engineering such as RAG or agents"     their head term: any one
//   "MLOps, including CI/CD and versioning"    the listed parts: all of them
// Returns { score, groups: [{ mode, terms, best }] }
// Inside "(e.g., ...)" the examples end at the bracket; after "such as" they
// run to the end of the sentence, brackets included ("generation (RAG), or agents")
const EXAMPLES = /\(\s*(?:e\.g\.,?|for example|such as)\s+[^)]*|\((?=[^)]*\bor similar\b)[^)]*|\b(?:such as|e\.g\.,?|for example|for instance|like)\s+[^.;]*/i;
// Explicit wording beats punctuation: "all of", "both" -> every one;
// "at least one of", "any of", "either" -> one; "at least two of" -> the best two
const ALL_OF = /\b(?:all of|both|each of|every one of)\b/i;
const ANY_OF = /\b(?:at least one of|one or more of|any (?:one )?of|either)\b/i;
const AT_LEAST = /\bat least (two|three|four|2|3|4) of\b/i;
const NUMBER = { two: 2, three: 3, four: 4, 2: 2, 3: 3, 4: 4 };
// "or similar", "or equivalent": tools that do the same job are accepted
const OPEN_ENDED = /\bor (?:similar|equivalent|comparable)\b|\bsimilar (?:tools|technologies|platforms|frameworks)\b/i;

// Returns { score, groups, ambiguity }. Each group: { mode: any|all, operator,
// terms, chosen (what counted), best, score, flexible (equivalents accepted) }
function combineTerms(text, parts, job = null) {
  if (!parts.length) return { score: 0, groups: [] };
  const lower = text.toLowerCase();
  const positionOf = (term) => {
    const name = term.toLowerCase();
    // "LLMs" asked as "LLM engineering"
    for (const form of [name, name.replace(/s$/, ""), name.split(/\s+/)[0]]) {
      const index = lower.indexOf(form);
      if (index >= 0) return index;
    }
    return -1;
  };
  const placed = parts.map((part) => ({ part, at: positionOf(part.term) })).sort((a, b) => a.at - b.at);
  const groups = [];
  let ambiguity = null;
  let rest = placed;
  const openEnded = OPEN_ENDED.test(text);
  const examples = text.match(EXAMPLES);
  if (examples) {
    const start = examples.index;
    const end = start + examples[0].length;
    const inside = placed.filter((item) => item.at >= start && item.at <= end);
    // The head is the term the examples illustrate, right before "such as"/"like"
    // ("DevOps tools (e.g., ...)"); a term in an earlier clause isn't
    // ("Python is a plus) and ... developer tools like Git" has no head term)
    const before = placed.filter((item) => item.at >= 0 && item.at < start).pop();
    const gap = before ? lower.slice(before.at + before.part.term.length, start) : "";
    const head = before && gap.trim().split(/\s+/).filter(Boolean).length <= 4 && !/[,;()]|\band\b/.test(gap) ? before : null;
    if (inside.length) {
      groups.push({ mode: "any", operator: openEnded ? "examples, or similar" : "examples", flexible: true, parts: [...(head ? [head.part] : []), ...inside.map((item) => item.part)] });
      rest = placed.filter((item) => item !== head && !inside.includes(item));
    }
  }
  if (rest.length > 1) {
    const last = rest[rest.length - 1];
    const between = lower.slice(rest[0].at, last.at);
    const before = lower.slice(Math.max(0, rest[0].at - 30), rest[0].at);
    const restParts = rest.map((item) => item.part);
    // "..., data science, or a related discipline": a trailing "or" catch-all makes the list alternatives
    const trailingOr = /^[^,.;]*?,?\s*or\b/.test(lower.slice(last.at + last.part.term.length, last.at + last.part.term.length + 12));
    const atLeast = before.match(AT_LEAST);
    if (atLeast) groups.push({ mode: "any", operator: `at least ${NUMBER[atLeast[1].toLowerCase()]} of`, n: NUMBER[atLeast[1].toLowerCase()], parts: restParts });
    else if (ANY_OF.test(before)) groups.push({ mode: "any", operator: "any one of (stated)", flexible: openEnded, parts: restParts });
    else if (ALL_OF.test(before)) groups.push(...restParts.map((part) => ({ mode: "all", operator: "all of (stated)", parts: [part] })));
    // "Git / version control", "Azure / AWS": a spaced slash reads as "or"
    else if ((/\bor\b|\s\/\s/.test(between) || trailingOr) && !/\band\b/.test(between)) groups.push({ mode: "any", operator: trailingOr && !/\bor\b|\s\/\s/.test(between) ? "or (open list)" : "or", flexible: openEnded, parts: restParts });
    else {
      // "Python, JavaScript, Java": commas only, no "and"/"or": all, or any one?
      // Read in the light of the whole job; both readings are reported with
      // how likely each is, and the score weighs them by that
      const commasOnly = rest.length >= 3 && !/\b(and|or)\b|&/.test(between) && !trailingOr;
      if (commasOnly) {
        const scores = restParts.map((part) => part.score);
        const asAll = scores.reduce((sum, value) => sum + value, 0) / scores.length;
        const asAny = Math.max(...scores);
        const reading = readCommaList(restParts.map((part) => part.term), text, job);
        const score = reading.any * asAny + (1 - reading.any) * asAll;
        ambiguity = {
          terms: restParts.map((part) => part.term), asAll, asAny, score,
          likely: reading.any >= 0.65 ? "any" : reading.any <= 0.35 ? "all" : "unclear",
          interpretations: [{ reading: "any one", confidence: reading.any, score: asAny }, { reading: "all", confidence: Math.round((1 - reading.any) * 100) / 100, score: asAll }],
          reasons: reading.reasons
        };
        groups.push({ mode: "ambiguous", operator: "comma list (unclear)", parts: restParts, score });
      } else groups.push(...restParts.map((part) => ({ mode: "all", operator: "and", parts: [part] })));
    }
  } else if (rest.length) groups.push({ mode: "all", operator: "single", flexible: openEnded, parts: [rest[0].part] });

  const scored = groups.map((group) => {
    // Where the job accepts similar tools, a strongly related one does the same job
    // (TensorFlow for "PyTorch or similar", LlamaIndex for "a RAG framework such as LangChain")
    const effective = (part) => (group.flexible && part.match === "related" ? Math.max(part.score, CREDIT.equivalent[(part.depth || 2) - 1]) : part.score);
    for (const part of group.parts) if (group.flexible && part.match === "related" && effective(part) > part.score) {
      part.score = Math.round(effective(part) * 100) / 100;
      part.flexibleMatch = true;
      part.reason = `${part.via} does the same job, and the job accepts similar tools (${Math.round(part.score * 100)}%).`;
    }
    // Equal credit: the alternative with more evidence ("AWS" named three times beats "Azure" once)
    const weightOf = (part) => part.score * 100 + Math.min(9, (part.evidence?.length || 0) + (part.mentions || 0)) / 10;
    const ranked = [...group.parts].sort((a, b) => weightOf(b) - weightOf(a));
    const take = group.mode === "any" ? group.n || 1 : group.parts.length;
    const chosen = ranked.slice(0, take);
    const score = group.mode === "ambiguous" ? group.score : chosen.reduce((sum, part) => sum + part.score, 0) / chosen.length;
    // Likely "any one": the others are probably not needed (not certainly, so not called alternatives)
    if (group.mode === "ambiguous" && ambiguity.likely === "any") for (const part of ranked.slice(1)) part.alternativeLikely = part.score < ranked[0].score;
    return {
      mode: group.mode, operator: group.operator, terms: group.parts.map((part) => part.term), chosen: chosen.map((part) => part.term),
      best: chosen[0].term, score, flexible: Boolean(group.flexible), confirmOnly: group.parts.every((part) => part.match === "confirm")
    };
  });
  return { score: scored.reduce((sum, group) => sum + group.score, 0) / scored.length, groups: scored, ambiguity };
}

// How likely a comma list ("Python, JavaScript, Java") means any one of
// them, from the rest of the job: the level, whether one of them recurs
// elsewhere while the others don't, whether they're interchangeable kinds
// of tool, and how strongly the line is worded. Never certain either way.
const LANGUAGE = /^(python|java|javascript|typescript|c\+\+|c#|go|golang|rust|scala|kotlin|ruby|php|r|swift|julia|matlab)$/i;
const LANGUAGE_NAMES = ["Python", "Java", "JavaScript", "TypeScript", "Go", "C++", "C#", "Rust", "Scala", "Kotlin", "Ruby", "PHP", "Swift"];
const ANY_LANGUAGE = /\b(?:at least one|any|one or more|a)\s+(?:modern\s+|general[- ]purpose\s+)?(?:programming\s+)?languages?\b/i;
const CLOUD = /^(aws|azure|gcp|google cloud|oci)$/i;
function readCommaList(terms, line, job) {
  const reasons = [];
  let any = 0.5;
  const head = line.slice(0, 40).toLowerCase();
  const elsewhere = (job?.text || "").split(/\n+/).filter((other) => !other.toLowerCase().includes(head)).join("\n");
  const recurring = terms.filter((term) => mentions(elsewhere, term));
  if (job?.junior) {
    any += 0.15;
    reasons.push("it's a junior or entry-level role");
  }
  if (job?.senior) {
    any -= 0.1;
    reasons.push("senior roles more often expect several");
  }
  if (/\bfull[- ]stack\b/i.test(job?.text || "")) {
    any -= 0.2;
    reasons.push("a full-stack role usually needs several");
  }
  if (recurring.length && recurring.length < terms.length) {
    any += 0.2;
    reasons.push(`${recurring.join(", ")} comes up elsewhere in the job; ${terms.filter((term) => !recurring.includes(term)).join(" and ")} ${terms.length - recurring.length === 1 ? "doesn't" : "don't"}`);
  } else if (recurring.length === terms.length) {
    any -= 0.2;
    reasons.push("each one comes up elsewhere in the job");
  }
  if (terms.every((term) => LANGUAGE.test(term)) || terms.every((term) => CLOUD.test(term))) {
    any += 0.1;
    reasons.push(`they're interchangeable kinds of tool (${terms.every((term) => LANGUAGE.test(term)) ? "programming languages" : "cloud providers"}), often listed as alternatives`);
  }
  if (/\b(proficien\w*|expert\w*|strong|advanced|all of)\b/i.test(line)) {
    any -= 0.1;
    reasons.push("the line asks for proficiency");
  }
  return { any: Math.round(Math.min(0.85, Math.max(0.15, any)) * 100) / 100, reasons };
}

// "(beyond just Bedrock)", "(assisting)": qualifiers that aren't asked-for terms
const requirementText = (text) => text
  .replace(/\(\s*(?:beyond|other than|not just|excluding|in addition to)\b[^)]*\)/gi, "")
  .replace(/\(\s*([a-z]+(?:\s+[a-z]+)?)\s*\)/g, (whole, words) => (dictionaryKeywords(words).length ? whole : ""))
  .replace(/\s{2,}/g, " ").trim();

// AI coding assistants are used while working and rarely written on a
// resume: when the resume doesn't mention them, that's Unverified (ask in
// the interview), not a demonstrated gap. Excluded from the score.
const WORK_PRACTICE = /\b(?:ai[- ](?:enabled|assisted|powered) (?:dev(?:elopment)?|coding) tools?|ai coding (?:harness\w*|assistants?|tools?)|claude code|github copilot|copilot|agentic software development)\b/i;
const WORK_PRACTICE_SHOWN = /\b(?:claude code|copilot|cursor|codex|windsurf|ai[- ](?:assisted|powered) (?:coding|development)|ai coding|ai pair programming)\b/i;
// The candidate can answer it. Yes: confirmed (self-reported), and still not
// counted, since an unscored item can't lower the score by being confirmed;
// no: a counted gap.
const PRACTICE_KEY = "ai coding tools";
function unverifiedPractice(text, category, evidence) {
  if (!WORK_PRACTICE.test(text) || WORK_PRACTICE_SHOWN.test(evidence.all)) return null;
  const wording = wordingOf(text);
  const base = { text, category, wording, kind: "practice", confirmKey: PRACTICE_KEY, evidence: [] };
  const answer = evidence.confirmations?.get(PRACTICE_KEY);
  if (answer === "yes") {
    return { ...base, status: "Confirmed by you", unverified: true, match: "confirmed", score: 0, confidence: "low", confirmedByCandidate: true, reason: "Confirmed by you (self-reported), not on the resume. Not counted either way; name the tools in a bullet about work you built with them so employers see it." };
  }
  if (answer === "no") return { ...base, match: "missing", score: 0, confidence: "none", reason: "You said you haven't used AI coding tools." };
  return {
    ...base, status: "Unverified", unverified: true, match: "uncertain", score: 0, confidence: "none",
    reason: "Tools used while coding are rarely listed on resumes, so this can't be verified either way. Not counted in the score; answer the question above, or say so in a bullet or the interview."
  };
}

const CONFIDENCE_ORDER = ["none", "low", "moderate", "high"];
const confidenceRank = (list) => list.sort((a, b) => CONFIDENCE_ORDER.indexOf(a) - CONFIDENCE_ORDER.indexOf(b))[Math.floor(list.length / 2)] || "none";

// ---- Responsibilities, split into capabilities ----

const ACTION_VERBS = new Set(("design architect build develop create implement deploy release ship launch monitor observe maintain support operate optimize improve tune scale test validate " +
  "automate integrate configure administer manage lead own drive mentor coach train hire recruit plan define document review analyze evaluate assess research model " +
  "collaborate partner coordinate communicate present report track troubleshoot debug resolve secure audit migrate refactor write deliver sell negotiate prepare process " +
  "educate administer provide ensure oversee supervise schedule forecast budget reconcile").split(" "));
// Words in a bullet that show each kind of capability
const CAPABILITY_SIGNALS = {
  design: /\b(design|architect|architecture|blueprint)/i, architect: /\b(architect|design)/i,
  build: /\b(buil|develop|implement|creat|engineer)/i, develop: /\b(develop|buil|implement|creat)/i, implement: /\b(implement|buil|develop)/i, create: /\b(creat|buil|develop)/i,
  deploy: /\b(deploy|releas|ship|launch|serv(e|ing)|production|rollout)/i, release: /\b(releas|deploy|ship)/i, launch: /\b(launch|releas|deploy)/i,
  // Audit logging is a security control, not operational monitoring
  monitor: /\b(monitor|observab|metrics?\b|drift|alert|dashboard|tracing|telemetry|prometheus|grafana|datadog)/i,
  maintain: /\b(maintain|support|on-call|uptime|reliab|operat)/i, operate: /\b(operat|run|maintain|on-call)/i, support: /\b(support|maintain|troubleshoot|resolv)/i,
  optimize: /\b(optimi|tun|latency|throughput|cost|performance|faster|reduc|improv|speed)/i, improve: /\b(improv|optimi|reduc|increas|enhanc)/i, scale: /\b(scal|throughput|load|concurren)/i,
  test: /\b(test|qa\b|validat|verif|regression)/i, validate: /\b(validat|test|verif)/i, evaluate: /\b(evaluat|assess|benchmark|metric|ragas|accuracy)/i,
  automate: /\b(automat|pipeline|script|ci\/cd|scheduled)/i, integrate: /\b(integrat|connect|api|interface)/i,
  manage: /\b(manag|led|lead|own|oversaw|supervis)/i, lead: /\b(led|lead|head|own|drove|manag)/i, mentor: /\b(mentor|coach|train(ed)? (junior|new|team))/i,
  collaborate: /\b(collaborat|partner|cross-functional|stakeholder|work(ed)? with)/i, communicate: /\b(communicat|present|report|document|stakeholder)/i,
  document: /\b(document|wrote|write|spec|runbook)/i, analyze: /\b(analy[sz]|insight|investigat|research)/i,
  troubleshoot: /\b(troubleshoot|debug|resolv|root cause|incident)/i, secure: /\b(secur|rbac|encrypt|iam|compliance|audit)/i,
  educate: /\b(educat|teach|train|instruct)/i, provide: /./, ensure: /./
};

// "Design, deploy, monitor, and optimize production ML pipelines"
// -> { verbs: [design, deploy, monitor, optimize], object: "production ML pipelines" }
function capabilitiesOf(text) {
  // "The AI Engineer designs, develops..." / "This role partners with...": the duty starts at the verb
  const tokens = text
    .replace(/^(?:[Tt]he|[Tt]his|[Oo]ur)\s+(?:[\w/&-]+\s+){0,4}?(?=[a-z]+s\b)/, "")
    .replace(/^(you will|you'll|responsible for)\s+/i, "").split(/\s+/);
  const verbs = [];
  let index = 0;
  // A later verb counts only when a comma or "and"/"or" joins it to the list
  // ("design, deploy and monitor"), not as an adjective ("implement secure auth")
  let joined = true;
  for (; index < tokens.length; index += 1) {
    const raw = tokens[index].toLowerCase();
    const word = raw.replace(/[,;]$/, "");
    if (["and", "or", "&", "/"].includes(word)) {
      joined = true;
      continue;
    }
    const base = word.replace(/(s|ing|ed)$/, "").replace(/(.)\1$/, "$1");
    const verb = [word, base, `${base}e`].find((form) => ACTION_VERBS.has(form));
    if (!verb || !joined) break;
    verbs.push(verb);
    joined = /[,;]$/.test(raw);
  }
  return { verbs, object: tokens.slice(index).join(" ") };
}

// One responsibility: each capability scored against the bullets, then averaged.
// Several bullets for the same capability raise confidence, not the count.
// Scored on the duty without qualifiers like "(assisting)"; reported in the job's own words
// "Work with clients, key stakeholders, as well as cross-functional teams"
const SOFT_DUTY = /\b(?:collaborat\w*|partners? (?:closely )?with|work(?:s|ing)? (?:closely )?with|liaise|communicat\w* with|coordinat\w* with)\b.*\b(?:clients?|stakeholders?|teams?|customers?|leaders|partners|users|operations|engineers)\b/i;

function scoreResponsibility(text, evidence, claimed = new Map()) {
  const unverified = unverifiedPractice(text, "responsibilities", evidence);
  if (unverified) return unverified;
  // Teamwork duties: evidence of working with people, or a question to confirm (not a gap)
  if (SOFT_DUTY.test(text)) {
    const part = teamworkPart(evidence);
    return {
      text, category: "responsibilities", kind: "duty", wording: wordingOf(text), match: part.match, score: part.score,
      fitScore: part.match === "confirm" ? null : part.score, confidence: part.confidence, evidence: part.evidence,
      capabilities: [part], ...(part.confirmedByCandidate ? { confirmedByCandidate: true } : {}), ...(part.reason ? { reason: part.reason } : {}), ...(part.note ? { note: part.note } : {})
    };
  }
  return { ...scoreDuty(requirementText(text), evidence, claimed), text };
}

function scoreDuty(text, evidence, claimed) {
  const { verbs, object } = capabilitiesOf(text);
  const objectWords = wordsOf(object);
  // "machine learning pipelines": a bullet about XGBoost models is about machine learning
  const objectTools = Object.keys(EQUIVALENT).filter((key) => mentions(object, key)).flatMap((key) => EQUIVALENT[key]);
  // "AI-powered solutions": a bullet about an LLM assistant or an agentic workflow is about AI
  const aiObject = /\b(ai|artificial intelligence|llms?|genai|generative|agents?|agentic|intelligent)\b/i.test(object);
  const aboutObject = (bullet) => objectTools.some((tool) => mentions(bullet.text, tool)) ||
    (/\bmodels?\b/i.test(bullet.text) && /machine learning|\bml\b|model/i.test(object)) ||
    (aiObject && /\b(ai|llms?|rag|generative|genai|agentic|agents?|nlp|transformers?|machine learning)\b/i.test(bullet.text));

  if (verbs.length >= 2) {
    const capabilities = verbs.map((verb) => {
      const signal = CAPABILITY_SIGNALS[verb] || new RegExp(`\\b${verb.slice(0, 5)}`, "i");
      const scored = evidence.bullets.map((bullet) => {
        const wordShare = objectWords.size ? [...objectWords].filter((word) => bullet.words.has(word)).length / objectWords.size : 1;
        const shared = aboutObject(bullet) ? Math.max(wordShare, 0.5) : wordShare;
        const shows = signal.test(bullet.text);
        // The capability itself must show (a bullet about the pipeline without monitoring isn't monitoring)
        const value = shows && shared >= 0.34 ? 1 : shows && shared > 0 ? 0.7 : 0;
        return { bullet, value: value * sourceFactor(bullet, 2) };
      }).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
      const best = scored[0];
      return {
        capability: `${verb[0].toUpperCase()}${verb.slice(1)}`,
        score: best ? Math.round(best.value * 100) / 100 : 0,
        match: !best ? "missing" : best.value >= 0.95 ? "direct" : best.value >= 0.6 ? "related" : "partial",
        confidence: scored.length >= 2 ? "high" : best ? "moderate" : "none",
        evidence: best ? [{ text: best.bullet.text, where: best.bullet.where, source: best.bullet.source }] : []
      };
    });
    const score = capabilities.reduce((sum, item) => sum + item.score, 0) / capabilities.length;
    const missingCapabilities = capabilities.filter((item) => item.score === 0).map((item) => item.capability);
    const partialCapabilities = capabilities.filter((item) => item.score > 0 && item.score < 0.95).map((item) => item.capability);
    const reason = [
      missingCapabilities.length ? `${missingCapabilities.join(" and ")} ${missingCapabilities.length === 1 ? "isn't" : "aren't"} demonstrated.` : "",
      partialCapabilities.length ? `${partialCapabilities.join(" and ")} ${partialCapabilities.length === 1 ? "is" : "are"} only partly shown.` : ""
    ].filter(Boolean).join(" ");
    return {
      text, category: "responsibilities", kind: "capabilities", wording: wordingOf(text),
      ...(reason ? { reason } : {}),
      match: score >= 0.95 ? "direct" : score >= 0.6 ? "related" : score > 0 ? "partial" : "missing",
      score: Math.round(score * 100) / 100,
      confidence: confidenceRank(capabilities.map((item) => item.confidence)),
      capabilities
    };
  }

  const { score, bullet } = bestBullet(text, evidence.bullets);
  const overlap = (score >= 0.45 ? 1 : score >= 0.25 ? 0.5 : 0) * (bullet ? sourceFactor(bullet, 2) : 1);
  // The tools a duty names, matched like qualifications (PySpark for Spark)
  // A duty is its own capability (operating services on Kubernetes isn't the
  // same requirement as "experience with Kubernetes"); only an identical one is skipped
  const dutyTerms = termsOf(text).filter((term) => !BROAD_TERMS.has(term.toLowerCase()));
  const dutyContext = contextOf(text, dutyTerms);
  const terms = dutyTerms
    .filter((term) => ![...claimed.values()].some((other) => other.term === term.toLowerCase() && sameContext(other.context, dutyContext)))
    .map((term) => ({ term, ...matchTerm(term, evidence, wordingOf(text), text) }));
  const combined = combineTerms(text, terms, evidence.job);
  const termAverage = combined.score;
  const alternatives = combined.groups.filter((group) => group.mode === "any" && group.terms.length > 1);
  for (const term of terms) term.alternative = alternatives.some((group) => group.terms.includes(term.term) && !group.chosen.includes(term.term) && group.score > 0 && term.score < group.score);
  // "Secure API authentication": naming the API isn't enough; the bullets must
  // show what the duty asks of it (security, authentication)
  const verbStems = new Set(verbs.map((verb) => stem(verb)));
  const askedContext = new Set([...dutyContext].filter((word) => !verbStems.has(word)));
  let contextValue = 1;
  if (terms.length && askedContext.size) {
    const { score: overlap } = bestBullet([...askedContext].join(" "), evidence.bullets);
    contextValue = overlap >= 0.5 ? 1 : overlap >= 0.25 ? 0.5 : 0;
  }
  const toolScore = terms.length ? (askedContext.size ? termAverage * 0.6 + contextValue * 0.4 * (termAverage > 0 ? 1 : 0) : termAverage) : 0;
  const value = Math.max(overlap, toolScore);
  const byTools = toolScore > overlap;
  return {
    text, category: "responsibilities", kind: "duty", wording: wordingOf(text),
    match: value >= 0.95 ? "direct" : byTools && value >= 0.6 ? "equivalent" : value > 0 ? "partial" : "missing",
    score: Math.round(value * 100) / 100,
    confidence: value ? (byTools ? confidenceRank(terms.map((term) => term.confidence)) : bullet.source === "work" && DEPTH.test(bullet.text) ? "high" : "moderate") : "none",
    evidence: value ? (byTools ? terms.flatMap((term) => term.evidence).slice(0, 3) : [{ text: bullet.text, where: bullet.where, source: bullet.source }]) : [],
    ...(terms.length ? { terms } : {}),
    ...(alternatives.length ? { logic: combined.groups.map(({ mode, operator, terms: names, chosen, best, flexible, score: groupScore }) => ({ mode, operator, terms: names, chosen, best, flexible, score: Math.round(groupScore * 100) / 100 })) } : {}),
    ...(byTools && askedContext.size ? { capability: { asks: [...askedContext], score: contextValue } } : {}),
    ...(value < 0.95 ? { reason: value === 0 ? (terms.some((term) => term.reason) ? terms.map((term) => term.reason).filter(Boolean).join(" ") : "No bullet demonstrates this duty.") : byTools ? [...terms.map((term) => term.reason).filter(Boolean), contextValue < 1 ? `What the duty asks beyond the tools (${[...askedContext].join(", ")}) is ${contextValue ? "only partly" : "not"} demonstrated.` : ""].filter(Boolean).join(" ") : "One bullet shares some of this duty's wording; it isn't stated directly." } : {})
  };
}

// ---- Experience, seniority, domain, eligibility ----

const LEVELS = ["Entry-level", "Junior", "Mid-level", "Senior", "Staff / Principal"];
function levelFromTitle(title) {
  if (/\b(intern|entry[- ]level|graduate|new grad|trainee)\b/i.test(title)) return 0;
  if (/\b(junior|jr\.?|associate)\b/i.test(title) || /\bI\b(?!I)/.test(title)) return 1;
  if (/\b(staff|principal|distinguished|chief)\b/i.test(title)) return 4;
  if (/\b(senior|sr\.?|lead)\b|\bIII\b/i.test(title)) return 3;
  return null;
}
const levelFromYears = (years) => (years < 1 ? 0 : years < 2 ? 1 : years < 5 ? 2 : years < 8 ? 3 : 4);

function seniorityOf({ jobTitle, jobDescription, minYears, resume, years }) {
  const manager = /\b(manager|head of|director)\b/i.test(jobTitle) && !/\b(product|project|program) manager\b/i.test(jobTitle);
  const jobLevel = levelFromTitle(jobTitle) ?? (minYears ? levelFromYears(minYears) : null);
  const latest = resume.experience[0]?.title || "";
  const candidateLevel = Math.max(levelFromTitle(latest) ?? 0, levelFromYears(years));
  const flags = [];
  if (manager) {
    const managed = /\b(managed (a )?team|direct reports|hired|people manager|managed \d+)/i.test(resume.experience.flatMap((item) => item.bullets).join(" "));
    if (!managed) flags.push("The role is a people-management role; the resume shows no people management (hiring, direct reports).");
  } else if (jobLevel !== null && candidateLevel > jobLevel + 1) {
    flags.push(`Possible level mismatch: the resume reads ${LEVELS[candidateLevel]}, the role is ${LEVELS[jobLevel]}. Technically a fit, but level or pay may not match.`);
  } else if (jobLevel !== null && candidateLevel < jobLevel) {
    flags.push(`The role is ${LEVELS[jobLevel]}; the resume reads ${LEVELS[candidateLevel]}. Show ${jobLevel >= 3 ? "architecture, reliability and mentoring" : "independent delivery and production ownership"}.`);
  }
  return { job: manager ? "Engineering Manager" : jobLevel === null ? "Not stated" : LEVELS[jobLevel], candidate: LEVELS[candidateLevel], flags };
}

const DOMAINS = {
  Healthcare: /\b(healthcare|health care|hospital|clinic(al)?|patients?|hipaa|ehr|emr|medical|nursing|payer|provider network)\b/gi,
  "Life sciences": /\b(pharma\w*|biotech\w*|life sciences|clinical trials?|fda|gxp)\b/gi,
  Finance: /\b(bank(ing)?|fintech|payments?|trading|financial services|lending|credit|fraud|pci|sox|brokerage|wealth management)\b/gi,
  Insurance: /\b(insurance|insurer|underwriting|claims|actuarial|policyholders?)\b/gi,
  Energy: /\b(energy|utilit(y|ies)|power grid|electric(ity)?|oil and gas|renewables?|nerc|scada|substation)\b/gi,
  Telecom: /\b(telecom\w*|wireless|carrier|5g|lte|network operator|broadband)\b/gi,
  Retail: /\b(retail|e-?commerce|merchandis\w*|shoppers?|point of sale|storefront)\b/gi,
  Government: /\b(federal|government|public sector|agency|fedramp|dod|municipal)\b/gi,
  Education: /\b(education|edtech|students?|universit(y|ies)|k-12|learning management)\b/gi,
  Manufacturing: /\b(manufactur\w*|factory|industrial|supply chain|plant operations)\b/gi,
  Logistics: /\b(logistics|shipping|freight|warehous\w*|fleet|last[- ]mile)\b/gi
};
const ADJACENT = { Healthcare: ["Life sciences", "Insurance"], "Life sciences": ["Healthcare"], Finance: ["Insurance"], Insurance: ["Finance", "Healthcare"], Energy: ["Manufacturing"], Manufacturing: ["Energy", "Logistics"], Logistics: ["Retail", "Manufacturing"], Retail: ["Logistics"], Telecom: [], Government: [], Education: [] };
const REGULATED = new Set(["Healthcare", "Life sciences", "Finance", "Insurance", "Energy", "Government"]);
const TRANSFERABLE = /\b(rbac|audit|compliance|governance|hipaa|pci|sox|gdpr|data validation|access control|encryption|monitoring|security)\b/i;
// Employers whose industry is clear from the name
const KNOWN_EMPLOYERS = [[/paypal|visa|mastercard|capital one|jpmorgan|chase|wells fargo|goldman|citi|stripe|american express/i, "Finance"], [/verizon|at&t|t-mobile|comcast|sprint/i, "Telecom"], [/baylor|kaiser|mayo|cleveland clinic|hca|unitedhealth|cvs health/i, "Healthcare"], [/walmart|target|amazon|costco|kroger/i, "Retail"]];

function domainsIn(text) {
  return Object.entries(DOMAINS)
    .map(([name, pattern]) => [name, (text.match(pattern) || []).length])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

// Specific controls a regulated job may name, and how a resume shows them
const CONTROLS = {
  "access control": /\b(rbac|role-based access|access control|iam\b|least[- ]privilege|permissions?)\b/i,
  "audit logging": /\baudit(s|ing| logs?| trails?)?\b/i,
  encryption: /\bencrypt\w*/i,
  "data validation": /\bdata (validation|quality|integrity)\b/i,
  monitoring: /\b(monitor\w*|observab\w*|alerting)\b/i,
  compliance: /\b(complian\w*|regulat\w*|governance)\b/i,
  "incident response": /\bincident\w*/i,
  privacy: /\b(privacy|pii|gdpr|hipaa)\b/i
};
// Field standards the job may name; never assumed from other industries
const STANDARDS = /\b(NERC(?: CIP)?|SCADA|HIPAA|PCI(?: DSS)?|SOX|FedRAMP|GxP|FDA|FERC|ISO 27001|SOC 2|CMMC|ITAR|FISMA|IEC 62443)\b/g;

function domainAlignment(jobDescription, resume, evidence) {
  const jobDomains = domainsIn(jobDescription).filter(([, count]) => count >= 2);
  if (!jobDomains.length) return null;
  const job = jobDomains[0][0];
  const resumeText = `${resume.experience.map((item) => item.organization).join(" ")}\n${evidence.all}`;
  const candidate = new Set([
    ...domainsIn(resumeText).map(([name]) => name),
    ...resume.experience.flatMap((item) => KNOWN_EMPLOYERS.filter(([pattern]) => pattern.test(item.organization)).map(([, name]) => name))
  ]);

  // Standards of the field the job names that the resume doesn't demonstrate
  const standards = [...new Set(jobDescription.match(STANDARDS) || [])];
  const missingStandards = standards.filter((standard) => !mentions(evidence.all, standard));
  // Controls the job asks for, and which the resume demonstrates
  const jobControls = Object.entries(CONTROLS).filter(([, pattern]) => pattern.test(jobDescription)).map(([name]) => name);
  const shownControls = Object.entries(CONTROLS).filter(([, pattern]) => pattern.test(evidence.all)).map(([name]) => name);
  const sharedControls = jobControls.filter((name) => shownControls.includes(name));

  let item;
  if (candidate.has(job)) item = { match: "direct", score: 1, detail: `Direct ${job.toLowerCase()} experience.` };
  else if (ADJACENT[job]?.some((name) => candidate.has(name))) {
    const near = ADJACENT[job].find((name) => candidate.has(name));
    item = { match: "related", score: 0.75, detail: `Adjacent industry (${near}); much of the context transfers.` };
  } else if (REGULATED.has(job) && shownControls.length) {
    // Credit follows the specific controls the job names; controls it doesn't
    // name count at half, as general regulated-industry practice
    const share = Math.max(jobControls.length ? sharedControls.length / jobControls.length : 0, Math.min(shownControls.length, 3) / 6);
    const score = Math.round((0.3 + 0.4 * share) * 100) / 100;
    item = {
      match: "partial", score,
      detail: `No ${job.toLowerCase()} experience. Transferable controls demonstrated: ${shownControls.join(", ")}${jobControls.length > sharedControls.length ? `; asked but not demonstrated: ${jobControls.filter((name) => !sharedControls.includes(name)).join(", ")}` : ""}. This doesn't show ${job.toLowerCase()}-specific knowledge.`
    };
  } else {
    // Credited for transferable skills, so labeled partial, not "not demonstrated"
    item = { match: "partial", score: 0.3, detail: `No ${job.toLowerCase()} experience demonstrated; general skills still transfer (30%).` };
  }
  return {
    text: `${job} industry`, category: "domain", kind: "domain", wording: "required",
    ...item,
    reason: item.score < 1 ? item.detail : undefined,
    confidence: item.match === "direct" ? "high" : item.match === "missing" ? "none" : "moderate",
    // The employer or bullet behind each industry found, as written on the resume
    evidence: [...candidate].map((name) => {
      const employer = resume.experience.find((entry) => KNOWN_EMPLOYERS.some(([pattern, field]) => field === name && pattern.test(entry.organization)) || domainsIn(entry.organization).some(([field]) => field === name));
      if (employer) return { text: employer.organization, where: `Employer (${name})`, section: "Experience", source: "work" };
      const bullet = evidence.bullets.find((entry) => domainsIn(entry.text).some(([field]) => field === name));
      if (bullet) return { text: bullet.text, where: bullet.where, source: bullet.source, note: name };
      const line = evidence.lines.find((entry) => domainsIn(entry.text).some(([field]) => field === name));
      return line ? { text: line.text, where: `${line.section} (${name})`, section: line.section, source: "listed" } : null;
    }).filter(Boolean).slice(0, 3),
    ...(missingStandards.length ? { note: `Field standards in the job not demonstrated on the resume: ${missingStandards.join(", ")}.` } : {})
  };
}

// Hard screening conditions, each Met / Not Met / Unknown; never inferred
// from silence. A years minimum is only a gate when the job says it's strict
// (see yearsRequirement). Background checks and drug screens are hiring steps, not
// resume requirements.
function eligibilityOf(jobDescription, evidence) {
  const sentences = jobDescription.split(/(?<=[.!?])\s+|\n+/).map((text) => text.replace(/^[•\-*–\d.)\s]+/, "").trim()).filter(Boolean);
  const said = (pattern) => sentences.find((sentence) => pattern.test(sentence) && !/background check|drug (screen|test)/i.test(sentence));
  const list = [];

  const authorization = said(/\b(authori[sz]ed to work|work authori[sz]ation|sponsorship|visa|u\.?s\.? citizen\w*|green card|permanent resident)\b/i);
  if (authorization) {
    const shown = /\b(u\.?s\.? citizen|green card|permanent resident|authori[sz]ed to work|no sponsorship required)\b/i.test(evidence.all);
    list.push({ condition: "Work authorization", text: authorization, status: shown ? "Met" : "Unknown", detail: shown ? "Stated on the resume." : "The resume doesn't say; answer this in the application, not by guessing." });
  }
  const clearance = said(/\b(security clearance|secret clearance|top secret|ts\/sci|public trust|clearance required)\b/i);
  if (clearance) {
    const shown = /\b(clearance|top secret|ts\/sci|public trust)\b/i.test(evidence.all);
    const obtain = /\b(obtain|able to (get|obtain)|eligib\w*|ability to (get|obtain))\b/i.test(clearance);
    list.push({
      condition: /public trust/i.test(clearance) ? "Public Trust" : "Security clearance", text: clearance, status: shown ? "Met" : "Unknown",
      detail: shown ? "A clearance is mentioned on the resume; confirm the level matches." : obtain ? "Requires verification: the job asks you to obtain it, which is decided in the hiring process, not from the resume." : "No clearance mentioned on the resume."
    });
  }
  // A preference or a negated ask ("preferred but not required") is never a gate
  for (const sentence of sentences.filter((text) => /\b(licen[cs]e|licensure|certification|certified|registered)\b/i.test(text) && /\b(required|must|mandatory|active|current|valid)\b/i.test(text) && !PREFERRED.test(text) && !SOFTENED.test(text) && !NOT_NEEDED.test(text)).slice(0, 4)) {
    const terms = phrasesFrom([sentence]);
    const shown = terms.length && terms.every((term) => mentions(evidence.all, term) || (/^[A-Z]{2,6}$/.test(term) && evidence.initials.has(term)));
    list.push({ condition: "Mandatory license or certification", text: sentence, status: shown ? "Met" : "Unknown", detail: shown ? "Shown on the resume." : "Not shown on the resume. If you hold it, list it with its exact name." });
  }
  const workplace = said(/\b(ppe|personal protective|safety (regulations|policies|requirements|rules)|eh&s)\b/i);
  if (workplace) list.push({ condition: "Workplace safety rules", text: workplace, status: "Unknown", detail: "A condition of the job, agreed when hired; not something a resume shows." });
  const place = said(/\b(on[- ]?site|in[- ]office|relocat\w*|must (live|reside|be located)|travel (up to )?\d+\s?%|\d+\s?% travel)\b/i);
  if (place) list.push({ condition: "Location or travel", text: place, status: "Unknown", detail: "Can't be judged from a resume; confirm you can meet it." });
  return list;
}

// ---- Role family ----

// Skills nearly every role in a family lists; they don't get the family boost
const GENERIC_SKILLS = /^(python|sql|git|github|linux|excel|java|javascript|communication|teamwork|agile|scrum|jira|microsoft office)$/i;
const isGenericSkillLine = (text) => {
  const terms = termsOf(text);
  return terms.length > 0 && terms.every((term) => GENERIC_SKILLS.test(term));
};

const ROLE_FAMILIES = [
  ["Agentic AI Engineer", /\bagent(ic)?\b/i, /\b(orchestrat|planning|tool|memory|guardrail|evaluat|agent|mcp|a2a)/i],
  ["MLOps Engineer", /\bmlops\b/i, /\b(ci\/cd|registry|serving|monitor|infrastructure|pipeline)/i],
  ["AI/ML Engineer", /\b(ai|ml|machine learning|llm|genai|nlp)\b/i, /\b(model|evaluat|inference|deploy|mlops|training|llm|rag)/i],
  ["Data Scientist", /\bdata scien/i, /\b(statistic|experiment|model|a\/b|interpret|insight)/i],
  ["Data Engineer", /\bdata engineer/i, /\b(etl|elt|sql|spark|orchestrat|data model|pipeline|warehouse)/i],
  ["DevOps Engineer", /\b(devops|sre|site reliability)\b/i, /\b(automat|iac|terraform|ci\/cd|container|monitor|reliab)/i],
  ["Platform Engineer", /\bplatform engineer/i, /\b(kubernetes|infrastructure|operat|security|platform)/i],
  ["Cloud Engineer", /\bcloud engineer/i, /\b(cloud|network|iam|deploy|cost)/i],
  ["Full Stack Engineer", /\bfull[- ]?stack\b/i, /\b(frontend|front-end|backend|back-end|database|auth|deploy|react|api)/i],
  ["BI / Analytics Engineer", /\b(bi|analytics engineer|business intelligence)\b/i, /\b(sql|data model|dashboard|semantic|stakeholder)/i],
  ["Cybersecurity Engineer", /\b(security|cyber)/i, /\b(threat|control|incident|compliance|vulnerab)/i],
  ["Software Engineer", /\b(software|developer|engineer)\b/i, /\b(programming|design|api|test|maintain|code)/i]
];
// The role family from the title (strongest signal), the job's duties and
// skills, and the JD Analyst agent's reading when it names a known family
function familyOf(title, job = { responsibilities: [], required: [], preferred: [] }, aiFamily = "") {
  const body = [...job.responsibilities, ...job.required, ...job.preferred].join("\n");
  const scored = ROLE_FAMILIES.map((family) => {
    const inTitle = family[1].test(title) ? 3 : 0;
    const inBody = (body.match(new RegExp(family[2].source, "gi")) || []).length;
    return { family, score: inTitle + Math.min(inBody, 6) * 0.5, inTitle };
  }).sort((a, b) => b.score - a.score);
  const ai = ROLE_FAMILIES.find(([name]) => name.toLowerCase() === aiFamily.trim().toLowerCase());
  const best = scored[0];
  // The agent decides only when the rules are unsure (no title match or a tie)
  if (ai && (!best.inTitle || scored[1].score === best.score)) return Object.assign([...ai], { how: "from the JD Analyst agent's reading" });
  if (best.score < 2) return null;
  return Object.assign([...best.family], { how: best.inTitle ? "from the title and duties" : "from the duties and skills" });
}

// ---- Scoring ----

const BASE_WEIGHTS = { required: 0.4, responsibilities: 0.3, preferred: 0.15, domain: 0.1, education: 0.05 };
const CATEGORY_LABELS = { required: "Required qualifications", responsibilities: "Responsibilities", preferred: "Preferred qualifications", domain: "Domain alignment", education: "Education" };
const BANDS = [
  [90, "Excellent", "Strong Apply"], [80, "Strong", "Strong Apply"], [70, "Good", "Apply"],
  [60, "Moderate", "Apply with Tailoring"], [45, "Limited", "Significant gaps"], [0, "Low", "Lower-priority opportunity"]
];

// C = 100 x sum(w s) / sum(w)
// Preferred qualifications are advantages: nobody is expected to have them
// all. Showing PREFERRED_EXPECTED of them (by weight) earns the whole
// category; below that, credit is proportional, and none shown is 0.
const PREFERRED_EXPECTED = 0.6;
function categoryScore(items, key = "") {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;
  const raw = items.reduce((sum, item) => sum + item.weight * item.score, 0) / total;
  const value = key === "preferred" ? Math.min(1, raw / PREFERRED_EXPECTED) : raw;
  return Math.round(1000 * value) / 10;
}

// Company, role, location and level for the report header
// "McLean, VA", not "Python, ML"
const US_STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY";
function jobHeader(jobDescription, jobTitle, seniority) {
  const firstLines = jobDescription.split(/\r?\n/).slice(0, 6).join("\n");
  const company = (firstLines.match(/\bat[ \t]+([A-Z][\w&.'-]*(?:[ \t]+[A-Z][\w&.'-]*){0,3})/) ||
    jobDescription.match(/\b(?:company|employer|organization)\s*:\s*([^\n]+)/i) ||
    jobDescription.match(/\babout[ \t]+([A-Z][\w&.'-]*(?:[ \t]+[A-Z][\w&.'-]*){0,3})[ \t]*\n/) || [])[1] || "";
  const location = (jobDescription.match(/\blocation\s*:\s*([^\n]+)/i) ||
    jobDescription.match(new RegExp(`\\b((?:[A-Z][a-zA-Z.]+\\s){0,2}[A-Z][a-zA-Z.]+,\\s?(?:${US_STATES}))\\b`)) ||
    jobDescription.match(/\b(remote|hybrid|on[- ]?site)\b/i) || [])[1] || "";
  return { company: company.trim().slice(0, 80), role: jobTitle, location: location.trim().slice(0, 80), seniority: seniority.job };
}

// ---- The agents (optional) ----

const ANALYST_PROMPT = [
  "You read a job description for any kind of role and pull out what a resume should show.",
  "- keywords: skills, tools, software, methods, certifications and licenses, 1 to 4 words each,",
  "  copied exactly from the job description. No job titles, places, benefits or company names.",
  "- responsibilities: the duties of the role, each copied or closely paraphrased from the job.",
  "- qualifications: requirements such as degrees, years, licenses, certifications and knowledge;",
  "  importance \"preferred\" if the job says preferred, nice to have or a plus, else \"required\".",
  "At most 20 keywords, 12 responsibilities and 12 qualifications, most important first.",
  `- roleFamily: the closest of ${ROLE_FAMILIES.map(([name]) => `"${name}"`).join(", ")}, or "" if none fits.`,
  'Reply with JSON only: {"keywords": string[], "responsibilities": string[], "qualifications": [{"text": string, "importance": string}], "roleFamily": string}'
].join("\n");

const EVIDENCE_PROMPT = [
  "You check a resume against a job's responsibilities. bullets are numbered resume bullets.",
  "For each responsibility, give the ONE bullet that shows the candidate doing that duty or",
  "clearly the same kind of work, even if worded differently. Skip responsibilities with none.",
  "For each match explain it:",
  "- capability: the part of the duty the bullet demonstrates, in a few words.",
  "- relationship: how the bullet's work demonstrates it, in one sentence.",
  "- technologies: tools named in the bullet that support it, copied exactly from the bullet.",
  "- unsupported: parts of the duty the bullet does NOT demonstrate (e.g. \"authentication\").",
  "- level: \"strong\" if the bullet clearly shows the whole duty, \"partial\" otherwise.",
  'Reply with JSON only: {"matches": [{"responsibility": number, "bullet": number, "capability": string, "relationship": string, "technologies": string[], "unsupported": string[], "level": string}]}'
].join("\n");

// Checks an Evidence-agent claim against the source: the bullet exists, every
// technology it names is in that bullet, and the bullet plausibly concerns
// the duty. The agent only proposes the bullet; how strong the match is comes
// from code (how much of the duty's wording and capabilities the bullet
// shows), never from the agent's own "level". Semantic correctness still
// needs review, so accepted claims are marked for it. Returns the accepted
// explanation, or null.
function validateEvidenceClaim(claim, duty, bullets) {
  const bullet = bullets[claim?.bullet];
  if (!bullet) return null;
  const capability = typeof claim.capability === "string" ? claim.capability.trim().slice(0, 120) : "";
  if (!capability) return null;
  const technologies = (Array.isArray(claim.technologies) ? claim.technologies : []).filter((tool) => typeof tool === "string" && tool.trim()).map((tool) => tool.trim());
  // Every named technology must really be in the bullet
  if (technologies.some((tool) => !mentions(bullet.text, tool))) return null;
  // Preliminary relevance: real shared words or a tool the duty names
  const shared = [...wordsOf(duty)].filter((word) => bullet.words.has(word)).length;
  const namesTool = termsOf(duty).some((term) => mentions(bullet.text, term));
  if (shared < 2 && !namesTool) return null;
  const unsupported = (Array.isArray(claim.unsupported) ? claim.unsupported : []).filter((part) => typeof part === "string" && part.trim()).map((part) => part.trim().slice(0, 80));
  // Deterministic strength: the share of the duty's content words in the
  // bullet, and every capability verb of the duty visibly shown
  const content = [...wordsOf(duty)].filter((word) => !NOT_CONTEXT.has(word));
  const coverage = content.length ? content.filter((word) => bullet.words.has(word)).length / content.length : 0;
  const { verbs } = capabilitiesOf(duty);
  const verbsShown = verbs.every((verb) => (CAPABILITY_SIGNALS[verb] || new RegExp(`\\b${verb.slice(0, 5)}`, "i")).test(bullet.text));
  return {
    bullet,
    // Anything the bullet doesn't demonstrate caps the claim at partial
    level: !unsupported.length && verbsShown && coverage >= 0.4 ? "strong" : "partial",
    coverage: Math.round(coverage * 100) / 100,
    explanation: {
      capability,
      relationship: typeof claim.relationship === "string" ? claim.relationship.trim().slice(0, 240) : "",
      technologies,
      unsupported,
      source: bullet.where
    }
  };
}

// Most of an AI item's words must be in the job, so nothing is invented
const fromJob = (text, jobWords) => {
  const words = wordsOf(text);
  return words.size > 0 && [...words].filter((word) => jobWords.has(word)).length / words.size >= 0.7;
};

// ---- What the resume has ----

const SENIORITY = /\b(senior|sr|junior|jr|lead|staff|principal|associate|intern|entry|level|i{1,3}|iv)\b\.?/gi;

// The job's title: its first line, when that's a short title
function jobTitleOf(jobDescription) {
  const first = jobDescription.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
  const title = first.split(/\s+[-–|@]\s+|\s+at\s+|,/)[0].trim();
  return title.length <= 80 && !/[.!?]$/.test(title) && title.split(/\s+/).length <= 8 ? title : "";
}

// How the resume's role and job titles compare with the job's title
function roleMatch(resume, jobTitle) {
  if (!jobTitle) return null;
  // "AI Engineer - Agents": the job is the part before the dash; the rest is a level or specialty
  const want = wordsOf(jobTitle.split(/\s+[-–|]\s+/)[0].replace(SENIORITY, " "));
  if (!want.size) return null;
  const titles = [resume.contact?.role, ...resume.experience.map((item) => item.title)].filter(Boolean);
  const best = Math.max(0, ...titles.map((title) => {
    const have = wordsOf(title.replace(SENIORITY, " "));
    return [...want].filter((word) => have.has(word)).length / want.size;
  }));
  return { jobTitle, level: best >= 0.75 ? "matches" : best >= 0.4 ? "close" : "different" };
}

// The checklist of what a resume should have, and what was read
function profileOf(resume, jobDescription) {
  const contact = resume.contact || {};
  const role = roleMatch(resume, jobDescription ? jobInfoOf(jobDescription).title || jobTitleOf(jobDescription) : "");
  const count = (list, word) => (list.length ? `${list.length} ${word}${list.length === 1 ? "" : "s"}` : "");
  return [
    { field: "Name", value: contact.name || "", required: true },
    { field: "Email", value: contact.email || "", required: true },
    { field: "Phone", value: contact.phone || "", required: false },
    { field: "LinkedIn", value: contact.linkedin || "", required: true },
    { field: "GitHub", value: contact.github || "", required: false },
    { field: "Role", value: contact.role || "", required: true, detail: contact.roleFrom === "latest job" ? "Taken from the latest job title; no headline under the name." : "", role },
    { field: "Summary", value: resume.summary ? `${resume.summary.split(/\s+/).length} words` : "", required: true },
    { field: "Experience", value: count(resume.experience.filter((item) => item.organization !== "Resume"), "job"), required: true, items: resume.experience.map((item) => [item.title, item.organization, item.dates].filter(Boolean).join(" · ")) },
    { field: "Projects", value: count(resume.projects, "project"), required: false, items: resume.projects.map((item) => item.title) },
    { field: "Education", value: count(resume.education, "entry"), required: true, items: resume.education.map((item) => item.degree) },
    { field: "Certifications", value: count(resume.certifications || [], "certification"), required: false, items: resume.certifications || [] }
  ].map((item) => ({ ...item, found: Boolean(item.value) }));
}


// ---- Years of experience ----

// "5+ years of experience", "3-5 years of relevant experience", "at least 8
// years' experience". Other numbers with "years" (company history,
// warranties) are not experience requirements.
const YEARS_OF_EXPERIENCE = /(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs)['’]?\s+(?:of\s+)?(?:[a-z/&-]+\s+){0,4}?(?:experience|exp\b)/i;
const STRICT = /\b(non[- ]negotiable|strict(ly)?|no exceptions?|without exception|hard requirement|mandatory)\b/i;
const EQUIVALENT_CLAUSE = /\b(or equivalent|equivalent (combination|experience|education|work)|or (a )?related degree|in lieu of)\b/i;

// Every years requirement in the job: "5+ years of experience in software
// engineering", "including 3+ years of hands-on AI/ML development", "at least
// 5 years", "minimum of 7 years". Company history ("founded 25 years ago")
// and ranges from zero ("0 to 4 years") aren't requirements.
const YEARS_MENTION = /(?:\b(?:at least|minimum(?: of)?|min\.?|no less than)\s+)?\b(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs)\b['’]?/gi;
const NOT_EXPERIENCE = /\b(ago|founded|history|in business|serving|warranty|old|anniversary|company|since)\b/i;
const EXPERIENCE_CUE = /^\s*(?:of\s+)?(?:[\w/&+-]+\s+){0,6}?(?:experience|exp\b|development|engineering|work|working|programming|building|developing|hands-on|in\b|as\b|with\b)/i;

// The field the years are in ("software engineering, data science, or a related field")
function yearsFieldOf(after) {
  const clause = after.split(/[.;]|,?\s+including\b|,?\s+with\s+at least\b|\(/i)[0]
    .replace(/^\s*(?:of\s+)?(?:(?:relevant|professional|progressive|related|total|industry|work|hands-on|proven)\s+)*(?:experience|exp)?\s*(?:in|with|as|of|on|doing)?\s*/i, "")
    .replace(/\s+(?:experience|exp)\b.*$/i, "")
    .replace(/^(?:a|an|the)\s+/i, "").trim();
  const label = clause;
  // "or a related field", "relevant experience" with no field: any professional work counts
  const known = FIELD_PATTERNS.some(([asks]) => asks.test(label));
  const broad = !label || /\b(related|relevant|similar|equivalent|any|comparable)\b[^,]*$/i.test(clause) ||
    (!known && GENERIC_TERMS.has(label.toLowerCase())) || /^(professional|work|industry|total|overall|combined|full[- ]time)$/i.test(label);
  return { label, broad };
}

function yearsRequirements(jobDescription, job) {
  const found = [];
  for (const raw of jobDescription.split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.trim();
    for (const match of sentence.matchAll(YEARS_MENTION)) {
      const minYears = Number(match[1]);
      const after = sentence.slice(match.index + match[0].length);
      const stated = /^(?:at least|minimum|min|no less)/i.test(match[0]);
      if (!minYears || minYears > 20 || /^\s*0\s*(?:-|–|to)/.test(match[0].replace(/^\D+/, ""))) continue;
      if (NOT_EXPERIENCE.test(sentence.slice(Math.max(0, match.index - 25), match.index + match[0].length + 25))) continue;
      if (!stated && !EXPERIENCE_CUE.test(after) && !/experience/i.test(sentence)) continue;
      const field = yearsFieldOf(after);
      if (found.some((item) => item.minYears === minYears && item.field.label === field.label)) continue;
      const inPreferred = job.preferred.some((text) => text.includes(sentence.replace(/^[•\-*–\d.)\s]+/, "").slice(0, 40)));
      found.push({
        minYears, sentence, field,
        strict: STRICT.test(sentence),
        // "5+ years of experience or equivalent": the employer may accept other experience or education
        acceptsEquivalent: EQUIVALENT_CLAUSE.test(sentence),
        importance: inPreferred || PREFERRED.test(sentence) ? "preferred" : "required"
      });
    }
  }
  return found;
}
// The first (usually the overall) requirement, for seniority and the summary
const yearsRequirement = (jobDescription, job) => yearsRequirements(jobDescription, job)[0] || null;

// Jobs in a field: "AI/ML" covers ML, NLP, LLM and data science work; others
// match their own words in the job title or a bullet
const FIELD_PATTERNS = [
  [/\b(ai|ml|ai\/ml|machine learning|artificial intelligence|deep learning|generative ai|genai|nlp|llms?)\b/i, /\b(ai|ml|machine learning|artificial intelligence|deep learning|generative ai|genai|nlp|llms?|rag|xgboost|pytorch|tensorflow|scikit-learn|models?)\b/i],
  [/\bdata science\b/i, /\b(data scien\w*|machine learning|statistic\w*|models?|xgboost|scikit-learn)\b/i],
  [/\bdata engineering\b/i, /\b(data engineer\w*|data pipelines?|etl|spark|pyspark|airflow|kafka)\b/i],
  [/\bsoftware\b/i, /\b(software|engineer|developer|backend|full[- ]stack|apis?|microservices?)\b/i]
];
// Returns { jobs, verified }: verified is false when the field is one the
// engine can't recognize in job text ("acute care"), so every professional job
// was counted and the report says so
function jobsInField(jobs, field) {
  if (field.broad) return { jobs, verified: true };
  const skillsOf = (part) => termsOf(part).filter((term) => !BROAD_TERMS.has(term.toLowerCase()) && !/^(ai\/ml|development|engineering)$/i.test(term));
  const fieldOf = (part) => FIELD_PATTERNS.find(([asks]) => asks.test(part));
  let parts = field.label.split(/\s*,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+(?=[a-z/]+\s+(?:engineering|development|science|analytics)\b)/i).filter(Boolean);
  // "software or data engineering" -> "software engineering", "data engineering"
  const suffix = (parts[parts.length - 1].match(/\s(engineering|development|science|analytics)$/i) || [])[1];
  if (suffix) parts = parts.map((part) => (/\s/.test(part) ? part : `${part} ${suffix}`));
  // "AI agents, agentic workflows, or autonomous AI solutions": the named skills
  // and fields set the scope; a vague item doesn't widen it to all AI work
  // A field counts as named only when the item is just the field ("data science"),
  // not a phrase that mentions it ("autonomous AI solutions")
  const pureField = (part) => fieldOf(part) && part.toLowerCase().split(/\s+/).every((word) => /^(software|data|ai|ml|ai\/ml|machine|learning|artificial|intelligence|deep|nlp|engineering|development|science|analytics|hands-on|applied)$/.test(word));
  const named = parts.filter((part) => skillsOf(part).length || pureField(part));
  if (named.length) parts = named;
  const shows = (text, part) => {
    // The broad pattern only for a pure field ("AI/ML development"); "AI agents" needs agent work
    const known = pureField(part) || !skillsOf(part).length ? fieldOf(part) : null;
    if (known && known[1].test(text)) return true;
    // Specific skills ("AI agents"): the job must show them (LangGraph counts for agents)
    return skillsOf(part).some((term) => {
      const key = relationFor(EQUIVALENT, term, true);
      return [term, ...aliasesOf(term), ...(key ? EQUIVALENT[key] : [])].some((name) => mentions(text, name)) || bulletsRewording(term, [{ text }]).length > 0;
    }) || (!known && !skillsOf(part).length && (mentions(text, part) || bulletsRewording(part, [{ text }]).length > 0));
  };
  const matched = jobs.filter((job) => parts.some((part) => shows(`${job.title}\n${job.bullets.join("\n")}`, part)));
  // A field the engine doesn't know and no job names: it can't be told apart, so all jobs count, unverified
  const recognizable = parts.some((part) => fieldOf(part) || skillsOf(part).some((term) => isKnown(term)));
  if (!matched.length && !recognizable) return { jobs, verified: false };
  return { jobs: matched, verified: true };
}

// Within this many years of a minimum is a near-match: labeled, not credited in full
const YEARS_TOLERANCE = 1.5;

// Coverage = min(100%, demonstrated / requested), from professional jobs in the
// field (overlaps once, internships apart). Status: Met / Below minimum (a
// near-match within the tolerance) / Strict requirement unmet / Unknown. A
// strict minimum is also an eligibility gate; a shortfall is never hidden.
function yearsResult(requirement, { jobs, otherYears, tolerance = YEARS_TOLERANCE }) {
  const dated = jobs.filter((job) => job.start);
  const { jobs: relevant, verified } = jobsInField(dated, requirement.field);
  const years = experienceYears(relevant);
  const excluded = dated.filter((job) => !relevant.includes(job)).map((job) => job.organization);
  const score = dated.length ? Math.min(1, years / requirement.minYears) : 0;
  const shortfall = Math.max(0, Math.round((requirement.minYears - years) * 10) / 10);
  const status = !dated.length ? "Unknown" : years >= requirement.minYears ? "Met" : requirement.strict ? "Strict requirement unmet" : "Below minimum";
  const nearMatch = status !== "Met" && status !== "Unknown" && shortfall <= tolerance;
  const classification = status === "Unknown" ? "Can't be counted" : status === "Met" ? "Meets the requirement" : nearMatch ? "Strong near-match" : score >= 0.5 ? "Partial experience" : "Well below the requirement";
  const field = requirement.field.broad ? "" : requirement.field.label;
  const documented = `${years} of ${requirement.minYears} years documented${field ? ` in ${field}` : ""}`;
  const advice = status === "Met" || status === "Unknown" ? ""
    : requirement.strict ? "The employer says this minimum is strict, so a shortfall may screen you out."
      : nearMatch ? "Consider applying if the employer treats the experience requirement flexibly."
        : requirement.acceptsEquivalent ? "The job says it accepts equivalent experience or education, so this may still qualify."
          : "Some employers accept equivalent experience or education.";
  return {
    text: `${requirement.minYears}+ years${field ? ` of ${field.length > 60 ? `${field.slice(0, 59)}…` : field}` : " of experience"}`, category: requirement.importance, kind: "years",
    wording: requirement.strict ? "mandatory" : requirement.importance === "preferred" ? "preferred" : "required",
    status, nearMatch, classification,
    years: { requested: requirement.minYears, demonstrated: years, shortfall, coverage: Math.round(score * 100), tolerance, field: field || "any professional work", excluded, ...(verified ? {} : { fieldVerified: false }) },
    match: status === "Met" ? "direct" : score > 0 ? "partial" : "missing",
    score: Math.round(score * 100) / 100,
    confidence: !dated.length ? "none" : verified ? "high" : "moderate",
    evidence: relevant.slice(0, 3).map((job) => ({ text: `${job.title} at ${job.organization} (${job.dates})`, where: "Job dates", source: "work" })),
    note: `${status === "Unknown" ? "No readable job dates, so years couldn't be counted" : `${classification}: ${documented}${shortfall ? ` (${shortfall} short; coverage ${Math.round(score * 100)}%)` : ""}`}. Counted from professional jobs, overlapping periods once${verified ? "" : `; which jobs were in ${field} couldn't be confirmed from their wording, so all professional jobs were counted`}${excluded.length ? `; not in this field: ${excluded.join(", ")}` : ""}${otherYears ? `; ${otherYears} more in internships or similar not counted` : ""}. Dates are used as written.`,
    ...(status !== "Met" ? { reason: status === "Unknown" ? "Job dates couldn't be read." : `${documented}. ${advice}` } : {})
  };
}

// ---- The Equivalence agent (optional) ----

const EQUIVALENCE_PROMPT = [
  "You check whether a resume shows a technology a job asks for under another name.",
  "terms are what the job asks for; bullets are numbered resume bullets.",
  "For each term, if one bullet uses a technology that is the same thing, a part of it, or a close substitute,",
  "give the bullet number and the technology's name exactly as written in that bullet.",
  "relation, one of: \"equivalent\" (the same thing), \"subskill\" (a part of the term that shows it),",
  "\"related\" (same area, not a substitute), \"unrelated\". Skip terms with no such bullet; never stretch",
  "(a RAG framework isn't computer vision; caching isn't model evaluation).",
  "Never guess: the technology must appear word for word in the bullet.",
  "relationship: one sentence on what the two share and what they don't.",
  'Reply with JSON only: {"matches": [{"term": string, "bullet": number, "technology": string, "relation": string, "relationship": string}]}'
].join("\n");

// Code's check on an agent's claim: the cited bullet must itself say
// something of the term (a word of it, in any form, or its concept's
// wording). LangChain cited for "computer vision" fails; it earns nothing.
function supportedRelation(term, bullet) {
  const concept = conceptFor(term);
  if (concept && bulletsShowingConcept(concept, [bullet]).length) return true;
  const roots = term.toLowerCase().split(/[\s/-]+/).filter((word) => word.length > 3 && !STOPWORDS.has(word) && !GENERIC_TERMS.has(word)).map(rootOf);
  const tokens = new Set((bullet.text.toLowerCase().match(/[a-z][a-z0-9+#]*/g) || []).map(rootOf));
  return roots.some((root) => tokens.has(root));
}

// Suggestions for terms the tables can't connect, each verified against the
// cited bullet: the named technology must be in it. Map term -> { tool, bullet }
async function semanticFallback({ llm, evidence, lines, onProgress, signal }) {
  const terms = uniqueTerms(lines.flatMap(termsOf)).filter((term) => matchTerm(term, evidence).match === "missing").slice(0, 10);
  const verified = new Map();
  if (!terms.length) return verified;

  onProgress("Equivalence agent: checking unfamiliar requirements against your bullets");
  try {
    const bullets = evidence.bullets.slice(0, 40);
    const reply = await llm.invokeJson(EQUIVALENCE_PROMPT, { terms, bullets: bullets.map((bullet, index) => ({ number: index, text: bullet.text })) }, signal);
    for (const match of Array.isArray(reply.matches) ? reply.matches : []) {
      const term = terms.find((item) => typeof match?.term === "string" && item.toLowerCase() === match.term.trim().toLowerCase());
      const bullet = bullets[match?.bullet];
      const tool = typeof match?.technology === "string" ? match.technology.trim() : "";
      if (!term || !bullet || tool.length < 2 || tool.length > 40 || sameTerm(tool, term)) continue;
      if (GENERIC_TERMS.has(tool.toLowerCase()) || STOPWORDS.has(tool.toLowerCase())) continue;
      // Traceable: the technology must be in the cited bullet, word for word
      if (!mentions(bullet.text, tool)) continue;
      const relation = ["equivalent", "subskill", "related"].find((kind) => kind === String(match.relation || "").trim().toLowerCase());
      if (!relation) continue;
      verified.set(term.toLowerCase(), { tool, bullet, relation, supported: supportedRelation(term, bullet), relationship: typeof match.relationship === "string" ? match.relationship.trim().slice(0, 240) : "" });
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  return verified;
}

// ---- Parsing checks ----

// What the parser may have read wrong: bullets under the wrong employer,
// dates that conflict. These are parsing issues, not qualification gaps.
function parsingIssuesOf(resume) {
  const issues = [];
  const jobs = resume.experience.filter((item) => item.organization !== "Resume");
  const nameOf = (organization) => organization.replace(/\(.*?\)/g, " ").split(/[\s,|]+/).find((word) => word.length >= 4 && /^[A-Z]/.test(word));
  for (const job of jobs) {
    for (const other of jobs) {
      const name = other === job ? null : nameOf(other.organization);
      if (name && job.bullets.some((bullet) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(bullet))) {
        issues.push(`A bullet under ${job.organization} mentions ${name}; check it was read under the right employer.`);
      }
    }
    const start = job.start ? job.start.year * 12 + (job.start.month || 1) : null;
    const end = job.end ? job.end.year * 12 + (job.end.month || 12) : null;
    if (start && end && end < start) issues.push(`Dates for ${job.organization} end before they start; flag for review.`);
    const now = new Date();
    if (start && start > now.getFullYear() * 12 + now.getMonth() + 1) issues.push(`${job.organization} starts in the future; check the dates.`);
    if (!job.start && job.organization !== "Unnamed job") issues.push(`No readable dates for ${job.organization}.`);
    if (!job.bullets.length) issues.push(`No bullets were read under ${job.organization}; they may have been attached to another job.`);
  }
  // Two full-time jobs overlapping a lot can be real, or misread dates
  const ranges = jobs.filter((job) => job.start && !NOT_PROFESSIONAL.test(job.title))
    .map((job) => ({ job, start: job.start.year * 12 + (job.start.month || 1), end: job.current ? Infinity : job.end ? job.end.year * 12 + (job.end.month || 12) : null }))
    .filter((range) => range.end);
  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      const overlap = Math.min(ranges[i].end, ranges[j].end) - Math.max(ranges[i].start, ranges[j].start);
      if (overlap > 6 && Number.isFinite(overlap)) issues.push(`${ranges[i].job.organization} and ${ranges[j].job.organization} overlap by ${overlap} months; fine if concurrent, otherwise check the dates.`);
    }
  }
  return [...new Set(issues)];
}

// ---- The comparison ----

// resume: parseResumeText() output (or a built resume); llm optional.
// Returns the Job Match Assessment (see the report fields at the end).
// confirmations: the candidate's answers about inferred or unconfirmed skills,
// { "git": "yes", "team collaboration": "no" }
// jobTitle, company: what the candidate typed; otherwise read from the job
// yearsTolerance: how many years short still counts as a near-match (labeled, not credited)
// "Two (2) to four (4) years", "three years": written-out numbers as digits,
// so years requirements are read the same however they're written
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
const NUMBER_WORD = `\\b(${Object.keys(NUMBER_WORDS).join("|")})\\b`;
function digitsForNumbers(text) {
  return String(text || "")
    .replace(new RegExp(`${NUMBER_WORD}\\s*\\((\\d{1,2})\\)`, "gi"), "$2")
    .replace(new RegExp(`${NUMBER_WORD}(?=\\s*\\+?\\s*(?:(?:-|–|to)\\s*(?:\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})\\s*\\+?\\s*)?(?:years?|yrs)\\b)`, "gi"), (word) => String(NUMBER_WORDS[word.toLowerCase()]));
}

async function compareResume({ resume, jobDescription: givenDescription, llm = null, onProgress = () => {}, signal, confirmations = {}, jobTitle: givenTitle = "", company: givenCompany = "", yearsTolerance = YEARS_TOLERANCE }) {
  const notes = [];
  const jobDescription = digitsForNumbers(givenDescription);
  const job = jobSections(jobDescription);
  const jobWords = wordsOf(jobDescription);
  let aiKeywords = [];
  let aiFamily = "";

  if (llm) {
    onProgress("JD Analyst agent: reading the job's requirements, duties and qualifications");
    try {
      const reply = await llm.invokeJson(ANALYST_PROMPT, { jobDescription: jobDescription.slice(0, 6000) }, signal);
      aiFamily = typeof reply.roleFamily === "string" ? reply.roleFamily : "";
      aiKeywords = (Array.isArray(reply.keywords) ? reply.keywords : [])
        .filter((term) => typeof term === "string" && term.trim().length >= 2 && term.split(/\s+/).length <= 4 && mentions(jobDescription, term.trim()))
        .map((term) => term.trim());
      // Rules first; the agent fills in what they missed, in the job's own words
      if (job.responsibilities.length < 3) {
        const extra = (Array.isArray(reply.responsibilities) ? reply.responsibilities : []).filter((text) => typeof text === "string" && fromJob(text, jobWords));
        job.responsibilities.push(...extra.filter((text) => !job.responsibilities.some((kept) => bestBullet(text, [{ words: wordsOf(kept) }]).score > 0.6)));
      }
      if (job.required.length + job.preferred.length < 3) {
        for (const item of Array.isArray(reply.qualifications) ? reply.qualifications : []) {
          if (typeof item?.text !== "string" || !fromJob(item.text, jobWords)) continue;
          job[item.importance === "preferred" ? "preferred" : "required"].push(item.text);
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      notes.push("The AI couldn't read the job; used its headings and wording only.");
    }
  }

  const evidence = resumeEvidence(resume);
  evidence.confirmations = new Map(Object.entries(confirmations || {})
    .filter(([key, value]) => typeof key === "string" && key.length <= 80 && ["yes", "no"].includes(value))
    .map(([key, value]) => [key.toLowerCase(), value]));
  const info = jobInfoOf(jobDescription);
  const jobTitle = String(givenTitle || "").trim().slice(0, 120) || info.title || jobTitleOf(jobDescription);
  // The whole job, for reading a requirement in context ("Python, JavaScript, Java")
  evidence.job = {
    text: jobDescription,
    junior: /\b(junior|jr\.?|entry[- ]level|associate|graduate)\b/i.test(jobTitle) || /\b0\s*(?:-|–|to)\s*[1-4]\s*\+?\s*(?:years?|yrs)\b/i.test(jobDescription),
    senior: /\b(senior|sr\.?|staff|principal|lead)\b/i.test(jobTitle)
  };
  const family = familyOf(jobTitle, job, aiFamily);
  // Requirements about the role family's core work weigh a little more
  // (after duplicates are removed, so a repeated requirement isn't boosted twice)
  const familyWeight = (text) => (family && family[2].test(text) && !isGenericSkillLine(text) ? 1.15 : 1);

  // Duplicate requirements are consolidated (most of their words shared)
  const dedupe = (list) => list.filter((text, index) => !list.slice(0, index).some((other) => bestBullet(text, [{ words: wordsOf(other) }]).score >= 0.8));

  // Eligibility conditions and hiring steps aren't scored qualifications
  const ELIGIBILITY_ONLY = /\b(authori[sz]ed to work|work authori[sz]ation|sponsorship|visa|citizen\w*|green card|clearance|public trust|background check|drug (screen|test)|relocat\w*|travel|ppe|personal protective|safety (regulations|policies|requirements|rules)|eh&s|ehs)\b/i;
  // A requirement line asks for something: a skill, tool, credential or ability
  const asksForSomething = (text) => QUALIFICATION_WORDS.test(text) || termsOf(text).length > 0 || /\b(ability|able to|knowledge|skills?|proficien\w*|understanding)\b/i.test(text);
  for (const key of ["required", "preferred"]) job[key] = job[key].filter((text) => !ELIGIBILITY_ONLY.test(text) && asksForSomething(text));
  job.responsibilities = job.responsibilities.filter((text) => !ELIGIBILITY_ONLY.test(text));

  // Years and degree are measured separately below
  // A years line is measured as years; one that also names skills
  // ("2+ years building AI agents") keeps its skills as a requirement
  // A field ("in software or data engineering") belongs to the years; only skills and tools stay
  const FIELD = /(engineering|science|development|analytics|discipline|field|industry|experience)$/i;
  const isYears = (text) => (YEARS_OF_EXPERIENCE.test(text) || yearsRequirements(text, { preferred: [] }).length > 0) && !termsOf(text.replace(YEARS_OF_EXPERIENCE, "").replace(YEARS_MENTION, "")).filter((term) => !GENERIC_TERMS.has(term.toLowerCase()) && !BROAD_TERMS.has(term.toLowerCase()) && !FIELD.test(term)).length;
  const isDegree = (text) => DEGREES.some(([, , pattern]) => pattern.test(text)) || /\bdegree\b/i.test(text);

  // Professional years (overlaps counted once; internships and the like apart)
  const professional = resume.experience.filter((item) => !NOT_PROFESSIONAL.test(`${item.title} ${item.organization}`));
  const years = experienceYears(professional);
  const otherYears = Math.max(0, Math.round((experienceYears(resume.experience) - years) * 10) / 10);

  const degreeItem = findQualifications(jobDescription).find((item) => item.kind === "degree");
  // Only real "N years of experience" wording counts as a years requirement
  const yearsItems = yearsRequirements(jobDescription, job);
  const yearsItem = yearsItems[0] || null;
  // "0 to 4 years": a range with no minimum describes the level, it isn't a bar
  const yearsRange = !yearsItem && jobDescription.match(/\b0\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?|yrs)\b/i);
  if (yearsRange) notes.push(`The job gives an experience range of 0–${yearsRange[1]} years: no minimum to meet, so it isn't scored.`);
  const datedJobs = resume.experience.filter((item) => item.start).length;

  // The Equivalence agent, for terms the tables don't connect to the resume
  const requiredLines = dedupe(job.required).filter((text) => !(isDegree(text) && degreeItem) && !isYears(text)).slice(0, 15);
  const duties = dedupe(job.responsibilities).slice(0, 15);
  const preferredLines = dedupe(job.preferred).filter((text) => !(isDegree(text) && degreeItem) && !isYears(text)).slice(0, 12);
  if (llm && evidence.bullets.length) {
    evidence.semantic = await semanticFallback({ llm, evidence, lines: [...requiredLines, ...duties, ...preferredLines], onProgress, signal });
  }

  // Each requirement is scored once, in the highest category that asks for
  // it (required, then responsibilities, then preferred): a later line whose
  // every concept is already scored ("Prompt engineering and RAG" after "LLM
  // engineering such as prompt design, RAG") is shown as a duplicate.
  // Within a line, each term is scored once too (claimed).
  const claimed = new Map();
  const scoredIds = [];
  const once = (category, scorer) => (text) => {
    const asked = requirementText(text);
    const terms = termsOf(asked);
    const ids = WORK_PRACTICE.test(text) ? ["ai coding tools"] : terms.map(canonicalOf).filter((id) => !BROAD_TERMS.has(id));
    // A line that asks for more than its terms ("Design, develop, and deploy
    // AI tools that improve operations") is its own requirement
    const extra = WORK_PRACTICE.test(text) ? 0 : [...contextOf(asked, terms)].filter((word) => !ACTION_VERBS.has(word)).length;
    // One extra word is allowed only beside two or more concepts ("Prompt engineering and
    // RAG integration"); "Python-based API integration" is not "Python development"
    const earlier = ids.length && (extra === 0 || (extra === 1 && ids.length >= 2)) ? scoredIds.find((entry) => ids.every((id) => entry.ids.has(id))) : null;
    if (earlier) {
      return { text, category, kind: "duplicate", duplicate: true, wording: wordingOf(text), match: "direct", score: 0, confidence: "none", evidence: [], duplicateOf: earlier.text, reason: `Already scored as "${earlier.text.slice(0, 90)}"; not counted twice.` };
    }
    const item = scorer(text);
    if (ids.length) scoredIds.push({ ids: new Set(ids), text });
    return item;
  };
  const required = requiredLines.map(once("required", (text) => scoreQualification(text, evidence, "required", claimed)));
  // Each years requirement is its own item, measured on its own field
  const yearsResults = yearsItems.map((item) => yearsResult(item, { jobs: professional, otherYears, tolerance: yearsTolerance }));
  required.unshift(...yearsResults.filter((item) => item.category === "required"));

  // Responsibilities, capability by capability
  const responsibilities = duties.map(once("responsibilities", (text) => scoreResponsibility(text, evidence, claimed)));

  // Preferred qualifications: optional advantages, never minimums
  const preferred = preferredLines.map(once("preferred", (text) => scoreQualification(text, evidence, "preferred", claimed)));
  preferred.unshift(...yearsResults.filter((item) => item.category === "preferred"));

  // The Evidence agent: duties worded differently from the bullets
  if (llm && duties.length && evidence.bullets.length) {
    onProgress("Evidence agent: matching the job's duties to your bullets");
    try {
      const reply = await llm.invokeJson(EVIDENCE_PROMPT, {
        responsibilities: duties.map((text, index) => ({ number: index, text })),
        bullets: evidence.bullets.slice(0, 40).map((bullet, index) => ({ number: index, text: bullet.text }))
      }, signal);
      for (const match of Array.isArray(reply.matches) ? reply.matches : []) {
        const item = responsibilities[match?.responsibility];
        // Only single duties; split ones keep their capability-by-capability scores
        if (!item || item.kind !== "duty") continue;
        const accepted = validateEvidenceClaim(match, item.text, evidence.bullets.slice(0, 40));
        if (!accepted) continue;
        const value = Math.round((accepted.level === "strong" ? 0.9 : 0.5) * sourceFactor(accepted.bullet, 2) * 100) / 100;
        if (value > item.score) {
          const { explanation } = accepted;
          Object.assign(item, {
            score: value, match: accepted.level === "strong" ? "related" : "partial", confidence: "moderate", byAgent: true, needsReview: true,
            agentExplanation: explanation,
            evidence: [{ text: accepted.bullet.text, where: accepted.bullet.where, source: accepted.bullet.source, by: "Evidence agent" }],
            reason: `Evidence agent: ${explanation.capability}${explanation.relationship ? ` (${explanation.relationship})` : ""}${explanation.unsupported.length ? `. Not demonstrated: ${explanation.unsupported.join(", ")}` : ""}. Needs review (${Math.round(value * 100)}%).`
          });
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  // Domain alignment
  // Not from benefits text ("vision insurance" isn't the insurance industry)
  const skipped = new Set(job.ignored || []);
  const domain = domainAlignment(jobDescription.split(/\r?\n/).filter((line) => !skipped.has(line.trim())).join("\n"), resume, evidence);

  // Education
  const degree = degreeLevel(resume.education);
  // "Bachelor's degree or equivalent experience": several years of
  // professional work may stand in for a missing degree, as the job says
  const degreeSentence = jobDescription.split(/(?<=[.!?])\s+|\n+/).find((text) => isDegree(text)) || "";
  const equivalentDegree = degreeItem && degree < degreeItem.level && EQUIVALENT_CLAUSE.test(degreeSentence) && years >= 4;
  const education = degreeItem ? [{
    text: degreeItem.text, category: "education", kind: "degree", wording: degreeItem.importance === "preferred" ? "preferred" : "required",
    match: degree >= degreeItem.level ? "direct" : equivalentDegree ? "equivalent" : degree ? "partial" : "missing",
    score: degree >= degreeItem.level ? 1 : equivalentDegree ? 0.85 : degree ? 0.5 : 0,
    ...(equivalentDegree ? { reason: `The job accepts equivalent experience; ${years} years of professional work documented.` } : {}),
    confidence: degree ? "high" : "none",
    evidence: equivalentDegree
      ? [{ text: `${years} years of professional experience`, where: "Job dates", source: "work" }]
      : resume.education.slice(0, 2).map((item) => ({ text: item.degree, where: "Education", source: "listed" })),
    note: degree >= degreeItem.level ? "" : equivalentDegree ? "No degree on the resume; credited through equivalent experience, which the job says it accepts." : degree ? "The resume shows a lower degree than asked." : "No degree found on the resume. Equivalent experience may be accepted; the job decides."
  }] : [];

  // Weights within each category: wording depth and role family
  // Duplicates are shown but weigh nothing
  // Importance as the job states it ("is required", "a plus", "optional"); optional weighs half
  const importanceFor = (item) => job.importance?.[item.text] || { required: "required", responsibilities: "responsibility", preferred: "preferred", domain: "context", education: item.wording === "preferred" ? "preferred" : "required" }[item.category];
  const weigh = (item) => {
    const importance = importanceFor(item);
    return {
      ...item, importance, ...(job.groups?.[item.text] ? { group: job.groups[item.text] } : {}), ...satisfactionOf(item),
      weight: item.duplicate || item.unverified ? 0 : Math.round(WORDING_WEIGHT[item.wording || "required"] * familyWeight(item.text) * (importance === "optional" ? 0.5 : 1) * 100) / 100
    };
  };
  const lists = { required, responsibilities, preferred, domain: domain ? [domain] : [], education };
  // Before anything is weighed: every piece of evidence must be exact resume
  // text (and gets its section); a credit with no valid evidence is removed
  const provenance = checkProvenance(Object.values(lists).flat(), evidence);
  const unsupported = removeUnsupported(Object.values(lists).flat());
  const categories = {};
  for (const [key, items] of Object.entries(lists)) {
    const weighted = items.map(weigh);
    categories[key] = { key, label: CATEGORY_LABELS[key], baseWeight: BASE_WEIGHTS[key], items: weighted, score: categoryScore(weighted, key) };
    if (key === "preferred" && weighted.some((item) => item.weight)) categories[key].expected = PREFERRED_EXPECTED;
  }

  // Inapplicable categories share their weight out proportionally
  const applicable = Object.values(categories).filter((category) => category.score !== null);
  const totalBase = applicable.reduce((sum, category) => sum + category.baseWeight, 0);
  for (const category of Object.values(categories)) {
    category.weight = category.score === null ? 0 : Math.round((1000 * category.baseWeight) / totalBase) / 1000;
    category.contribution = category.score === null ? 0 : Math.round(category.score * category.weight * 10) / 10;
  }
  // What each requirement adds to the overall score, and what a shortfall
  // costs. Scaled so they add up to the category's result (preferred
  // qualifications past the expected share cost nothing).
  for (const category of Object.values(categories)) {
    const total = category.items.reduce((sum, item) => sum + item.weight, 0);
    const raw = total ? category.items.reduce((sum, item) => sum + item.weight * item.score, 0) / total : 0;
    const result = (category.score ?? 0) / 100;
    const gained = raw ? result / raw : 0;
    const lost = raw < 1 ? (1 - result) / (1 - raw) : 0;
    for (const item of category.items) {
      const share = total ? (category.weight * item.weight) / total : 0;
      item.points = Math.round(share * item.score * gained * 1000) / 10;
      item.pointsLost = Math.round(share * (1 - item.score) * lost * 1000) / 10;
    }
  }
  const overall = applicable.length ? Math.round(Object.values(categories).reduce((sum, category) => sum + (category.score ?? 0) * category.weight, 0)) : 0;
  // One scoring record per requirement; its explanation is written from the record
  for (const category of Object.values(categories)) {
    for (const item of category.items) {
      item.record = recordOf(item);
      item.explanation = explanationOf(item);
    }
  }
  // Job fit on what can be assessed: parts that only need confirmation (teamwork
  // not described, Agile not established) are left out instead of counted as 0
  for (const category of Object.values(categories)) {
    // fitScore null: nothing in the item can be assessed yet (only "needs confirmation")
    const fitOf = (item) => ("fitScore" in item ? item.fitScore : item.score);
    const assessable = category.items.filter((item) => item.weight > 0 && fitOf(item) !== null);
    const total = assessable.reduce((sum, item) => sum + item.weight, 0);
    const rawFit = total ? assessable.reduce((sum, item) => sum + item.weight * fitOf(item), 0) / total : null;
    category.fitScore = rawFit === null ? null : Math.round(1000 * (category.key === "preferred" ? Math.min(1, rawFit / PREFERRED_EXPECTED) : rawFit)) / 10;
  }
  const fitCategories = Object.values(categories).filter((category) => category.fitScore !== null);
  const fitBase = fitCategories.reduce((sum, category) => sum + category.baseWeight, 0);
  const fit = fitBase ? Math.round(fitCategories.reduce((sum, category) => sum + category.fitScore * category.baseWeight, 0) / fitBase) : 0;
  const redistributed = applicable.length < 5;

  // Hard eligibility, separate from the score
  const eligibility = eligibilityOf(jobDescription, evidence);
  // A years minimum is an eligibility gate only when the employer says it's strict
  yearsItems.forEach((item, index) => {
    if (!item.strict) return;
    const result = yearsResults[index];
    eligibility.push({
      condition: "Minimum years of experience (strict)", text: item.sentence,
      status: result.status === "Unknown" ? "Unknown" : result.status === "Met" ? "Met" : "Not Met",
      detail: `${result.years.demonstrated} of ${item.minYears} years documented${result.years.field !== "any professional work" ? ` in ${result.years.field}` : ""}; the job says this minimum is non-negotiable.`
    });
  });
  const blocked = eligibility.filter((item) => item.status === "Not Met");
  const [, classification, recommendation] = BANDS.find(([floor]) => overall >= floor);

  const seniority = seniorityOf({ jobTitle, jobDescription, minYears: yearsItem?.minYears, resume, years });
  const header = jobHeader(jobDescription, jobTitle, seniority);
  header.company = String(givenCompany || "").trim().slice(0, 80) || info.company || header.company;
  header.from = { title: givenTitle ? "you" : "job description", company: givenCompany ? "you" : "job description" };

  // Keyword coverage, for the ATS check (not part of the fit score)
  const onlyPreferred = (term) => job.preferred.some((item) => mentions(item, term)) && ![...job.required, ...job.responsibilities].some((item) => mentions(item, term));
  const keywordItems = uniqueTerms([...dictionaryKeywords(jobDescription), ...phrasesFrom([...job.required, ...job.preferred, ...job.responsibilities]), ...aiKeywords])
    .slice(0, 25)
    .map((term) => {
      const result = matchTerm(term, evidence);
      // ATS software matches the job's own wording, so an equivalent or related tool isn't the keyword
      const present = result.match === "direct" || result.match === "listed";
      return { text: term, importance: onlyPreferred(term) ? "preferred" : priorityOf(jobDescription, term), present, match: result.match, via: result.via, where: result.evidence.map((item) => item.where) };
    });
  const keywordWeight = (item) => (item.importance === "preferred" ? 0.5 : item.importance === "critical" ? 1.5 : 1);
  const keywordTotal = keywordItems.reduce((sum, item) => sum + keywordWeight(item), 0);
  const keywords = {
    items: keywordItems,
    score: keywordTotal ? Math.round((100 * keywordItems.reduce((sum, item) => sum + (item.present ? keywordWeight(item) : 0), 0)) / keywordTotal) : null
  };

  // Findings
  const allItems = Object.values(categories).flatMap((category) => category.items);
  const termRows = allItems.flatMap((item) => (item.terms || []).map((term) => ({ ...term, requirement: item.text, category: item.category, owner: item })));
  // What an answer could change: the requirement's lost points, shared
  // among its parts. An unscored practice is priced as if it were counted.
  const unitsOf = (item) => Math.max(1, (item.terms || []).filter((term) => !term.alternative).length + (item.capabilities || []).length);
  const impactOf = (item) => {
    if (item.unverified) {
      const category = categories[item.category];
      const total = category.items.reduce((sum, other) => sum + other.weight, 0);
      const weight = WORDING_WEIGHT[item.wording || "required"];
      return Math.round((category.weight * weight) / (total + weight) * CREDIT_CONFIRMED[1] * 1000) / 10;
    }
    return Math.round(((item.pointsLost || 0) / unitsOf(item)) * 10) / 10;
  };
  // Only questions whose answer could matter (an answered one stays, so it can be changed)
  const MATERIAL = 0.3;
  const findings = {
    direct: uniqueBy(termRows.filter((term) => term.match === "direct").map((term) => term.term)),
    equivalent: termRows.filter((term) => term.match === "equivalent").map((term) => ({ requirement: term.term, evidence: term.via })),
    partial: [
      ...termRows.filter((term) => ["related", "partial", "listed"].includes(term.match)).map((term) => ({ requirement: term.term, match: term.match, via: term.via, note: term.note || (term.match === "listed" ? "Listed, but not shown in any work." : "") })),
      ...responsibilities.flatMap((item) => (item.capabilities || []).filter((capability) => capability.score > 0 && capability.score < 0.95).map((capability) => ({ requirement: `${capability.capability} (${item.text.slice(0, 60)})`, match: capability.match, note: "Only partly shown." })))
    ],
    // Missing evidence isn't proof of missing ability: "not demonstrated"
    gaps: uniqueBy([
      ...[...categories.required.items, ...categories.responsibilities.items, ...categories.education.items].filter((item) => item.match === "missing" && !item.duplicate).map((item) => item.text),
      ...termRows.filter((term) => term.match === "missing" && term.category === "required" && !term.uncertain && !term.alternative).map((term) => term.term),
      ...responsibilities.flatMap((item) => (item.capabilities || []).filter((capability) => capability.match === "missing").map((capability) => `${capability.capability}: ${item.text.slice(0, 70)}`))
    ]).slice(0, 12),
    preferredGaps: uniqueBy(categories.preferred.items.filter((item) => item.match === "missing").map((item) => item.text)),
    eligibilityFlags: eligibility.filter((item) => item.status !== "Met"),
    parsingIssues: parsingIssuesOf(resume),
    // Possible evidence the engine couldn't interpret: zero provisional credit, review manually
    uncertain: termRows.filter((term) => term.match === "uncertain").map((term) => ({ term: term.term, requirement: term.requirement, bullet: term.evidence[0]?.text, where: term.evidence[0]?.where })),
    // Agent judgments that passed the source checks but need a person to confirm
    needsReview: [
      ...allItems.filter((item) => item.needsReview).map((item) => ({ requirement: item.text, explanation: item.agentExplanation, evidence: item.evidence[0] })),
      ...termRows.filter((term) => term.needsReview).map((term) => ({ requirement: term.term, explanation: { relationship: term.note }, evidence: term.evidence[0] }))
    ],
    // Credited provisionally from the work shown; worth confirming
    inferred: termRows.filter((term) => term.match === "inferred").map((term) => ({ term: term.term, requirement: term.requirement, from: term.via, note: term.note })),
    // Plausible but not established (Agile from team delivery): no credit, no gap
    toConfirm: termRows.filter((term) => term.match === "confirm").map((term) => ({ term: term.term, requirement: term.requirement, from: term.via, note: term.note })),
    // What the candidate can answer: inferred and unconfirmed skills, and teamwork
    confirmable: mergeByKey([
      ...termRows.filter((term) => ["inferred", "confirm", "confirmed"].includes(term.match) || evidence.confirmations.has(term.term.toLowerCase()))
        .map((term) => ({ key: term.term.toLowerCase(), label: term.term, kind: term.match === "confirm" ? "confirm" : "inferred", from: term.via || "", requirement: term.requirement, impact: impactOf(term.owner), question: term.question || `Have you used ${term.term} in your work?` })),
      ...allItems.flatMap((item) => (item.capabilities || []).map((capability) => ({ capability, item }))).filter(({ capability }) => capability.confirmKey && capability.match !== "direct")
        .map(({ capability, item }) => ({ key: capability.confirmKey, label: capability.capability, kind: "confirm", from: "", requirement: item.text, impact: impactOf(item), question: "Did your work involve collaborating with engineers, clients or business stakeholders?" })),
      // Can't be judged from a resume (AI coding tools): the candidate says
      ...allItems.filter((item) => item.kind === "practice" && item.confirmKey)
        .map((item) => ({ key: item.confirmKey, label: "AI coding tools", kind: "unverified", from: "", requirement: item.text, impact: impactOf(item), question: "Do you use AI coding tools such as Claude Code, GitHub Copilot or Cursor when you build software?" }))
    ]).map((entry) => ({ ...entry, answer: evidence.confirmations.get(entry.key) || null }))
      .filter((entry) => entry.answer || entry.impact >= MATERIAL)
      .sort((a, b) => b.impact - a.impact),
    // Can't be judged from a resume either way (AI coding tools): not scored
    unverified: allItems.filter((item) => item.unverified && !item.confirmedByCandidate).map((item) => item.text),
    seniority: seniority.flags,
    domain: domain?.note ? [domain.note] : [],
    // Inconsistencies on the resume itself, for review (not scored)
    contradictions: contradictionsOf(resume, years, evidence)
  };

  // Quality control before the score is reported
  const quality = qualityChecks({ categories, allItems, jobDescription, eligibility, unsupported, overall, provenance });
  if (!responsibilities.length) notes.push("Couldn't find a responsibilities section in the job; its weight was shared out to the other categories.");
  if (family) notes.push(`Read as a ${family[0]} role (${family.how}): requirements about its core work weigh 15% more within their category.`);

  return {
    overall,
    // Evidence-based score (overall) vs job fit on what can be assessed (fit)
    fit,
    needsConfirmation: findings.confirmable.filter((entry) => !entry.answer && entry.kind === "confirm").length,
    classification,
    recommendation: blocked.length ? `${recommendation}, but a mandatory requirement isn't met` : recommendation,
    blocked: blocked.map((item) => item.condition),
    header,
    roleFamily: family?.[0] || "",
    categories,
    weights: { redistributed, note: redistributed ? `Categories that don't apply (${Object.values(categories).filter((category) => category.score === null).map((category) => category.label).join(", ")}) had their weight shared out proportionally.` : "" },
    eligibility,
    seniority,
    years: {
      professional: years, other: otherYears,
      required: yearsItem ? { minYears: yearsItem.minYears, status: yearsResults[0].status, strict: yearsItem.strict, nearMatch: yearsResults[0].nearMatch, shortfall: yearsResults[0].years.shortfall, coverage: yearsResults[0].years.coverage } : null,
      requirements: yearsResults.map((item) => ({ text: item.text, ...item.years, status: item.status, classification: item.classification, importance: item.category }))
    },
    findings,
    keywords,
    profile: profileOf(resume, jobDescription),
    // Structural headings found in the job and left out of scoring
    // and asks the job says aren't needed ("no prior experience required"), left out of scoring
    structure: { headings: job.headings || [], excluded: job.excluded || [] },
    // Required items the resume doesn't show
    gaps: findings.gaps.slice(0, 8),
    quality,
    notes
  };
}

const uniqueBy = (list) => [...new Set(list)];
// One question per skill; its impact adds up over every requirement that names it
const mergeByKey = (list) => {
  const kept = new Map();
  for (const entry of list) {
    const earlier = kept.get(entry.key);
    if (earlier) earlier.impact = Math.round((earlier.impact + entry.impact) * 10) / 10;
    else kept.set(entry.key, { ...entry });
  }
  return [...kept.values()];
};

// Capability coverage (the score: how much of what's asked is shown,
// including transferable credit) is kept apart from requirement
// satisfaction: a compound requirement with any part not demonstrated
// ("OAuth2 authentication for REST APIs" with only REST APIs shown) is Not
// satisfied, whatever its coverage. Returns { satisfaction, covered, unmet }.
function satisfactionOf(item) {
  if (item.duplicate) return {};
  const covered = [];
  const unmet = [];
  if (item.unverified) return { satisfaction: item.confirmedByCandidate ? "Confirmed by you" : "Unverified", covered, unmet };
  // "Azure or AWS": one alternative covers the group; none means the group is unmet
  const alternativeGroups = (item.logic || []).filter((group) => group.mode === "any" && group.terms.length > 1);
  for (const group of alternativeGroups) {
    const chosen = (item.terms || []).filter((term) => (group.chosen || [group.best]).includes(term.term));
    const shown = chosen.filter((term) => term.score > 0);
    // Alternatives tied with the chosen one ("Azure and AWS, both listed") are covered too
    const tied = (item.terms || []).filter((term) => group.terms.includes(term.term) && !chosen.includes(term) && term.score > 0 && term.score === Math.min(...shown.map((each) => each.score)));
    covered.push(...[...shown, ...tied].map((term) => term.term));
    // "at least two of": one shown out of two needed leaves the rest unmet
    if (shown.length < chosen.length || !shown.length) unmet.push(`${group.operator?.startsWith("at least") ? `${group.operator} ` : ""}${group.terms.join(" / ")}`);
  }
  const grouped = new Set(alternativeGroups.flatMap((group) => group.terms));
  const toConfirm = [];
  for (const term of item.terms || []) {
    if (grouped.has(term.term)) continue;
    // Plausible from the work but not established: confirm it, don't call it a gap
    if (term.match === "confirm") toConfirm.push(term.term);
    else (term.score > 0 ? covered : unmet).push(term.term);
  }
  for (const capability of item.capabilities || []) {
    if (capability.match === "confirm") toConfirm.push(capability.capability);
    else (capability.score > 0 ? covered : unmet).push(capability.capability);
  }
  if (item.capability?.asks?.length) {
    const asked = item.capability.asks.join(", ");
    if (item.capability.score === 0) unmet.push(asked);
    else covered.push(asked);
  }
  if (item.kind === "years" && item.status !== "Met") unmet.push(item.status === "Unknown" ? "readable job dates" : `${item.text} (${item.status.toLowerCase()})`);
  if ((item.kind === "degree" || item.kind === "domain") && item.score === 0) unmet.push(item.text);

  // "Python, JavaScript, Java": met if any one is needed, not if all are. Most
  // likely "any one" and one is shown: likely satisfied; otherwise say so, don't decide
  if (item.ambiguity && item.ambiguity.likely !== "all" && item.ambiguity.asAny >= 0.95 && item.ambiguity.asAll < 0.95) {
    const likely = item.ambiguity.likely === "any";
    const others = likely ? unmet.filter((name) => (item.terms || []).some((term) => term.term === name && term.alternativeLikely)) : [];
    return { satisfaction: likely ? "Likely satisfied" : "Ambiguous", covered, unmet: unmet.filter((name) => !others.includes(name)), ...(others.length ? { probablyNotNeeded: others } : {}), ...(toConfirm.length ? { toConfirm } : {}) };
  }
  const satisfaction = unmet.length || (item.score === 0 && !toConfirm.length) ? "Not satisfied" : toConfirm.length ? "Needs confirmation" : item.score >= 0.95 ? "Satisfied" : "Partly satisfied";
  return { satisfaction, covered, unmet, ...(toConfirm.length ? { toConfirm } : {}) };
}

// A requirement's scoring record: four separate things, never mixed up
//   coverage      how much of what's asked has any support (0-1)
//   strength      how credible and detailed that support is (confidence)
//   credited      the score after every adjustment, and its points
//   verification  resume-demonstrated, candidate-confirmed, inferred,
//                 unverified, or not shown
function recordOf(item) {
  const parts = [...(item.terms || []).filter((term) => !term.alternative && !term.alternativeLikely), ...(item.capabilities || [])];
  const coverage = item.kind === "years" ? (item.years?.coverage ?? 0) / 100
    : item.duplicate ? null
      : parts.length ? parts.filter((part) => part.score > 0).length / parts.length : item.score;
  const matches = parts.length ? parts.map((part) => part.match) : [item.match];
  const confirmed = item.confirmedByCandidate || parts.some((part) => part.confirmedByCandidate || part.match === "confirmed");
  const resume = matches.some((match) => ["direct", "equivalent", "related", "partial", "listed"].includes(match)) || (item.kind === "years" && item.status === "Met") || ((item.kind === "degree" || item.kind === "domain" || item.kind === "capabilities" || item.kind === "duty") && item.score > 0 && !confirmed);
  const inferred = matches.some((match) => match === "inferred");
  const toConfirm = matches.some((match) => match === "confirm");
  let verification = "not shown";
  if (item.duplicate) verification = "counted elsewhere";
  else if (item.unverified && !confirmed) verification = "unverified";
  else if (confirmed) verification = resume ? "resume-demonstrated + candidate-confirmed" : "candidate-confirmed";
  else if (resume) verification = inferred ? "resume-demonstrated, partly inferred" : toConfirm ? "resume-demonstrated, partly needs confirmation" : "resume-demonstrated";
  else if (inferred) verification = "inferred";
  else if (toConfirm) verification = "needs confirmation";
  return {
    coverage: coverage === null ? null : Math.round(coverage * 100) / 100,
    strength: item.confidence || "none",
    credited: item.score, points: item.points ?? 0, pointsLost: item.pointsLost ?? 0,
    verification, importance: item.importance
  };
}

const pct = (value) => `${Math.round(value * 100)}%`;
const MATCH_WORDS = { equivalent: "shown by an equivalent", related: "shown by a related tool", inferred: "inferred", partial: "partly shown", listed: "listed only", confirmed: "confirmed by you" };
// The explanation, from the record alone (plus the reason the scorer gave)
function explanationOf(item) {
  const record = item.record;
  if (item.duplicate) return `Counted once elsewhere${item.duplicateOf ? ` ("${item.duplicateOf.slice(0, 80)}")` : ""}; adds and costs nothing here.`;
  if (item.weight === 0) return `${record.verification === "unverified" ? "Unverified" : "Confirmed by you"}; not counted in the score.`;
  const lead = `${record.verification[0].toUpperCase()}${record.verification.slice(1)}, ${record.importance}.`;
  const coverage = record.coverage === null ? "" : ` ${pct(record.coverage)} of what's asked has support; evidence strength ${record.strength}.`;
  // Never below 0: a requirement not shown earns 0 of what it could
  const credit = ` Credited ${pct(record.credited)}: ${record.points} of ${Math.round((record.points + record.pointsLost) * 10) / 10} pts.`;
  // What the shortfall is, from the same record
  const short = [
    item.unmet?.length ? `not shown: ${item.unmet.join(", ")}` : "",
    item.toConfirm?.length ? `to confirm: ${item.toConfirm.join(", ")}` : "",
    item.probablyNotNeeded?.length ? `probably not needed: ${item.probablyNotNeeded.join(", ")}` : "",
    item.ambiguity ? `the list could mean any one or all; both readings weighed (${pct(item.ambiguity.interpretations?.[0]?.confidence ?? 0.5)} any one)` : "",
    item.kind === "years" && item.years?.shortfall ? `${item.years.shortfall} years short of ${item.years.requested}` : "",
    // Parts credited below full, each with how it's shown
    ...[...(item.terms || []).filter((term) => !term.alternative && !term.alternativeLikely), ...(item.capabilities || [])]
      .filter((part) => part.score > 0 && part.score < 1)
      .map((part) => `${part.term || part.capability} ${(MATCH_WORDS[part.match] || part.match)} (${pct(part.score)})`),
    item.capability && item.capability.score < 1 ? `${item.capability.asks.join(", ")} ${item.capability.score ? "only partly" : "not"} shown` : "",
  ].filter(Boolean);
  // Nothing itemized (domain, degree, a duty matched by wording): the scorer's own reason
  if (!short.length && item.reason) short.push(item.reason.split(/(?<=\.)\s/)[0].replace(/\.$/, ""));
  return `${lead}${coverage}${credit}${short.length && record.pointsLost ? ` Why: ${short.join("; ")}.` : ""}`;
}

// Displayed numbers must agree: satisfaction with coverage, labels with
// scores, item points with the category result, categories with the overall
const VALID_MATCHES = new Set(["direct", "equivalent", "related", "inferred", "partial", "listed", "uncertain", "confirm", "confirmed", "missing"]);
function auditScores(categories, overall) {
  const issues = [];
  for (const category of Object.values(categories)) {
    for (const item of category.items) {
      const label = item.text.slice(0, 60);
      if (item.satisfaction === "Satisfied" && item.score < 0.95) issues.push(`${label}: "Satisfied" at ${pct(item.score)}`);
      if (item.satisfaction === "Not satisfied" && item.score >= 0.95 && !item.unmet?.length) issues.push(`${label}: "Not satisfied" at ${pct(item.score)} with nothing unmet`);
      if (item.match === "missing" && item.score > 0) issues.push(`${label}: "Not demonstrated" but credited ${pct(item.score)}`);
      for (const part of [...(item.terms || []), ...(item.capabilities || [])]) {
        if (!VALID_MATCHES.has(part.match)) issues.push(`${label}: unknown match type "${part.match}"`);
        if (part.match === "missing" && part.score > 0) issues.push(`${label}: ${part.term || part.capability} "Not demonstrated" but credited`);
      }
      if (item.points < 0 || item.pointsLost < 0) issues.push(`${label}: negative points`);
    }
    if (category.score === null) continue;
    const points = category.items.reduce((sum, item) => sum + item.points, 0);
    const lost = category.items.reduce((sum, item) => sum + item.pointsLost, 0);
    const slack = 0.1 * category.items.length + 0.2;
    if (Math.abs(points - category.score * category.weight) > slack) issues.push(`${category.label}: item points add up to ${points.toFixed(1)}, the category gives ${(category.score * category.weight).toFixed(1)}`);
    if (Math.abs(points + lost - category.weight * 100) > slack) issues.push(`${category.label}: points and deductions add up to ${(points + lost).toFixed(1)} of ${(category.weight * 100).toFixed(1)}`);
  }
  const total = Object.values(categories).reduce((sum, category) => sum + (category.score ?? 0) * category.weight, 0);
  if (Math.abs(total - overall) > 0.5) issues.push(`Categories add up to ${total.toFixed(1)}, the overall is ${overall}`);
  return issues;
}

// Things on the resume that don't agree with each other: dates that run
// backwards or into the future, a summary's years that the dated jobs don't
// add up to, full-time jobs held at the same time for long, and expertise
// claimed in the summary that no bullet shows. Reported for review; the
// score isn't changed by them.
function contradictionsOf(resume, professionalYears, evidence, now = new Date()) {
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const found = [];
  const name = (item) => [item.title, item.organization].filter(Boolean).join(" at ");
  for (const item of resume.experience) {
    const start = monthOf(item.start);
    const end = item.current ? thisMonth : monthOf(item.end);
    if (start !== null && end !== null && end < start) found.push({ kind: "dates", detail: `${name(item)} ends (${item.dates}) before it starts.` });
    if (start !== null && start > thisMonth) found.push({ kind: "dates", detail: `${name(item)} starts in the future (${item.dates}).` });
  }
  // The summary's own count: "4 years of experience", "5+ years"
  const claim = String(resume.summary || "").match(/\b(\d{1,2})\+?\s*(?:years?|yrs)(?:['’])?\s+(?:of\s+)?(?:[\w/&-]+\s+){0,3}?experience\b/i);
  if (claim && resume.experience.some((item) => item.start)) {
    const said = Number(claim[1]);
    if (Math.abs(said - professionalYears) >= 2) found.push({ kind: "years", detail: `The summary says ${said} years of experience; the dated professional jobs add up to ${professionalYears}.` });
  }
  // Two full-time jobs overlapping by more than 3 months (contracting or a handover can explain it)
  const full = resume.experience.filter((item) => !NOT_PROFESSIONAL.test(`${item.title} ${item.organization}`) && item.start && !/\b(part[- ]time|contract|freelance|consult\w*|adjunct|volunteer)\b/i.test(`${item.title} ${item.dates}`));
  for (let first = 0; first < full.length; first += 1) {
    for (let second = first + 1; second < full.length; second += 1) {
      const [a, b] = [full[first], full[second]];
      const overlap = Math.min(a.current ? thisMonth : monthOf(a.end) ?? thisMonth, b.current ? thisMonth : monthOf(b.end) ?? thisMonth) - Math.max(monthOf(a.start), monthOf(b.start));
      if (overlap > 3) found.push({ kind: "overlap", detail: `${name(a)} and ${name(b)} overlap by ${overlap} months; if one was part-time or a contract, say so.` });
    }
  }
  // "Expert in Rust" in the summary with no bullet showing Rust
  for (const match of String(resume.summary || "").matchAll(/\b(?:expert(?:ise)?|advanced|deep (?:expertise|knowledge))\s+(?:in|with)\s+([^.;]+)/gi)) {
    for (const term of match[1].split(/\s*,\s*|\s+and\s+/).map((part) => part.trim()).filter((part) => part && part.split(/\s+/).length <= 4)) {
      if (!bulletsNaming([term], evidence.bullets).length) found.push({ kind: "claim", detail: `The summary claims expertise in ${term}, but no bullet shows it.` });
    }
  }
  return found;
}

// Checks run before a score is reported; any failure is shown, not hidden
// Evidence provenance: each cited text must be on the resume word for word
// (a bullet, a title, or a line of the skills, summary, education,
// certifications, projects or contact sections). Computed facts (job dates)
// are exempt. Citations that fail are dropped and listed; every citation
// gets its section.
const SECTION_OF_SOURCE = { work: "Experience", internship: "Experience", project: "Projects" };
function checkProvenance(items, evidence) {
  const squash = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const corpus = [...evidence.bullets, ...evidence.titles, ...evidence.lines].map((entry) => squash(entry.text));
  const onResume = (text) => {
    const wanted = squash(text);
    return Boolean(wanted) && corpus.some((source) => source.includes(wanted));
  };
  const problems = [];
  const check = (entries, label) => (entries || []).filter((entry) => {
    if (entry.where === "Job dates") return true;
    if (!onResume(entry.text)) {
      problems.push(`${label}: "${String(entry.text).slice(0, 60)}" isn't on the resume`);
      return false;
    }
    entry.section = entry.section || SECTION_OF_SOURCE[entry.source] || entry.where;
    return true;
  });
  for (const item of items) {
    if (item.kind === "years") continue;
    const label = item.text.slice(0, 60);
    if (item.evidence) item.evidence = check(item.evidence, label);
    for (const part of [...(item.terms || []), ...(item.capabilities || [])]) part.evidence = check(part.evidence, label);
    if (item.capability?.evidence) {
      const [kept] = check([item.capability.evidence], label);
      item.capability.evidence = kept || null;
    }
  }
  return problems;
}

// A credited requirement needs evidence; anything without is set to missing.
// The candidate's own confirmation is evidence too (self-reported, and
// labeled so), never resume evidence.
function removeUnsupported(items) {
  let fixed = 0;
  for (const item of items) {
    const selfReported = item.confirmedByCandidate || item.terms?.some((term) => term.confirmedByCandidate) || item.capabilities?.some((capability) => capability.confirmedByCandidate);
    const hasEvidence = item.kind === "years" || item.kind === "domain" || selfReported || item.evidence?.length || item.terms?.some((term) => term.evidence.length) || item.capabilities?.some((capability) => capability.evidence.length);
    if (item.score > 0 && !hasEvidence) {
      Object.assign(item, { score: 0, match: "missing" });
      fixed += 1;
    }
  }
  return fixed;
}

function qualityChecks({ categories, allItems, jobDescription, eligibility, unsupported: fixed, overall, provenance }) {
  const audit = auditScores(categories, overall);
  const weightSum = Object.values(categories).reduce((sum, category) => sum + category.weight, 0);
  const jobWords = wordsOf(jobDescription);
  const fromThisJob = allItems.filter((item) => item.kind !== "years" && item.kind !== "degree" && item.kind !== "domain").every((item) => fromJob(item.text, jobWords));
  return [
    { check: "Category weights sum to 100%", passed: Math.abs(weightSum - 1) < 0.01 },
    { check: "Every scored requirement comes from the job description", passed: fromThisJob },
    { check: "Every credited requirement has resume evidence", passed: fixed === 0, detail: fixed ? `${fixed} unsupported credit${fixed === 1 ? "" : "s"} removed.` : "" },
    { check: "Every piece of evidence is exact resume text, with its section", passed: provenance.length === 0, detail: provenance.slice(0, 3).join(" | ") },
    { check: "Coverage, deductions, category scores and the overall agree", passed: audit.length === 0, detail: audit.slice(0, 4).join(" | ") },
    { check: "Equivalent and related technologies are labeled, not counted as identical", passed: true },
    { check: "Required and preferred qualifications are scored separately", passed: true },
    { check: "Hard eligibility conditions are reported separately", passed: true, detail: eligibility.length ? "" : "None stated in the job." }
  ];
}

module.exports = { YEARS_TOLERANCE, compareResume, jobSections, profileOf, matchTerm, capabilitiesOf };
