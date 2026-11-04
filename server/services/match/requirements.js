const { dictionaryKeywords } = require("../resume/skillDictionary");
const { isSkillKeyword, mentions } = require("../resume/atsRules");
const { knownSkill } = require("../resume/resumeQuality");
const { categoryForSkill } = require("./matchModel");

// Finds a job's requirements without AI: known skills, behavioral needs
// (product collaboration, communication, leadership) and qualifications
// (years of experience, degree). The AI step can add more, but only with
// terms that really appear in the job description.

const PREFERRED = /(preferred|prefer|nice to have|a plus|bonus|desirable|ideally|familiarity)/i;
const EMPHASIS = /\b(primar(y|ily)|core|must|essential|central|main|key|heavily|focus on)\b/i;

const sentencesOf = (text) => text.split(/(?<=[.!?\n])\s+|\n+/).filter((sentence) => sentence.trim());

// How central a skill is to the job:
//   critical   named in 3+ sentences, or tied to the role's main work
//              ("primarily leverage Databricks Apps")
//   preferred  only mentioned as preferred / a plus
//   required   otherwise
function priorityOf(jobDescription, term) {
  const sentences = sentencesOf(jobDescription).filter((sentence) => mentions(sentence, term));
  if (!sentences.length) return "required";

  const emphasized = sentences.some((sentence) => EMPHASIS.test(sentence) && !PREFERRED.test(sentence));
  if (sentences.length >= 3 || emphasized) return "critical";
  return sentences.every((sentence) => PREFERRED.test(sentence)) ? "preferred" : "required";
}

// The job keywords that are critical to it
const criticalKeywords = (jobDescription, keywords) =>
  keywords.filter((keyword) => priorityOf(jobDescription, keyword) === "critical");

// Behavioral requirements: what to look for in the job and in the resume
const BEHAVIORAL = [
  {
    text: "Collaboration with product and business stakeholders",
    category: "product_collaboration",
    inJob: /(product (managers?|teams?|owners?)|cross[- ]functional|stakeholders?|business (needs|teams|partners))/i,
    evidence: /(product (managers?|teams?|owners?)|cross[- ]functional|stakeholders?|partnered|collaborat|business (needs|teams|requirements))/i
  },
  {
    text: "Communication of technical work",
    category: "product_collaboration",
    inJob: /(communicat|present(ing|ations)?|explain|document(ation)?)/i,
    evidence: /(present(ed|ations)?|communicat|documented|demo(ed|s)?|workshops?|explained)/i
  },
  {
    text: "Leadership and mentoring",
    category: "product_collaboration",
    inJob: /(mentor|lead(ing|ership)? (a |the )?(team|engineers|projects?)|technical leadership)/i,
    evidence: /(mentored|led|leading|managed|coached|supervised)/i
  },
  {
    text: "Responsible AI, governance and compliance",
    category: "security_governance",
    inJob: /(responsible ai|governance|complian|privacy|guardrails?|safety|ethic)/i,
    evidence: /(guardrails?|governance|complian|privacy|pii|redact|safety|responsible ai|audit)/i
  }
];

const DEGREES = [
  ["phd", 3, /(ph\.?\s?d|doctor(ate|al))/i],
  ["master", 2, /(\bmaster('?s)?\b|\bm\.?s\.?\b|\bmsc\b|m\.?tech|\bmba\b)/i],
  ["bachelor", 1, /(\bbachelor('?s)?\b|\bb\.?s\.?\b|\bbsc\b|b\.?tech|\bb\.?e\.?\b|undergraduate degree)/i]
];

// Lines count as sentences too: a "Preferred" heading lower down mustn't
// make a degree on its own line preferred
const sentenceWith = (text, term) =>
  text.split(/(?<=[.!?])\s+|\n+/).find((sentence) => mentions(sentence, term)) || "";

function findQualifications(jobDescription) {
  const requirements = [];

  // "5+ years", "3-5 years", "at least 4 years of experience"
  const years = [...jobDescription.matchAll(/(\d{1,2})\s*(?:\+|-\s*\d{1,2})?\s*(?:years?|yrs)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value <= 20);
  if (years.length) {
    const minYears = Math.min(...years);
    requirements.push({
      id: "years",
      text: `${minYears}+ years of experience`,
      category: "qualifications",
      importance: "required",
      kind: "years",
      minYears
    });
  }

  const degree = DEGREES.find(([, , pattern]) => pattern.test(jobDescription));
  if (degree) {
    const [name, level] = degree;
    const sentence = sentenceWith(jobDescription, name === "phd" ? "PhD" : name);
    requirements.push({
      id: "degree",
      text: `${name === "phd" ? "PhD" : `${name[0].toUpperCase()}${name.slice(1)}'s degree`} or higher`,
      category: "qualifications",
      importance: PREFERRED.test(sentence) ? "preferred" : "required",
      kind: "degree",
      level
    });
  }

  return requirements;
}

function baselineRequirements(jobDescription, { extraSkills = [], targetTitle = "" } = {}) {
  const skills = dictionaryKeywords(jobDescription, extraSkills)
    .filter((keyword) => isSkillKeyword(keyword, targetTitle))
    .map((term) => ({
      id: `skill:${term.toLowerCase()}`,
      text: term,
      terms: [term],
      category: categoryForSkill(term),
      importance: priorityOf(jobDescription, term),
      kind: "skill"
    }));

  const behavioral = BEHAVIORAL
    .filter((need) => need.inJob.test(jobDescription))
    .map((need) => ({
      id: `behavior:${need.text.toLowerCase()}`,
      text: need.text,
      category: need.category,
      importance: "required",
      kind: "behavioral",
      pattern: need.evidence.source
    }));

  return [...skills, ...behavioral, ...findQualifications(jobDescription)];
}

// Adds the AI's requirements to the baseline: the AI proposes, code checks.
// Accepted only in technical categories, and each term must be a known
// skill that appears in the job text. Behavioral needs and qualifications
// stay rule-based, so titles, places and loose words never become
// requirements.
const AI_CATEGORIES = ["core_ai_ml", "software_engineering", "cloud_mlops", "security_governance"];
// Too broad to check ("AI" usually comes from the job title)
const TOO_GENERIC = new Set(["artificial intelligence", "software", "technology", "data", "cloud"]);

function mergeAiRequirements(baseline, aiRequirements, jobDescription) {
  const merged = [...baseline];
  // Already asked for, under this name or another ("RAG" = "Retrieval-Augmented Generation")
  const same = (a, b) => mentions(a, b) || mentions(b, a) || (knownSkill(a) && knownSkill(a) === knownSkill(b));
  const covered = (term) => merged.some((item) => (item.terms || [item.text]).some((known) => same(known, term)));

  for (const item of Array.isArray(aiRequirements) ? aiRequirements : []) {
    if (!item || typeof item.text !== "string" || !AI_CATEGORIES.includes(item.category)) continue;

    const terms = (Array.isArray(item.terms) ? item.terms : [])
      .filter((term) => typeof term === "string" && term.trim().length > 1 && term.length <= 40)
      .filter((term) => mentions(jobDescription, term.trim()) && isSkillKeyword(term.trim()))
      .map((term) => knownSkill(term))
      .filter((term) => term && !TOO_GENERIC.has(term.toLowerCase()));

    if (!terms.length || terms.every(covered)) continue;

    merged.push({
      id: `ai:${terms[0].toLowerCase()}`,
      text: terms.join(" / "),
      terms,
      category: item.category,
      importance: item.importance === "preferred" ? "preferred" : "required",
      kind: "skill"
    });
  }

  return merged.slice(0, 40);
}

module.exports = { baselineRequirements, mergeAiRequirements, criticalKeywords, priorityOf, findQualifications, PREFERRED, DEGREES };
