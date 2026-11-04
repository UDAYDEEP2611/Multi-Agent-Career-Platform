const catalog = require("../../scripts/skillCatalogData");
const { editDistance } = require("../../utils/skillSimilarity");

// Content checks a human reviewer would catch: skill names written in a
// nonstandard way ("OracleSQL"), the same skill twice ("OCI" and "Oracle
// Cloud Infrastructure"), placeholder text left in ("FLKSS"), and common
// misspellings ("Deployement").

// "Oracle SQL", "oracle-sql" and "OracleSQL" share the key "oraclesql"
const compactKey = (name) => String(name).toLowerCase().replace(/[^a-z0-9+#]/g, "");

const catalogByKey = new Map(catalog.map((skill) => [compactKey(skill.name), skill.name]));

// Different names for one skill; the first is the name shown. Well-known
// short forms come first (NLP, LLMs, RAG...): that's how resumes write them.
const SAME_SKILL = [
  ["OCI", "Oracle Cloud Infrastructure"],
  ["GCP", "Google Cloud Platform", "Google Cloud"],
  ["AWS", "Amazon Web Services"],
  ["Azure", "Microsoft Azure"],
  ["Kubernetes", "K8s"],
  ["LLMs", "Large Language Models", "LLM", "Large Language Model"],
  ["RAG", "Retrieval-Augmented Generation"],
  ["NLP", "Natural Language Processing"],
  ["JavaScript", "JS"],
  ["TypeScript", "TS"],
  ["PostgreSQL", "Postgres"],
  ["Machine Learning", "ML"],
  ["Artificial Intelligence", "AI"],
  ["Continuous Integration (CI)", "CI"],
  ["CI/CD", "CI CD"],
  ["MCP", "Model Context Protocol"],
  ["A2A", "Agent-to-Agent Protocol", "Agent2Agent"]
];

const groupOf = new Map();
SAME_SKILL.forEach((names, index) => names.forEach((name) => groupOf.set(compactKey(name), index)));

// A skill the catalog or the alias list knows, by its standard name
// ("vector databases" -> "Vector Databases", "ML" -> "Machine Learning")
const knownSkill = (name) => {
  const key = compactKey(name);
  if (groupOf.has(key)) return SAME_SKILL[groupOf.get(key)][0];
  return catalogByKey.get(key) || null;
};

// Other names for the same skill ("OCI" -> ["Oracle Cloud Infrastructure"])
function aliasesOf(name) {
  const group = groupOf.get(compactKey(name));
  return group === undefined ? [] : SAME_SKILL[group].filter((other) => compactKey(other) !== compactKey(name));
}

// The name to show for a skill: the short form if it has one ("NLP")
const shortName = (name) => {
  // "Amazon Web Services (AWS)" -> "AWS"
  const bracket = String(name).match(/^(.*?)\s*\(([^)]+)\)$/);
  const keys = [name, ...(bracket ? [bracket[1], bracket[2]] : [])].map(compactKey);
  const group = keys.map((key) => groupOf.get(key)).find((found) => found !== undefined);
  // Keep a bracket that adds detail: "AWS (SageMaker, Bedrock)"
  if (bracket && group !== undefined && groupOf.get(compactKey(bracket[2])) !== group && groupOf.get(compactKey(bracket[1])) === group) return name;
  return group === undefined ? name : SAME_SKILL[group][0];
};

// Too broad to list as a skill: shown through experience instead
const NOT_A_SKILL = new Set(["artificialintelligence", "ai"]);

// Long names written out in sentences -> the short forms resumes use
const SHORT_FORMS = [
  [/\bNatural Language Processing(\s*\(NLP\))?/gi, "NLP"],
  [/\bLarge Language Models(\s*\(LLMs?\))?/gi, "LLMs"],
  [/\bLarge Language Model(\s*\(LLM\))?/gi, "LLM"],
  [/\bRetrieval[- ]Augmented Generation(\s*\(RAG\))?/gi, "RAG"],
  [/\bModel[- ]Context Protocol(\s*\(MCP\))?/gi, "MCP"],
  [/\b(Agent2Agent|Agent[- ]to[- ]Agent)( Protocol)?(\s*\(A2A\))?/gi, "A2A"],
  [/\bGoogle Cloud Platform(\s*\(GCP\))?/gi, "GCP"],
  [/\bAmazon Web Services(\s*\(AWS\))?/gi, "AWS"],
  [/\bOracle Cloud Infrastructure(\s*\(OCI\))?/gi, "OCI"],
  [/\bContinuous Integration\s*(\/|and)\s*Continuous (Delivery|Deployment)(\s*\(CI\/CD\))?/gi, "CI/CD"]
];

// Buzzwords recruiters skim past. Verbs get a plain word; empty adjectives
// are dropped (fixing "an" / "a" before the next word).
const BUZZ_VERBS = [
  [/\bleverag(e|es|ed|ing)\b/gi, (m, end) => ({ e: "use", es: "uses", ed: "used", ing: "using" })[end.toLowerCase()]],
  [/\butiliz(e|es|ed|ing)\b/gi, (m, end) => ({ e: "use", es: "uses", ed: "used", ing: "using" })[end.toLowerCase()]],
  [/\bspearhead(s|ed|ing)?\b/gi, (m, end) => ({ undefined: "lead", s: "leads", ed: "led", ing: "leading" })[String(end).toLowerCase()]],
  [/\bproven track record (of|in)\b/gi, () => "experience in"],
  [/\bsynerg(y|ies)\b/gi, () => "collaboration"],
  [/\bhighly skilled\b/gi, () => "skilled"]
];
const BUZZ_ADJECTIVES = "robust|seamless|seamlessly|cutting-edge|state-of-the-art|innovative|best-in-class|world-class|dynamic|passionate|results-driven|game-changing|next-generation|groundbreaking";

function removeBuzzwords(text) {
  const found = [];
  let result = String(text || "");

  for (const [pattern, replace] of BUZZ_VERBS) {
    result = result.replace(pattern, (match, end) => {
      found.push(match);
      const word = replace(match, end);
      return match[0] === match[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
    });
  }

  // "an innovative platform" -> "a platform"; "robust, scalable" -> "scalable"
  result = result.replace(new RegExp(`\\b(a|an|A|An)\\s+(${BUZZ_ADJECTIVES})(,?)\\s+(\\w)`, "g"), (match, article, word, comma, next) => {
    found.push(word);
    const fitting = /[aeiou]/i.test(next) ? "an" : "a";
    return `${article[0] === "A" ? fitting[0].toUpperCase() + fitting.slice(1) : fitting} ${next}`;
  });
  result = result.replace(new RegExp(`\\b(${BUZZ_ADJECTIVES})(,)?\\s+`, "gi"), (match, word) => {
    found.push(word);
    return "";
  });

  // A sentence that now starts lowercase gets its capital back
  result = result.replace(/(^|[.!?]\s+)([a-z])/g, (match, start, letter) => start + letter.toUpperCase());
  return { text: result, found };
}

function shortenTerms(text) {
  return SHORT_FORMS.reduce((result, [pattern, short]) => result.replace(pattern, short), String(text || ""));
}

// The standard spelling for a skill the catalog knows ("Pytorch" -> "PyTorch")
const canonicalSkill = (name) => catalogByKey.get(compactKey(name)) || name.trim();

// Fixes spelling of known skills and drops repeats. Returns the cleaned
// lists and a note for each change, so the user knows what happened.
function cleanSkillLists(technical, soft) {
  const notes = [];
  const seenKeys = new Map();
  const seenGroups = new Map();

  const clean = (names) => names.reduce((kept, original) => {
    if (NOT_A_SKILL.has(compactKey(original))) {
      notes.push(`Removed "${original}" from Skills: too broad to list; your experience shows it.`);
      return kept;
    }
    const name = shortName(catalogByKey.get(compactKey(original)) || fixSkillTypo(original) || original.trim());
    if (name !== original.trim()) notes.push(`Wrote "${original}" as "${name}".`);

    // "Oracle Cloud Infrastructure (OCI)" is also "Oracle Cloud Infrastructure" and "OCI"
    const bracket = name.match(/^(.*?)\s*\(([^)]+)\)$/);
    const keys = [name, ...(bracket ? [bracket[1], bracket[2]] : [])].map(compactKey).filter(Boolean);
    const groups = keys.map((key) => groupOf.get(key)).filter((group) => group !== undefined);

    const repeat = keys.find((key) => seenKeys.has(key));
    if (repeat) {
      const earlier = seenKeys.get(repeat);
      // "AWS (SageMaker, Bedrock)" says more than "AWS": keep the detailed one
      if (bracket && !/\(/.test(earlier) && compactKey(shortName(bracket[1])) === compactKey(earlier)) {
        notes.push(`Kept "${name}" instead of "${earlier}": it names the services.`);
        keys.forEach((key) => seenKeys.set(key, name));
        return kept.map((item) => (item === earlier ? name : item));
      }
      notes.push(`Removed "${original}": same skill as "${earlier}".`);
      return kept;
    }
    const sameGroup = groups.find((group) => seenGroups.has(group));
    if (sameGroup !== undefined) {
      notes.push(`Removed "${name}": same skill as "${seenGroups.get(sameGroup)}".`);
      return kept;
    }

    keys.forEach((key) => seenKeys.set(key, name));
    groups.forEach((group) => seenGroups.set(group, name));
    return [...kept, name];
  }, []);

  return { technical: clean(technical), soft: clean(soft), notes };
}

// Skills that look like a typo of a catalog skill ("Pyhton" -> "Python")
function skillTypos(names) {
  const suggestions = [];

  for (const name of names) {
    const key = compactKey(name);
    if (catalogByKey.has(key) || key.length < 5) continue;

    const allowed = key.length <= 8 ? 1 : 2;
    for (const [catalogKey, catalogName] of catalogByKey) {
      if (Math.abs(catalogKey.length - key.length) <= allowed && editDistance(key, catalogKey) <= allowed) {
        suggestions.push({ name, suggestion: catalogName });
        break;
      }
    }
  }

  return suggestions;
}

// Common resume misspellings -> correct word
const MISSPELLINGS = {
  deployement: "deployment", developement: "development", enviroment: "environment",
  managment: "management", implemention: "implementation", implmentation: "implementation",
  maintainance: "maintenance", maintenence: "maintenance", recieve: "receive", recieved: "received",
  acheive: "achieve", acheived: "achieved", sucessful: "successful", succesful: "successful",
  sucessfully: "successfully", seperate: "separate", occured: "occurred", accross: "across",
  perfomance: "performance", performence: "performance", effecient: "efficient",
  efficency: "efficiency", intergration: "integration", integeration: "integration",
  infrastucture: "infrastructure", architecure: "architecture", arcitecture: "architecture",
  buisness: "business", comunication: "communication", communcation: "communication",
  colaboration: "collaboration", collabration: "collaboration", responsibilty: "responsibility",
  knowlege: "knowledge", experiance: "experience", expirience: "experience",
  proficent: "proficient", algoritm: "algorithm", alogrithm: "algorithm", databse: "database",
  langauge: "language", techinical: "technical", technolgy: "technology", scalible: "scalable",
  pipline: "pipeline", piplines: "pipelines", traning: "training", inferance: "inference",
  retreival: "retrieval", retrival: "retrieval", analitics: "analytics", dashbord: "dashboard",
  automtion: "automation", autmated: "automated", optimzation: "optimization",
  optmization: "optimization", evalution: "evaluation", evaulation: "evaluation",
  enginer: "engineer", enginering: "engineering", engeneer: "engineer", enginner: "engineer",
  sceince: "science", scince: "science", lerning: "learning", learnig: "learning",
  suport: "support", supprt: "support", developped: "developed", devloped: "developed",
  desinged: "designed", desiged: "designed", analyed: "analyzed", analysed: "analyzed",
  improvment: "improvement", requirment: "requirement", requirments: "requirements",
  reliablity: "reliability", availablity: "availability", secuirty: "security",
  sofware: "software", softwere: "software", computr: "computer", compter: "computer",
  univeristy: "university", universty: "university", bachlor: "bachelor", bachelors: "bachelor's",
  masters: "master's", certfication: "certification", certifcation: "certification",
  artifical: "artificial", artficial: "artificial", inteligence: "intelligence",
  intelligance: "intelligence", generetive: "generative", generativ: "generative",
  applicaton: "application", applicatons: "applications", platfrom: "platform",
  servies: "services", serivce: "service", cloude: "cloud", stakholders: "stakeholders",
  stakeholdres: "stakeholders", leadrship: "leadership", mentord: "mentored"
};

// Known tech names with distinctive capitals ("LangChain", "PyTorch",
// "AWS") written in the wrong case in sentences get their real capitals
// Only single names like these; Title Case phrases ("Feature Engineering")
// are ordinary words in a sentence and stay as written
const CASED_NAMES = catalog
  .map((skill) => skill.name)
  .filter((name) => name.length >= 3 && !/[()\s]/.test(name) && /[A-Z]/.test(name.slice(1)))
  .sort((a, b) => b.length - a.length);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CASED_PATTERNS = CASED_NAMES.map((name) => [name, new RegExp(`(?<![A-Za-z0-9])${escapeRegex(name)}(?![A-Za-z0-9])`, "gi")]);

function fixTechCasing(text) {
  const fixes = [];
  let fixed = String(text || "");
  for (const [name, pattern] of CASED_PATTERNS) {
    fixed = fixed.replace(pattern, (found) => {
      if (found !== name) fixes.push([found, name]);
      return name;
    });
  }
  return { text: fixed, fixes };
}

// Letters only, no vowels (or y), 4+ long: "FLKSS". Real acronyms like
// these are allowed.
const ACRONYMS = new Set([
  "html", "sdlc", "rlhf", "llms", "nlp", "crm", "lstm", "https", "http", "grpc", "mlp", "knn",
  "cnn", "rnn", "xml", "pdf", "kpis", "slas", "cgpa", "msc", "bsc", "phd", "mtch", "btch", "jwt",
  "tcp", "smtp", "ssh", "dns", "vpn", "vpns", "wlan", "pwm", "plc", "rtl", "vhdl", "dsp"
]);
const PLACEHOLDER_WORDS = /\b(lorem|ipsum|placeholder|asdf|qwerty|tbd|xxx+|dummy text|sample text|your name|company name)\b/i;

function placeholderIn(text) {
  if (PLACEHOLDER_WORDS.test(text)) return text.match(PLACEHOLDER_WORDS)[0];
  const token = (String(text).match(/\b[A-Za-z]{4,}\b/g) || [])
    .find((word) => !/[aeiouy]/i.test(word) && !ACRONYMS.has(word.toLowerCase()));
  return token || null;
}

// "Deployement" -> "Deployment", keeping capitals ("MANAGMENT" -> "MANAGEMENT")
const matchCase = (original, fix) =>
  original === original.toUpperCase() && original.length > 1
    ? fix.toUpperCase()
    : original[0] === original[0].toUpperCase()
      ? fix[0].toUpperCase() + fix.slice(1)
      : fix;

// Fixes known misspellings in one piece of text: { text, fixes: [[from, to]] }
function fixMisspellings(text) {
  const fixes = [];
  const spelled = String(text || "").replace(/[A-Za-z]+/g, (word) => {
    const fix = MISSPELLINGS[word.toLowerCase()];
    if (!fix) return word;
    const corrected = matchCase(word, fix);
    fixes.push([word, corrected]);
    return corrected;
  });
  const cased = fixTechCasing(spelled);
  return { text: cased.text, fixes: [...fixes, ...cased.fixes] };
}

// Everything a sentence on the resume gets: spelling, tech-name capitals,
// short forms (NLP, LLMs, RAG) and no buzzwords
function tidyText(text) {
  const spelled = fixMisspellings(text);
  const plain = removeBuzzwords(shortenTerms(spelled.text));
  return { text: plain.text, fixes: spelled.fixes, buzzwords: plain.found };
}

// A skill that is one or two letters off a catalog skill becomes that
// skill ("Pyhton" -> "Python"); null when there's no close match
function fixSkillTypo(name) {
  const [match] = skillTypos([name]);
  return match ? match.suggestion : null;
}

// Accepts a proofread version only if it fixed small typos: same words in
// the same order, each changed word at most two letters different. Any
// rewording, and any change to numbers, keeps the original.
function onlyTypoFixes(original, proofread) {
  if (typeof proofread !== "string") return false;
  const before = original.trim().split(/\s+/);
  const after = proofread.trim().split(/\s+/);
  if (before.length !== after.length) return false;

  return before.every((word, index) => {
    const a = word.replace(/[^A-Za-z0-9]/g, "");
    const b = after[index].replace(/[^A-Za-z0-9]/g, "");
    if (a === b) return true;
    if (/\d/.test(a) || /\d/.test(b) || a.length < 4) return false;
    return editDistance(a.toLowerCase(), b.toLowerCase()) <= 2;
  });
}

function misspellingsIn(text) {
  return (String(text).match(/[A-Za-z]+/g) || [])
    .filter((word) => MISSPELLINGS[word.toLowerCase()])
    .map((word) => ({ word, fix: MISSPELLINGS[word.toLowerCase()] }));
}

// Every piece of text on the resume with a label for messages
function labelledText(resume) {
  return [
    ["Summary", resume.summary],
    ...resume.experience.flatMap((item) => [
      ["Experience", `${item.title} ${item.organization}`],
      ...item.bullets.map((bullet) => ["Experience", bullet])
    ]),
    ...resume.projects.flatMap((item) => [["Projects", item.title], ...item.bullets.map((bullet) => ["Projects", bullet])]),
    ...resume.education.flatMap((item) => [
      ["Education", [item.degree, item.fieldOfStudy, item.institution, item.grade].join(" ")],
      ...item.bullets.map((bullet) => ["Education", bullet]),
      ...item.courses.map((course) => ["Education", course])
    ]),
    ...resume.skills.technical.map((skill) => ["Skills", skill]),
    ...Object.entries(resume.extras || {}).flatMap(([, items]) =>
      items.map((item) => ["Other sections", typeof item === "string" ? item : `${item.title} ${item.subtitle}`]))
  ].filter(([, text]) => text);
}

// [{ level, section, message }]
function qualityIssues(resume) {
  const issues = [];
  const seen = new Set();
  const add = (level, section, message) => {
    if (seen.has(message)) return;
    seen.add(message);
    issues.push({ level, section, itemId: null, message });
  };

  for (const [section, text] of labelledText(resume)) {
    const placeholder = placeholderIn(text);
    if (placeholder) add("error", section, `"${placeholder}" looks like placeholder text; fix it in your portfolio.`);

    misspellingsIn(text).forEach(({ word, fix }) =>
      add("warning", section, `Spelling: "${word}" should be "${fix}".`));
  }

  skillTypos(resume.skills.technical).forEach(({ name, suggestion }) =>
    add("warning", "Skills", `"${name}" may be a typo of "${suggestion}".`));

  // Dates must be complete and consistent
  resume.experience.forEach((item) => {
    if (!item.current && !item.end) {
      add("warning", "Experience", `${item.title} at ${item.organization}: add an end date or mark it as current.`);
    }
  });
  const current = resume.experience.filter((item) => item.current);
  if (current.length > 2) {
    add("warning", "Experience", `${current.length} jobs are marked as current; check that's accurate.`);
  }

  return issues;
}

module.exports = {
  shortName,
  tidyText,
  removeBuzzwords,
  shortenTerms,
  aliasesOf,
  knownSkill,
  canonicalSkill,
  cleanSkillLists,
  qualityIssues,
  placeholderIn,
  misspellingsIn,
  fixMisspellings,
  fixSkillTypo,
  onlyTypoFixes
};
