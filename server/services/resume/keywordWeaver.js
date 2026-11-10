const { mentions, inventsNumbers, bulletProblems } = require("./atsRules");
const { dictionaryKeywords } = require("./skillDictionary");

// Two Ollama agents that work important job keywords into the bullets:
//
//   Keyword Matcher: reads each entry's story (the user's own tasks) and picks
//     the one bullet whose work each keyword belongs to, or none.
//   Keyword Weaver: rewrites that bullet from the story so the keyword is a
//     step of the work ("deployed the service on Kubernetes"), not a tag
//     ("using Kubernetes").
//
// Code checks every rewrite: the keyword is in it, the original facts are
// kept, and nothing else (numbers, tools, buzzwords) was added.

const MAX_PER_BULLET = 2;
const STORY_LIMIT = 700;

const MATCH_PROMPT = [
  "You place job keywords into a candidate's resume.",
  "Each entry has a story (the candidate's own account of the work) and its bullets, each with a ref.",
  "For each keyword, pick the ONE bullet whose work it naturally belongs to: the step in that",
  "bullet or its story where that tool or skill would be used (Kubernetes -> a bullet about",
  "deploying services; RAGAS -> a bullet about evaluating a RAG system; SQL -> a bullet about",
  "data pipelines or reporting).",
  "- Prefer bullets whose story already mentions the keyword or the work it is used for.",
  "- Prefer work experience over projects, and recent entries (listed first) over older ones.",
  `- At most ${MAX_PER_BULLET} keywords per bullet.`,
  "- If no bullet's work fits a keyword, leave that keyword out. Never force a fit.",
  'Reply with JSON only: {"placements": [{"keyword": string, "ref": string}]}'
].join("\n");

const WEAVE_PROMPT = [
  "You add job keywords to ONE resume bullet so they read as part of the work, not as buzzwords.",
  "- Read story first: the candidate's own account of how this work was done. Find the step where",
  "  each keyword was used and say what it did there, e.g. \"containerized the retrieval service with",
  "  Docker and deployed it on Kubernetes\", not \"using Docker and Kubernetes\".",
  "- Keep every fact, number, tool and result already in bullet. Keep its opening verb. One sentence.",
  "- Include each keyword in keywords exactly as written.",
  "- Add no other numbers, tools or claims. Never end the bullet with a list of tools.",
  "- No buzzwords: never write leverage, utilize, spearhead, robust, seamless, cutting-edge,",
  "  innovative, synergy or state-of-the-art.",
  "- No first-person pronouns. Plain text only.",
  "- At most maxLength characters.",
  "- If feedback is given, rewrite draft to fix exactly that.",
  'Reply with JSON only: {"bullet": string}'
].join("\n");

const BUZZWORDS = /\b(leverag\w*|utiliz\w*|spearhead\w*|robust|seamless\w*|cutting[- ]edge|innovative|synerg\w*|state[- ]of[- ]the[- ]art)\b/i;
// "..., using Docker, Kubernetes, Terraform." : a tag list, not work
const TOOL_LIST_ENDING = /\b(using|with|via|leveraging)\s+[\w.+#/-]+(\s*,\s*[\w.+#/-]+){2,}(\s*,?\s*and\s+[\w.+#/-]+)?\.?$/i;

const STOPWORDS = new Set("the a an and or of for to in on with by from using across over into via as at is was were that this".split(" "));
const contentWords = (text) => new Set((text.toLowerCase().match(/[a-z0-9%+]+/g) || []).filter((word) => !STOPWORDS.has(word)));
const firstWord = (text) => (text.match(/^[A-Za-z-]+/) || [""])[0].toLowerCase();

// Why a rewritten bullet can't be used, or null if it's fine
function weaveRejection(next, { bullet, story, keywords, maxLength }) {
  const missing = keywords.filter((keyword) => !mentions(next, keyword));
  if (missing.length) return `leaves out ${missing.join(", ")}`;
  if (next.length > maxLength) return `is longer than ${maxLength} characters`;
  if (firstWord(next) !== firstWord(bullet)) return `must still start with "${bullet.split(/\s/)[0]}"`;
  if (inventsNumbers(next, `${bullet}\n${story}`)) return "adds a number that isn't in the bullet or story";
  const foreign = dictionaryKeywords(next).filter((tool) =>
    !mentions(`${bullet}\n${story}`, tool) && !keywords.some((keyword) => mentions(tool, keyword) || mentions(keyword, tool)));
  if (foreign.length) return `adds tools that aren't keywords (${foreign.join(", ")})`;
  if (BUZZWORDS.test(next)) return `uses a buzzword ("${next.match(BUZZWORDS)[0]}")`;
  if (TOOL_LIST_ENDING.test(next)) return "ends with a list of tools; say what each keyword did in the work";
  const problems = bulletProblems(next, maxLength);
  if (problems.length) return problems[0];
  // The bullet's own story must survive: most of its words are still there
  const before = contentWords(bullet);
  const after = contentWords(next);
  const kept = [...before].filter((word) => after.has(word)).length;
  if (kept / before.size < 0.6) return "drops too much of the original bullet; keep its facts and add the keyword";
  return null;
}

// Each entry's bullets with refs ("experience:3:1"), and the story behind them
function entriesOf(resume, source) {
  const lists = [
    ["experience", "experiences", (original) => [original.summary, original.highlights, ...original.bullets]],
    ["projects", "projects", (original) => [original.description, ...original.bullets]]
  ];

  return lists.flatMap(([listKey, sourceKey, storyOf]) => resume[listKey].map((item) => {
    const original = source[sourceKey].find((entry) => entry.id === item.id);
    return {
      listKey,
      item,
      story: original ? storyOf(original).filter(Boolean).join("\n") : "",
      refs: item.bullets.map((_, index) => `${listKey}:${item.id}:${index}`)
    };
  })).filter((entry) => entry.item.bullets.length);
}

// The Keyword Matcher agent: { ref: [keywords] }
async function matchKeywords(llm, keywords, entries, signal) {
  const placements = {};
  const refs = new Set(entries.flatMap((entry) => entry.refs));
  const place = (ref, keyword) => {
    if (!refs.has(ref) || (placements[ref] || []).length >= MAX_PER_BULLET) return false;
    if (Object.values(placements).some((list) => list.includes(keyword))) return false;
    placements[ref] = [...(placements[ref] || []), keyword];
    return true;
  };

  const reply = await llm.invokeJson(MATCH_PROMPT, {
    keywords,
    entries: entries.map((entry) => ({
      entry: `${entry.listKey === "experience" ? "Work" : "Project"}: ${entry.item.title}`,
      story: entry.story.slice(0, STORY_LIMIT),
      bullets: entry.item.bullets.map((text, index) => ({ ref: entry.refs[index], text }))
    }))
  }, signal);

  for (const placement of Array.isArray(reply.placements) ? reply.placements : []) {
    const keyword = keywords.find((item) => typeof placement?.keyword === "string" && item.toLowerCase() === placement.keyword.trim().toLowerCase());
    if (keyword && typeof placement.ref === "string") place(placement.ref.trim(), keyword);
  }

  // A keyword the matcher skipped but whose story names it still belongs
  // there: the bullet sharing the most words with that story
  for (const keyword of keywords) {
    if (Object.values(placements).some((list) => list.includes(keyword))) continue;
    const entry = entries.find((candidate) => mentions(candidate.story, keyword));
    if (!entry) continue;
    const storyWords = contentWords(entry.story);
    const ranked = entry.refs
      .map((ref, index) => ({ ref, score: [...contentWords(entry.item.bullets[index])].filter((word) => storyWords.has(word)).length }))
      .sort((a, b) => b.score - a.score);
    ranked.some(({ ref }) => place(ref, keyword));
  }

  return placements;
}

// The Keyword Weaver agent: one bullet, its keywords; null if unusable
async function weaveBullet(llm, task, signal) {
  const payload = { bullet: task.bullet, story: task.story.slice(0, STORY_LIMIT), keywords: task.keywords, maxLength: task.maxLength };
  const first = String((await llm.invokeJson(WEAVE_PROMPT, payload, signal)).bullet || "").trim();
  const problem = weaveRejection(first, task);
  if (!problem) return { bullet: first, calls: 1 };

  const retry = String((await llm.invokeJson(WEAVE_PROMPT, { ...payload, draft: first, feedback: `Rejected: it ${problem}.` }, signal)).bullet || "").trim();
  return { bullet: weaveRejection(retry, task) ? null : retry, calls: 2 };
}

// Works keywords into the resume's bullets.
// maxLength: { experience, projects } characters per bullet.
// Returns { resume, woven, unplaced, notes, calls }; woven lists each
// changed bullet { listKey, id, index, keywords, fromJob, before, after }.
async function weaveKeywords({ llm, resume, source, keywords, maxLength, progress = () => {}, signal }) {
  const entries = entriesOf(resume, source);
  if (!keywords.length || !entries.length) return { resume, woven: [], unplaced: keywords, notes: [], calls: 0 };

  progress(`Keyword Matcher agent: finding where ${keywords.join(", ")} fit your work`);
  const placements = await matchKeywords(llm, keywords, entries, signal);
  let calls = 1;

  const candidateText = JSON.stringify(source);
  const next = { ...resume, experience: [...resume.experience], projects: [...resume.projects] };
  const woven = [];
  const notes = [];

  for (const [ref, placed] of Object.entries(placements)) {
    const [listKey, id, rawIndex] = ref.split(":");
    const index = Number(rawIndex);
    const entry = entries.find((candidate) => candidate.listKey === listKey && candidate.item.id === id);
    const position = next[listKey].findIndex((item) => item.id === id);
    const before = next[listKey][position].bullets[index];

    progress(`Keyword Weaver agent: adding ${placed.join(" and ")} to "${entry.item.title}"`);
    try {
      const { bullet, calls: used } = await weaveBullet(llm, { bullet: before, story: entry.story, keywords: placed, maxLength: maxLength[listKey] }, signal);
      calls += used;
      if (!bullet) {
        notes.push(`Couldn't add ${placed.join(", ")} to "${entry.item.title}" without changing what the bullet says.`);
        continue;
      }
      const bullets = [...next[listKey][position].bullets];
      bullets[index] = bullet;
      next[listKey][position] = { ...next[listKey][position], bullets };
      woven.push({
        listKey, id, index, title: entry.item.title, keywords: placed,
        // Keywords the user's portfolio never mentions: they must confirm these
        fromJob: placed.filter((keyword) => !mentions(candidateText, keyword)),
        before, after: bullet
      });
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  const done = new Set(woven.flatMap((change) => change.keywords));
  return { resume: next, woven, unplaced: keywords.filter((keyword) => !done.has(keyword)), notes, calls };
}

module.exports = { weaveKeywords, weaveRejection, prompts: { MATCH_PROMPT, WEAVE_PROMPT } };
