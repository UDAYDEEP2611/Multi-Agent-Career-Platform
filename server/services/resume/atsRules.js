// Rule-based ATS checks. These run without AI, so every resume gets the
// same review, and they decide which bullets the agent should rewrite.

const { qualityIssues } = require("./resumeQuality");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FIRST_PERSON = /^(i|i'm|i've|my|me|we|our)\b/i;
const WEAK_START = /^(responsible for|worked on|working on|helped|helping|assisted|assisting|involved in|tasked with|duties included|participated in|utilized|utilizing|leveraged|leveraging|used|using|was |did )/i;
const MAX_BULLET = 200;
const MIN_BULLET = 25;

function formatDate(date) {
  if (!date) return "";
  return date.month ? `${MONTHS[date.month - 1]} ${date.year}` : String(date.year);
}

const dateRange = (item) => {
  const start = formatDate(item.start);
  const end = item.current ? "Present" : formatDate(item.end);
  return [start, end].filter(Boolean).join(" – ");
};

// Tidies a bullet: no leading symbols, capital first letter, ends with a period
// A tag list at the end of a task: "... requests. (Machine Learning, Python, AWS)."
// Notes for the portfolio, not resume text
const TRAILING_TAGS = /\s*\((?:[A-Za-z0-9+#./& -]{1,30},\s*)+[A-Za-z0-9+#./& -]{1,30}\)\s*\.?\s*$/;

function cleanBullet(text) {
  const bullet = String(text || "")
    .replace(/^\s*[-•*▪◦\d.)]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_TAGS, "")
    .replace(/[\s,;:]+$/, "");

  if (!bullet) return "";
  const capitalized = bullet[0].toUpperCase() + bullet.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

// Numbers (counts, percentages, money) mentioned in a text
const numbersIn = (text) =>
  new Set((String(text || "").match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, "")));

// The AI may reword a bullet but not invent results: every number in its
// version must already appear somewhere in the user's own text
function inventsNumbers(bullet, sourceText) {
  const allowed = numbersIn(sourceText);
  return [...numbersIn(bullet)].some((n) => !allowed.has(n));
}

function bulletProblems(bullet, max = MAX_BULLET) {
  const problems = [];
  if (FIRST_PERSON.test(bullet)) problems.push("starts with a first-person word (I, my, we)");
  if (WEAK_START.test(bullet)) problems.push("starts with a weak phrase; lead with an action verb");
  if (bullet.length > max) problems.push(`is longer than ${max} characters`);
  if (bullet.length < MIN_BULLET) problems.push("is very short; say what you did and the result");
  return problems;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Lowercase, with "-", "_" and "/" read as spaces ("CI/CD" = "ci cd")
const normalize = (text) => String(text).toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ");

// Whole-word match that ignores case and plurals ("LLMs" matches "LLM")
function mentions(text, keyword) {
  let base = normalize(keyword).trim();
  if (!base) return false;

  const acronymPlural = /[A-Z]s$/.test(keyword.trim());
  if (base.endsWith("s") && (acronymPlural || (base.length > 4 && !/(ss|us|is)$/.test(base)))) {
    base = base.slice(0, -1);
  }

  return new RegExp(`(^|[^a-z0-9+#])${escapeRegex(base)}s?($|[^a-z0-9+#])`).test(normalize(text));
}

// Job-description words that aren't skills: pay, perks, location, work
// arrangement, years of experience, job titles and plain verbs. The model
// is told to skip these; this catches the ones it returns anyway.
const NOT_SKILLS = new Set([
  "design", "develop", "deploy", "build", "implement", "manage", "maintain", "create", "support",
  "lead", "drive", "deliver", "collaborate", "communicate", "analyze", "improve", "ensure", "own",
  "experience", "team", "teams", "responsibilities", "requirements", "qualifications",
  "full time", "part time", "contract", "internship", "salary range", "competitive salary"
]);

function isSkillKeyword(keyword, targetTitle = "") {
  const text = keyword.trim();
  const lower = normalize(text).trim();

  if (!lower || NOT_SKILLS.has(lower)) return false;
  if (targetTitle && lower === normalize(targetTitle).trim()) return false;
  if (/[$€£₹]|\d{2,3},\d{3}|\b\d+\s?k\b/i.test(text)) return false;
  if (/salary|compensation|\bpay\b|bonus|equity|benefit|insurance|paid time|vacation|\bpto\b|401|perks|stipend/i.test(text)) return false;
  if (/\b(on ?site|remote|hybrid|in office|relocat|travel|visa|sponsor)/i.test(lower)) return false;
  if (/\b\d+\+?\s*(years?|yrs)\b|\b(bachelor|master|degree|phd)\b/i.test(text)) return false;
  // "Wellesley, MA", "Austin, Texas"
  if (/^[A-Z][A-Za-z.'\s]+,\s*[A-Z][A-Za-z]+$/.test(text)) return false;
  // Job titles: "AI Solutions Engineer", "Data Analyst"
  if (text.split(/\s+/).length >= 2 &&
    /\b(engineer|developer|manager|analyst|specialist|director|intern|associate|architect|consultant|scientist|officer|coordinator)s?$/i.test(text)) {
    return false;
  }

  return true;
}

function resumeText(resume) {
  return [
    resume.summary,
    ...resume.experience.flatMap((item) => [item.title, ...item.bullets]),
    ...resume.projects.flatMap((item) => [item.title, ...item.bullets, ...(item.skills || [])]),
    ...resume.education.flatMap((item) => [item.degree, item.fieldOfStudy, ...item.bullets, ...(item.courses || [])]),
    ...resume.skills.technical,
    ...resume.skills.soft,
    ...Object.values(resume.extras || {}).flat().map((item) =>
      typeof item === "string" ? item : [item.title, item.subtitle, ...item.bullets].join(" "))
  ].join(" \n ").toLowerCase();
}

// The technical areas an AI/ML engineer's experience should show, and the
// words in bullets that show each one
const TECH_AREAS = [
  ["Machine Learning", /(feature engineering|train(ed|ing)? (a |the )?model|model (training|selection|validation)|xgboost|scikit|pytorch|tensorflow|classif|regression|predict)/i],
  ["Generative AI", /(llm|prompt|context engineering|tool calling|function calling|structured output|generative|gpt|claude|openai|gemini)/i],
  ["RAG", /(\brag\b|retrieval|chunk|embedding|vector|rerank|grounded)/i],
  ["Agentic AI", /(agent|langgraph|crewai|autogen|\bmcp\b|\ba2a\b|orchestrat|human-in-the-loop|approval)/i],
  ["Backend", /(fastapi|flask|django|rest|api\b|apis\b|endpoint|microservice|validation|node\.js|express)/i],
  ["MLOps", /(mlflow|experiment tracking|model serving|serving|drift|model monitoring|feature pipeline|sagemaker|vertex ai)/i],
  ["LLMOps", /(ragas|groundedness|langsmith|langfuse|arize|phoenix|tracing|regression test|llm-as-judge|evaluation)/i],
  ["Cloud/DevOps", /(docker|kubernetes|k8s|ci\/cd|terraform|aws|azure|gcp|oci|cloud|observability|uptime)/i],
  ["Security", /(rbac|pii|audit|prompt[- ]injection|least[- ]privilege|guardrail|encryption|access control|permission)/i]
];

function technicalAreas(resume) {
  const bullets = [...resume.experience, ...resume.projects].flatMap((item) => item.bullets);
  return TECH_AREAS.map(([area, pattern]) => ({ area, shown: bullets.some((bullet) => pattern.test(bullet)) }));
}

// Returns { score, keywordCoverage, matchedKeywords, missingKeywords, areas,
// issues: [{ level, section, itemId, message }], rewrite: [{ kind, id, feedback }] }
function reviewResume(resume, keywords = []) {
  const issues = [];
  const rewrite = [];
  const add = (level, section, message, itemId = null) => issues.push({ level, section, itemId, message });

  // Details the user chose to hide aren't reported as missing
  const { contact } = resume;
  const shown = (key) => resume.showContact?.[key] !== false;
  if (!contact.email && shown("email")) add("error", "Contact", "Add an email address in your Profile.");
  if (!contact.email && !shown("email")) add("warning", "Contact", "Recruiters need a way to reach you; consider showing your email.");
  if (!contact.phone && shown("phone")) add("warning", "Contact", "Add a phone number in your Profile.");
  if (!contact.location && shown("location")) add("warning", "Contact", "Add your city and state/country in your Profile; many recruiters filter by location.");

  if (resume.sections.summary) {
    const words = (resume.summary.match(/\S+/g) || []).length;
    if (!words) add("warning", "Summary", "The summary is empty.");
    else if (words < 60) add("warning", "Summary", `The summary has ${words} words; aim for 75–100.`);
    else if (words > 110) add("warning", "Summary", `The summary has ${words} words; keep it to 75–100.`);
    if (FIRST_PERSON.test(resume.summary) || /\b(I|my)\b/.test(resume.summary)) {
      add("warning", "Summary", "Avoid \"I\" and \"my\" in the summary.");
    }
  }

  const checkBullets = (kind, section, item, label) => {
    const feedback = [];

    if (!item.bullets.length) add("warning", section, `${label}: add ${kind === "project" ? "a description or a task" : "a few bullet points"}.`, item.id);
    else if (kind === "experience" && item.bullets.length < 2) add("warning", section, `${label}: aim for 3–5 bullet points.`, item.id);
    if (item.bullets.length > 6) add("warning", section, `${label}: more than 6 bullets; keep the strongest.`, item.id);

    item.bullets.forEach((bullet, index) => {
      // Experience and project bullets may run to two lines
      bulletProblems(bullet, kind === "project" ? 300 : 260).forEach((problem) => {
        add("warning", section, `${label}, bullet ${index + 1} ${problem}.`, item.id);
        feedback.push(`Bullet "${bullet.slice(0, 80)}" ${problem}.`);
      });
    });

    if (!item.start && kind === "experience") add("warning", section, `${label}: add dates.`, item.id);
    if (feedback.length) rewrite.push({ kind, id: item.id, feedback });
  };

  resume.experience.forEach((item) =>
    checkBullets("experience", "Experience", item, `${item.title} at ${item.organization}`));
  resume.projects.forEach((item) =>
    checkBullets("project", "Projects", item, item.title));

  // Each bullet should open with its own verb; later repeats get rewritten
  const seenVerbs = new Set();
  [["experience", resume.experience], ["project", resume.projects]].forEach(([kind, list]) => list.forEach((item) => {
    const repeats = item.bullets
      .map((bullet) => (bullet.match(/^[A-Za-z-]+/) || [""])[0])
      .filter((verb) => {
        const key = verb.toLowerCase();
        if (!key) return false;
        const repeated = seenVerbs.has(key);
        seenVerbs.add(key);
        return repeated;
      });
    if (!repeats.length) return;

    const label = kind === "experience" ? `${item.title} at ${item.organization}` : item.title;
    add("warning", kind === "experience" ? "Experience" : "Projects", `${label}: "${repeats.join('", "')}" already starts another bullet; vary the verbs.`, item.id);
    const target = rewrite.find((entry) => entry.id === item.id);
    const feedback = `Bullets start with verbs used elsewhere (${repeats.join(", ")}); use different verbs.`;
    if (target) target.feedback.push(feedback);
    else rewrite.push({ kind, id: item.id, feedback: [feedback] });
  }));

  // Recruiters look for quantified results (numbers, percentages, data)
  const experienceBullets = resume.experience.flatMap((item) => item.bullets);
  if (experienceBullets.length >= 3 && !experienceBullets.some((bullet) => /\d/.test(bullet))) {
    add("warning", "Experience", "No bullet has a number. Add measurable results (%, time saved, users, $) to your portfolio tasks.");
  }

  if (resume.sections.skills && resume.skills.technical.length + resume.skills.soft.length === 0) {
    add("warning", "Skills", "No skills are included.");
  }
  if (resume.skills.technical.length > 30) {
    add("warning", "Skills", "More than 30 technical skills; keep the ones that match the job.");
  }

  // Placeholder text, misspellings, skill typos, incomplete dates
  issues.push(...qualityIssues(resume));

  const text = resumeText(resume);
  const matchedKeywords = keywords.filter((keyword) => mentions(text, keyword));
  const missingKeywords = keywords.filter((keyword) => !mentions(text, keyword));
  const keywordCoverage = keywords.length ? Math.round((matchedKeywords.length / keywords.length) * 100) : null;

  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.length - errors;
  // Readability only: how cleanly the resume parses and reads. How well it
  // fits a job is the job-match score (services/match), kept separate.
  const score = 100 - errors * 15 - Math.min(warnings * 4, 40);

  return {
    areas: technicalAreas(resume),
    score: Math.max(0, Math.min(100, score)),
    keywordCoverage,
    matchedKeywords,
    missingKeywords,
    issues,
    rewrite
  };
}

module.exports = {
  formatDate,
  dateRange,
  cleanBullet,
  inventsNumbers,
  bulletProblems,
  mentions,
  isSkillKeyword,
  resumeText,
  reviewResume
};
