const { compareResume } = require("./resumeCompare");

// Bullet rewrites for a job, grounded in the resume itself, and the score
// they would give. A rewrite only names, in the bullet that already shows
// it, a requirement the resume demonstrates under another name:
//   equivalent  "PySpark" -> "PySpark (Apache Spark)": the same thing
//   inferred    "CI/CD" -> "CI/CD and version control": strongly implied;
//               marked to use only if true
//   confirm     plausible from the bullet; marked to use only if true
//   confirmed   the candidate said they have it
// Nothing is added that the resume doesn't support: missing, listed-only,
// related and partial skills (Docker isn't Kubernetes) get no rewrite.

const MAX_REWRITES = 6;
const CATEGORY_ORDER = ["required", "responsibilities", "preferred"];
const KINDS = { equivalent: "same", inferred: "check", confirm: "check", confirmed: "confirmed" };

// A kind of thing, not a skill: "scikit-learn (ML libraries)" reads badly
const CATEGORY_WORDS = /\b(?:tools?|frameworks?|librar(?:y|ies)|languages?|platforms?|technolog(?:y|ies)|systems?|methods?|methodolog(?:y|ies)|practices?|stacks?|solutions?|services?|environments?|concepts?|principles?|techniques?)\b/i;

const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The words, as written or with a plural "s" more or less ("releases" finds
// "release"), and a whole name: "GPT" finds "GPT-4", never splitting it
const said = (text, words) => new RegExp(`(?<![\\w-])${escape(String(words).replace(/s$/i, ""))}s?(?:-[\\w.]+)*(?![\\w-])`, "i");

// The bullets of jobs and projects, where a rewrite can go
const bulletsOf = (resume) => [...(resume.experience || []), ...(resume.projects || [])].flatMap((entry) => entry.bullets || []);

// A bullet with its changes: the same thing named in brackets next to the
// words that show it, and implied skills added as one closing clause
function rewritten(text, changes) {
  let after = text;
  for (const change of changes.filter((item) => item.kind === "same")) {
    const found = after.match(said(after, change.via));
    if (found) after = `${after.slice(0, found.index)}${found[0]} (${change.term})${after.slice(found.index + found[0].length)}`;
  }
  const added = changes.filter((item) => item.kind !== "same").map((item) => item.term);
  if (added.length) {
    const list = added.length > 1 ? `${added.slice(0, -1).join(", ")} and ${added[added.length - 1]}` : added[0];
    after = `${after.replace(/[.\s]+$/, "")}, using ${list}.`;
  }
  return after;
}

// [{ before, after, where, changes: [{ term, via, kind, requirement, category }], check, why }],
// most valuable first
function suggestRewrites(match, resume) {
  const bullets = new Set(bulletsOf(resume));
  const items = CATEGORY_ORDER.flatMap((category) => (match.categories?.[category]?.items || []).map((item) => ({ item, category })))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || (b.item.pointsLost || 0) - (a.item.pointsLost || 0));
  const byBullet = new Map();
  const seen = new Set();

  for (const { item, category } of items) {
    for (const term of item.terms || []) {
      const kind = KINDS[term.match];
      if (!kind || !term.via || seen.has(term.term.toLowerCase()) || CATEGORY_WORDS.test(term.term)) continue;
      const evidence = (term.evidence || []).find((entry) => bullets.has(entry.text) && said(entry.text, term.via).test(entry.text) && !said(entry.text, term.term).test(entry.text));
      if (!evidence) continue;
      const changes = byBullet.get(evidence.text) || [];
      // One change per phrase: "CI/CD (X) and Y" reads badly
      if (changes.some((change) => change.via.toLowerCase() === term.via.toLowerCase())) continue;
      seen.add(term.term.toLowerCase());
      byBullet.set(evidence.text, [...changes, { term: term.term, via: term.via, kind, requirement: item.text, category, where: evidence.where || "" }]);
    }
  }

  return [...byBullet.entries()].slice(0, MAX_REWRITES).map(([before, changes]) => ({
    before,
    after: rewritten(before, changes),
    where: changes[0].where,
    changes,
    check: changes.some((change) => change.kind === "check"),
    why: changes.map((change) => change.kind === "same"
      ? `${change.via} counts as ${change.term}; naming both lets people and ATS see the match.`
      : change.kind === "confirmed"
        ? `You confirmed ${change.term}; this is the work that shows it.`
        : `${change.via} suggests ${change.term}. Use this only if you did work with ${change.term}.`)
  }));
}

// The resume with the rewrites in place
function withRewrites(resume, rewrites) {
  const swap = new Map(rewrites.map((rewrite) => [rewrite.before, rewrite.after]));
  const entries = (list) => (list || []).map((entry) => ({ ...entry, bullets: (entry.bullets || []).map((bullet) => swap.get(bullet) || bullet) }));
  return { ...resume, experience: entries(resume.experience), projects: entries(resume.projects) };
}

// { suggestions, before, after }: the resume-only match and keyword scores
// now and with every rewrite, both read the same way (rules only), so the
// difference is the rewrites'. details: what compareResume was given.
async function rewritesFor(match, details) {
  const suggestions = suggestRewrites(match, details.resume);
  if (!suggestions.length) return { suggestions, before: null, after: null };
  const plain = { ...details, llm: null, confirmations: undefined };
  const [before, after] = await Promise.all([compareResume(plain), compareResume({ ...plain, resume: withRewrites(details.resume, suggestions) })]);
  const scores = (result) => ({ match: result.overall, keywords: result.keywords?.score ?? null });
  return { suggestions, before: scores(before), after: scores(after) };
}

module.exports = { rewritesFor, suggestRewrites, withRewrites };
