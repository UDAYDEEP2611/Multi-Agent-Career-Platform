// The word analyzer: reads a chat message the way a person would, typos,
// shorthand and ALL CAPS included, before any agent decides what it means.
//
//   tokens      words, keeping numbers, URLs and emails whole
//   shorthand   exp -> experience, pls -> please, certs -> certifications
//   spelling    "RESUNME" -> resume, "blod" -> blood, "teh" -> the
//   lemmas      studied -> study, projects -> project (WordNet, through NLTK)
//   features    what the trained models read
//
// The dictionary is built with NLTK (ml/build_lexicon.py) from the Brown corpus
// and WordNet. On top of it come the words of this product and of the user's own
// entries, which win over plain English: "blod bank" should find their Blood
// Bank project.
//
// The corrected text is for understanding only. What the user saves keeps their
// exact wording, and names nobody can correct (Zorblax) are left alone.

let lexicon = { freq: {}, lemma: {}, stop: [] };
try {
  lexicon = require("./lexicon.json");
} catch {
  // Without the dictionary: shorthand and product words still work
}
const STOP = new Set(lexicon.stop);

const SHORTHAND = {
  exp: "experience", exps: "experience", expr: "experience", edu: "education", educ: "education",
  proj: "project", projs: "projects", cert: "certification", certs: "certifications", certi: "certification",
  imp: "important", recs: "recommendations", rec: "recommendation", achv: "achievement", vol: "volunteering",
  pls: "please", plz: "please", pl: "please", thx: "thanks", ty: "thanks", tnx: "thanks", u: "you", ur: "your", r: "are",
  wanna: "want to", gonna: "going to", gotta: "got to", dont: "don't", doesnt: "doesn't", didnt: "didn't", cant: "can't",
  wont: "won't", im: "i'm", ive: "i've", whats: "what's", wat: "what", wht: "what", hw: "how", abt: "about", bc: "because",
  sec: "section", pic: "picture", yrs: "years", yr: "year", mos: "months", univ: "university", b4: "before", pf: "portfolio",
  biz: "business", msg: "message", bak: "back", hav: "have", helo: "hello"
};
// Longer shorthand can be mistyped too ("exops" for exps)
const SHORTHAND_TYPOS = Object.keys(SHORTHAND).filter((word) => word.length >= 4 && !word.includes("'"));

// This product's own words, which beat plain English when correcting
const PRODUCT = `resume resumes cv cvs portfolio portfolios website sidebar sidebars column columns gpa cgpa cpi org orgs url urls git karo lor lors recommender recommenders mail recommendation recommendations testimonial testimonials references issuer issuers provider providers publisher publishers employer employers designation designations specialization specialisation specializations major majors duration durations timeline timelines responsibilities responsibility duties tasks bullet bullets patent patents lol summary profile headline experience experiences job jobs
  position positions role roles employer internship education school schools degree degrees university college gpa bachelor bachelors
  masters phd project projects skill skills certification certifications certificate certificates credential achievement achievements
  award awards volunteering volunteer publication publications paper patent patents interest interests hobby hobbies recommendation
  recommendations reference references contact phone email linkedin github address
  add added adding remove removed removing hide hidden hiding unhide show showing display include included including exclude excluded
  delete deleted drop reset restore change changed update updated rename create make put keep want please
  design designs theme template layout section sections colour color colours colors accent font fonts heading headings corners dark light
  navy blue green red teal purple violet pink orange amber gold black grey gray brown maroon crimson white yellow
  serif minimal modern playful
  engineer developer manager analyst scientist architect intern lead senior junior
  worked work studied graduated built published earned completed joined interned
  hello hi hey thanks thank bye help what which where when who how many list
  top latest recent important key all only every first last
  google microsoft amazon oracle verizon paypal ibm meta apple netflix tesla
  ai ml nlp llm llms rag graphrag langchain langgraph mcp a2a ollama mistral openai claude docker kubernetes aws azure gcp oci
  python java javascript typescript react node sql nosql mongodb postgresql pytorch tensorflow pandas numpy spark pyspark kafka airflow
  agent agents agentic chatbot machine learning`.split(/\s+/);

let productWords = new Set(PRODUCT);
try {
  const catalog = require("../../scripts/skillCatalogData");
  for (const { name } of catalog) for (const word of name.toLowerCase().match(/[a-z][a-z0-9+#]+/g) || []) productWords.add(word);
} catch {
  productWords = new Set(PRODUCT);
}

const normalWord = (word) => word.toLowerCase().replace(/[’]/g, "'");
const known = (word) => Object.hasOwn(lexicon.freq, word) || productWords.has(word);

// Keys next to each other: a slip of the finger costs less than a wrong letter
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const NEAR = new Map();
ROWS.forEach((row, y) => [...row].forEach((key, x) => {
  const around = new Set();
  ROWS.forEach((other, yy) => [...other].forEach((next, xx) => {
    if (next !== key && Math.abs(yy - y) <= 1 && Math.abs(xx - x) <= 1) around.add(next);
  }));
  NEAR.set(key, around);
}));

// Edits from what was typed to a word, weighted by how people really slip: a
// swapped pair and a missed letter are the commonest, then a neighbouring key,
// then an extra letter, then a wrong one
const MISSED = 0.7;
const EXTRA = 0.9;
function editCost(a, b, limit = 2.01) {
  if (Math.abs(a.length - b.length) > limit) return Infinity;
  let before = null;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j * MISSED);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i * EXTRA];
    let best = i * EXTRA;
    for (let j = 1; j <= b.length; j += 1) {
      const same = a[i - 1] === b[j - 1];
      const swap = same ? 0 : NEAR.get(a[i - 1])?.has(b[j - 1]) ? 0.8 : 1;
      let cost = Math.min(previous[j] + EXTRA, row[j - 1] + MISSED, previous[j - 1] + swap);
      if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cost = Math.min(cost, before[j - 2] + 0.6);
      row.push(cost);
      if (cost < best) best = cost;
    }
    if (best > limit) return Infinity;
    before = previous;
    previous = row;
  }
  return previous[b.length];
}

const allowance = (length) => (length <= 2 ? 0 : length <= 5 ? 1 : 2);

const cache = new Map();
const CANDIDATES = () => [...productWords, ...SHORTHAND_TYPOS, ...Object.keys(lexicon.freq)];
let pool = null;

// The best real word for a typo, or null when nothing is close enough. Words
// from the user's entries come first, then product words, then English.
function correctWord(word, personal = new Set()) {
  if (!personal.size && cache.has(word)) return cache.get(word);
  pool ||= [...new Set(CANDIDATES())];
  const limit = allowance(word.length);
  let best = null;
  let bestScore = -Infinity;
  const consider = (candidate, boost) => {
    if (candidate.length < 2 || Math.abs(candidate.length - word.length) > limit) return;
    const cost = editCost(word, candidate, limit + 0.01);
    if (cost > limit) return;
    const common = Math.log1p(lexicon.freq[candidate] || 0);
    const score = boost + common - cost * 9 + (candidate[0] === word[0] ? 1.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  };
  for (const candidate of personal) consider(candidate, 8);
  for (const candidate of pool) consider(candidate, productWords.has(candidate) || Object.hasOwn(SHORTHAND, candidate) ? 5 : 0);
  if (!personal.size) {
    cache.set(word, best);
    if (cache.size > 5000) cache.delete(cache.keys().next().value);
  }
  return best;
}

// Real words used wrongly, only where the words around them say so
const IN_CONTEXT = [
  [/\brest\s+(?=(?:this|my|the|it|all)\b)/gi, "reset "],
  [/\b(?:form)\s+(?=(?:my|this|the|all)\s+(?:r[eé]sum[eé]|portfolio|cv)s?\b)/gi, "from "]
];

const WORD = /[A-Za-z][A-Za-z'’]*/g;
const WHOLE = /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.-]+|\b\w*\d\w*\b|#[0-9a-fA-F]{3,6}\b/g;

// vocabulary: names from the user's own entries ("Blood Bank Management System")
function personalWords(vocabulary = []) {
  const words = new Set();
  for (const label of vocabulary) for (const word of String(label).toLowerCase().match(/[a-z][a-z0-9+#]+/g) || []) if (word.length > 2) words.add(word);
  return words;
}

// { original, corrected, corrections: [{ from, to }], tokens, lemmas }
function analyze(text, { vocabulary = [] } = {}) {
  const original = String(text || "");
  const personal = personalWords(vocabulary);
  const corrections = [];
  // URLs, emails, numbers and colours stay untouched
  const skip = [...original.matchAll(WHOLE)].map((match) => [match.index, match.index + match[0].length]);
  const shouting = original === original.toUpperCase();

  let corrected = original.replace(WORD, (raw, offset) => {
    if (skip.some(([start, end]) => offset >= start && offset < end)) return raw;
    const word = normalWord(raw);
    const swap = (to) => {
      if (to !== word) corrections.push({ from: raw, to });
      return to;
    };
    if (personal.has(word)) return shouting ? word : raw;
    if (Object.hasOwn(SHORTHAND, word)) return swap(SHORTHAND[word]);
    if (word.includes("'") || known(word)) return shouting ? word : raw;
    // A capitalised word mid-sentence is probably a name; only the user's own
    // entries can correct it
    const atStart = /^\s*$|[.!?\n]\s*$/.test(original.slice(0, offset));
    const looksLikeName = !shouting && !atStart && /^[A-Z]/.test(raw);
    const fix = looksLikeName ? [...personal].find((name) => editCost(word, name, allowance(word.length) + 0.01) <= allowance(word.length)) : correctWord(word, personal);
    // The dictionary lists "startups" but not "startup": a word whose own plural
    // or tense is known isn't a typo
    if (!fix || lexicon.lemma[fix] === word) return shouting ? word : raw;
    return swap(SHORTHAND[fix] || fix);
  });
  for (const [pattern, replacement] of IN_CONTEXT) {
    corrected = corrected.replace(pattern, (found) => {
      corrections.push({ from: found.trim(), to: replacement.trim() });
      return replacement;
    });
  }

  const tokens = corrected.toLowerCase().replace(/[’]/g, "'").match(/[a-z0-9+#]+(?:'[a-z]+)?/g) || [];
  const lemmas = tokens.map((token) => lexicon.lemma[token] || token);
  return { original, corrected, corrections, tokens, lemmas };
}

// What the trained models read: lemmas without stop words, word pairs (with
// stop words: "add a", "where did"), and letter trigrams of what was typed, so
// words the dictionary couldn't fix still look like their relatives
function featuresOf(text, options) {
  const { lemmas, original } = analyze(text, options);
  const uni = lemmas.filter((lemma) => !STOP.has(lemma)).map((lemma) => `w:${lemma}`);
  const bi = lemmas.slice(1).map((lemma, index) => `b:${lemmas[index]}_${lemma}`);
  const grams = [];
  for (const word of original.toLowerCase().match(/[a-z0-9+#]+/g) || []) {
    const padded = `#${word}#`;
    for (let i = 0; i + 3 <= padded.length; i += 1) grams.push(`c:${padded.slice(i, i + 3)}`);
  }
  return [...uni, ...bi, ...grams];
}

// The words that say what to do, never what to save. The data entry agent gets
// only these fixed: "add a projct called Zorblx" -> "add a project called Zorblx"
const COMMAND_WORDS = new Set(`add added adding put save record update change create new remove delete please want
  project projects job jobs position role experience experiences education school degree university college skill skills
  certification certifications certificate certificates achievement achievements award awards volunteering volunteer
  publication publications paper patent patents interest interests hobby hobbies recommendation recommendations reference
  summary profile headline section details detail name worked work studied graduated built published earned completed joined
  interned finished started got made won called named titled my the and to of in at for with as from this that`.split(/\s+/));

function fixCommandWords(text, options) {
  let fixed = String(text || "");
  for (const { from, to } of analyze(text, options).corrections) {
    if (!COMMAND_WORDS.has(to) || /^[A-Z][a-z]/.test(from)) continue;
    fixed = fixed.replace(new RegExp(`\\b${from.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&")}\\b`), to);
  }
  return fixed;
}

// Only the corrected text, and how it was read (for the agent's steps)
const correctedText = (text, options) => analyze(text, options).corrected;
const describeCorrections = (corrections) => corrections.map(({ from, to }) => `${from} → ${to}`).join(", ");

module.exports = { analyze, featuresOf, correctedText, fixCommandWords, correctWord, editCost, describeCorrections, isKnownWord: known };
