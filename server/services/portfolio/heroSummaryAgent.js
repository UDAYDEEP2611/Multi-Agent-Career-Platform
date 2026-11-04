const { StateGraph, Annotation, START, END } = require("@langchain/langgraph");
const { inventsNumbers, mentions } = require("../resume/atsRules");
const { dictionaryKeywords } = require("../resume/skillDictionary");
const { GENERIC_PHRASES, withoutEmployers, wordCount } = require("../resume/resumeAgent");
const { allowedTextOf, titlesOf, falseSeniority } = require("../resume/summaryVariants");
const { experienceYears } = require("../match/evidence");
const { voiceOf } = require("./heroVoices");

// Writes the short summary under the name in each portfolio design's hero,
// as a LangGraph workflow:
//
//   grasp → write → check ─┬─→ END
//                    ↑     └─→ revise (up to twice, only the drafts that failed)
//                    └──────────┘
//
// grasp reads the whole About summary and portfolio and boils them down to
// the core: who the person is, what they build, the skills that matter and
// a measured result. write asks for one summary per design, in that
// design's voice and sized to its hero; each design gets its own angle and
// its own piece of work (a result with the skills from the same job), so
// forty summaries don't all say the same thing. check is plain code: every
// draft must keep to the portfolio's facts (no new numbers, tools,
// employers or titles), fit the design's length and differ from the others.

const MAX_REVISIONS = 2;

// Each design takes the next angle, and gets only the facts that angle
// needs: a small model repeats whatever it's given, so giving every design
// everything makes forty summaries that all say the same thing.
const ANGLES = [
  { text: "Say what the candidate builds and who uses it.", uses: ["identity", "builds", "skills"] },
  { text: "Lead with the measured result, then what made it possible.", uses: ["result", "skills"] },
  { text: "Describe how the candidate works: the approach or craft behind the systems.", uses: ["builds", "skills"] },
  { text: "Name the problem the work solved for teams or users, and the outcome.", uses: ["result"] },
  { text: "Show the range of the work, from one end of the stack to the other.", uses: ["builds", "skills"] },
  { text: "Say where the candidate is heading and what they bring to it.", uses: ["identity", "aimingFor", "skills"] }
];

const GRASP_PROMPT = [
  "You read a candidate's portfolio and find its core, so short summaries can be written from it.",
  "- Use ONLY facts in the input. Never invent numbers, tools, employers or results.",
  "- identity: the candidate's real role, from jobTitles or headline (no new seniority words).",
  "- builds: what the candidate builds or delivers, in at most 12 words.",
  "- focusSkills: the 3 to 5 skills that matter most, copied from skills.",
  "- proof: the strongest measured result copied from achievements, shortened to at most",
  "  14 words with its numbers unchanged; empty if there is none.",
  "- direction: what the candidate is aiming for next, from targetRoles or the summary; empty if unknown.",
  'Reply with JSON only: {"identity": string, "builds": string, "focusSkills": string[], "proof": string, "direction": string}'
].join("\n");

const WRITE_PROMPT = [
  "You write the short summary shown under the candidate's name and headline at the top of a portfolio website.",
  "Write it in design.voice, following design.angle, within design.words words.",
  "- Use only the facts given in facts; name no skills other than facts.skills.",
  "- Use ONLY facts in the input. Never invent numbers, years, tools, employers, clients or results.",
  "- If you state experience, write the number from yearsOfExperience followed by \"+ years\" (for example \"5+ years\").",
  "- Never name an employer, client or school.",
  "- facts.aimingFor is a role the candidate wants next: never call the candidate by it as a title.",
  "- Never claim leadership, managing people, awards or seniority the input doesn't state.",
  "- Third person or no subject (\"Builds…\"); never I, me, my, we or our.",
  "- design.voice describes the tone; never copy its words into the summary.",
  "- Readable for a recruiter: no slang, emojis, markdown, hashtags or quotes around the text.",
  "- No buzzwords: passionate, cutting-edge, innovative, dynamic, results-driven, leverage, synergy,",
  "  proven, seasoned, versatile, seamless, pioneering, expertise, proficiency, demonstrated success,",
  "  world-class, next level.",
  "- Don't start the way any of avoidOpenings starts.",
  "- If feedback is given, rewrite draft to fix exactly that.",
  'Reply with JSON only: {"summary": string}'
].join("\n");

const FIRST_PERSON = /\b(I|me|my|mine|we|our|us)\b/;
const FILLER = /\b(leverag\w*|synerg\w*|utiliz\w*|spearhead\w*|proven|relentless\w*|seasoned|versatile|robust|eager\w*|expertise|proficien\w*|seamless\w*|pioneer\w*|demonstrated (?:success|ability)|world[- ]class|next (?:level|stage)|guru|ninja|rockstar)\b/i;
const MARKUP = /[*#_`|<>]|\p{Extended_Pictographic}/u;
const AUDIENCE = /\b(clients?|customers?)\b/i;
// A job title the model may make up: "AI Systems Architect", "Data Craftsman"
const MADE_UP_TITLE = /\b((?:[A-Z][\w/&-]*\s+){0,3}(?:Architect|Manager|Director|Craftsman|Specialist|Consultant|Strategist|Evangelist|Expert))\b/;

// Words from the instructions that mean the model wrote about the task
const LEAKED = /\b(unspecified|the candidate|facts?\.\w+|design\.\w+|useWork|aimingFor)\b/i;
const AIMING = /\b(aim\w*|seek\w*|toward\w*|next|heading|roles?|path)\b/i;
// Claims about managing people, which the portfolio has to make itself
const LEADERSHIP = /\b(lead(?:s|ing)?|manag(?:es|ing)|head(?:s|ing)?|direct(?:s|ing))\s+(?:a\s+|the\s+)?(?:\w+\s+){0,2}(teams?|engineers|people|staff|departments?|organi[sz]ations?)\b/i;
const MEASURED = /\d+(?:\.\d+)?\s?%|\$\d|\b\d+(?:\.\d+)?[KMB]\b|\b\d+x\b|\b\d{1,3}(?:,\d{3})+\b|\b\d+\s?(?:TB|GB|ms)\b/i;
const COMMON = new Set("a an and the of in on for to with by from at as is are its it that this their into across through".split(" "));

const clean = (text) => String(text || "")
  // Markdown emphasis a model sometimes adds: **bold**, _italic_, `code`
  .replace(/[*`]+|(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, "")
  .replace(/\s+/g, " ")
  .replace(/^["'“‘]+|["'”’]+$/g, "")
  .trim();

// Words that carry the wording, leaving out common words and the terms
// (skills, results) every summary may share
const wordsOf = (text, shared) => new Set((clean(text).toLowerCase().match(/[a-z0-9+#]+/g) || [])
  .filter((word) => !COMMON.has(word) && !shared.has(word)));

// Share of wording two texts have in common (0 to 1)
function overlap(a, b, shared = new Set()) {
  const left = wordsOf(a, shared);
  const right = wordsOf(b, shared);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const word of left) if (right.has(word)) common += 1;
  return common / Math.min(left.size, right.size);
}

const firstWords = (text, count = 4) => clean(text).split(" ").slice(0, count).join(" ");

// Filler a small model keeps reaching for, swapped for plain words in code
// rather than rejecting an otherwise good draft
const PLAIN_WORDS = [
  [/\butiliz(e|es|ed|ing)\b/gi, (_, end) => `us${end}`],
  [/\bleverag(e|es|ed|ing)\b/gi, (_, end) => `us${end}`],
  [/\b(?:seasoned|versatile|robust|experienced|dedicated|meticulous)\s+(?=[a-z])/gi, ""],
  [/\bseamlessly\s+/gi, ""],
  [/\b(p)roficient\b/gi, (_, p) => (p === "P" ? "Skilled" : "skilled")],
  [/\b(e)xpertise in\b/gi, (_, e) => (e === "E" ? "Work in" : "work in")],
  [/\beagerly\s+/gi, ""]
];

const plainWords = (text) => {
  const plain = PLAIN_WORDS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
  if (plain === text) return text;
  // "A seasoned engineer" -> "An engineer"; acronyms ("an LLM") are left alone
  return plain.replace(/\b(an?)\s+(\w)/gi, (match, article, letter) => {
    const vowel = /[aeiou]/i.test(letter);
    const fixed = vowel ? (article[0] === "A" ? "An" : "an") : (article[0] === "A" ? "A" : "a");
    return /^[A-Z]{2}/.test(match.split(/\s+/)[1] || "") ? match : `${fixed} ${letter}`;
  }).replace(/^\w/, (letter) => letter.toUpperCase());
};

// A draft a little over its length loses whole sentences from the end
function fitLength(text, designId) {
  const { words, sentences: sentenceRange } = voiceOf(designId);
  const max = words[1] + 4;
  let sentences = clean(text).split(/(?<=[.!?])\s+/);
  // Too many sentences: the extra ones go first
  if (sentenceRange) sentences = sentences.slice(0, sentenceRange[1]);
  while (sentences.length > (sentenceRange ? sentenceRange[0] : 1) && wordCount(sentences.join(" ")) > max) sentences = sentences.slice(0, -1);
  return sentences.join(" ");
}

const State = Annotation.Root({
  source: Annotation(),
  headline: Annotation(),
  targetRoles: Annotation(),
  designIds: Annotation(),
  facts: Annotation(),
  core: Annotation(),
  drafts: Annotation({ reducer: (all, added) => ({ ...all, ...added }), default: () => ({}) }),
  failures: Annotation({ reducer: (_, next) => next, default: () => ({}) }),
  revisions: Annotation({ reducer: (_, next) => next, default: () => 0 }),
  notes: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] })
});

// Measured results, each with the skills of the job or project it's from
function worksOf(source) {
  const works = [];
  for (const item of source.experiences || []) {
    const lines = [...item.bullets, ...(item.projects || []).flatMap((project) => project.tasks)];
    for (const line of lines.filter((text) => MEASURED.test(text))) {
      const named = item.skills.filter((skill) => mentions(line, skill));
      works.push({ result: line, skills: [...new Set([...named, ...item.skills])].slice(0, 3) });
    }
  }
  for (const item of source.projects || []) {
    for (const line of [item.description, ...item.bullets].filter((text) => text && MEASURED.test(text))) {
      works.push({ result: line, skills: item.skills.slice(0, 3) });
    }
  }
  return works.slice(0, 8);
}

// Everything the drafts may draw on, worked out once
function factsOf(source, headline, targetRoles) {
  const years = experienceYears(source.experiences || []);
  const skills = (source.skills || []).map((skill) => skill.name);
  const works = worksOf(source);
  return {
    allowedText: [allowedTextOf(source), headline, ...targetRoles].filter(Boolean).join("\n"),
    employers: [
      ...(source.experiences || []).map((item) => item.organization),
      ...(source.educations || []).map((item) => item.institution)
    ].filter(Boolean),
    years: years ? Math.floor(years) : null,
    titles: titlesOf(source),
    skills,
    // The skills marked important, for the resume summary
    keySkills: (source.skills || []).filter((skill) => skill.isImportant).map((skill) => skill.name),
    works,
    targetRoles,
    headline,
    shared: new Set([...skills, ...works.map((work) => work.result)].join(" ").toLowerCase().match(/[a-z0-9+#]+/g) || [])
  };
}

// A reason the text breaks the portfolio's facts, or null
function factProblem(text, facts) {
  const claimed = text.match(/\b(\d+)\+?\s*(?:years?|yrs?)\b/i);
  if (claimed && (facts.years === null || Number(claimed[1]) > facts.years)) {
    return `claims ${claimed[1]} years; ${facts.years === null ? "the portfolio has no job dates" : `the job dates show ${facts.years}`}`;
  }
  if (/\bdecades?\b/i.test(text) && (facts.years ?? 0) < 10) return "claims a decade of experience; the job dates show less";
  if (inventsNumbers(text, `${facts.allowedText}\n${facts.years ?? ""}`)) return "has a number that isn't in the portfolio";
  const foreign = dictionaryKeywords(text).filter((tool) => !mentions(facts.allowedText, tool));
  if (foreign.length) return `names tools not in the portfolio (${foreign.join(", ")})`;
  if (facts.employers.length && withoutEmployers(text, facts.employers).dropped) return "names an employer, client or school";
  const seniority = falseSeniority(text, facts.titles);
  if (seniority) return `calls the candidate "${seniority}", which no job title says`;
  const title = text.match(MADE_UP_TITLE);
  if (title && !mentions(`${facts.titles.join("\n")}\n${facts.headline || ""}`, title[1])) {
    return `calls the candidate "${title[1]}", which isn't a title they've held`;
  }
  const audience = text.match(AUDIENCE);
  if (audience && !mentions(facts.allowedText, audience[0])) return `mentions "${audience[0]}", which the portfolio doesn't`;
  const target = (facts.targetRoles || []).find((role) => mentions(text, role) &&
    !facts.titles.some((title) => mentions(title, role)) && !mentions(facts.headline || "", role));
  if (target && !AIMING.test(text)) return `calls the candidate a "${target}", a role they're aiming for, not one they've held`;
  const leads = text.match(LEADERSHIP);
  if (leads && !LEADERSHIP.test(facts.allowedText)) return `claims "${leads[0]}", which the portfolio doesn't say`;
  return null;
}

// Why a draft can't be shown, or null
function draftProblem(text, designId, facts, others = []) {
  if (!text) return "came back empty";
  const { words: [min, max], voice, sentences: sentenceRange } = voiceOf(designId);
  const words = wordCount(text);
  if (words < min - 6 || words > max + 6) return `has ${words} words; write ${min} to ${max}`;
  if (sentenceRange) {
    const count = clean(text).split(/(?<=[.!?])\s+/).filter(Boolean).length;
    if (count < sentenceRange[0] || count > sentenceRange[1]) return `has ${count} sentence${count === 1 ? "" : "s"}; write ${sentenceRange[0]} or ${sentenceRange[1]}`;
  }
  if (FIRST_PERSON.test(text)) return "uses first-person words (I, my, we)";
  if (MARKUP.test(text)) return "has symbols, markdown or emoji";
  if (overlap(text, voice) >= 0.5) return "copies the design's voice description instead of describing the candidate";
  if (LEAKED.test(text)) return `talks about the instructions ("${text.match(LEAKED)[0]}") instead of the candidate`;
  const buzz = text.match(GENERIC_PHRASES) || text.match(FILLER);
  if (buzz) return `uses the buzzword "${buzz[0]}"`;
  const named = facts.skills.filter((skill) => mentions(text, skill));
  // A skill, a number, or at least two words of what the candidate builds
  const builds = wordsOf(facts.builds || "", new Set());
  const buildsShared = [...wordsOf(text, new Set())].filter((word) => builds.has(word)).length;
  const concrete = named.length || /\d/.test(text) || dictionaryKeywords(text).length || buildsShared >= 2;
  if (!concrete) return "says nothing concrete from the portfolio: name the work, a skill or a result";
  // Taglines name a few skills; the resume summary may name a couple more
  const maxSkills = voiceOf(designId).skills ? voiceOf(designId).skills + 2 : 4;
  if (named.length > maxSkills) return `names ${named.length} skills (${named.join(", ")}); name at most ${maxSkills - 1}`;
  const fact = factProblem(text, facts);
  if (fact) return fact;
  const twin = others.find((other) => overlap(text, other.text, facts.shared || new Set()) > 0.8);
  if (twin) return `reads almost the same as the ${twin.id} summary; word it differently`;
  return null;
}

// ---- Nodes -----------------------------------------------------------------

async function grasp({ source, headline, targetRoles }, config) {
  const { llm, onProgress = () => {}, signal } = config.configurable;
  const facts = factsOf(source, headline, targetRoles);
  onProgress("Reading your summary and portfolio");

  const payload = {
    summary: String(source.summary || "").slice(0, 5000),
    headline,
    jobTitles: facts.titles,
    yearsOfExperience: facts.years,
    skills: facts.skills.slice(0, 40),
    achievements: facts.works.map((work) => work.result),
    targetRoles,
    work: (source.experiences || []).slice(0, 4).map((item) => ({ title: item.title, tasks: item.bullets.slice(0, 5) })),
    projects: (source.projects || []).slice(0, 4).map((item) => ({ title: item.title, description: item.description }))
  };

  const fallback = {
    identity: facts.titles[0] || headline || "",
    builds: "",
    focusSkills: facts.skills.slice(0, 5),
    proof: "",
    direction: targetRoles[0] || ""
  };

  try {
    const reply = await llm.invokeJson(GRASP_PROMPT, payload, signal);
    const text = (value) => clean(typeof value === "string" ? value : "");
    // Only parts that keep to the facts survive
    const keep = (value) => (value && !factProblem(value, facts) ? value : "");
    const focusSkills = (Array.isArray(reply.focusSkills) ? reply.focusSkills : [])
      .map(text)
      .filter((name) => name && facts.skills.some((skill) => skill.toLowerCase() === name.toLowerCase()))
      .slice(0, 5);

    return {
      facts,
      core: {
        identity: keep(text(reply.identity)) || fallback.identity,
        builds: keep(text(reply.builds)),
        focusSkills: focusSkills.length >= 2 ? focusSkills : fallback.focusSkills,
        proof: keep(text(reply.proof)),
        direction: keep(text(reply.direction)) || fallback.direction
      }
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { facts, core: fallback, notes: ["The AI couldn't read your summary closely; wrote from your titles and skills."] };
  }
}

// The pieces of work designs take turns with: the core's result first
function worksFor({ core, facts }) {
  const works = core.proof ? [{ result: core.proof, skills: core.focusSkills.slice(0, 3) }] : [];
  works.push(...facts.works);
  return works.length ? works : [{ result: "", skills: core.focusSkills.slice(0, 3) }];
}

// What one call needs to write one design's summary. turn picks the
// design's angle and piece of work; a rewrite moves on to the next ones.
function briefFor(state, id, turn, extra = {}) {
  const { words, voice, angle: ownAngle, uses, skills: skillCount } = voiceOf(id);
  const works = worksFor(state);
  // The resume summary always leads with the strongest result
  const work = ownAngle ? works[0] : works[turn % works.length];
  const angle = ownAngle ? { text: ownAngle, uses } : ANGLES[turn % ANGLES.length];
  const all = {
    identity: state.core.identity,
    builds: state.core.builds,
    aimingFor: state.core.direction,
    result: work.result,
    skills: ownAngle
      ? [...new Set([...state.facts.keySkills, ...state.core.focusSkills, ...work.skills])].slice(0, skillCount || 4)
      : work.skills.slice(0, words[1] <= 22 ? 2 : 3)
  };
  const facts = Object.fromEntries(angle.uses.filter((key) => all[key]?.length).map((key) => [key, all[key]]));
  // An angle whose facts are missing still needs something to say
  if (!facts.result && !facts.builds && !facts.aimingFor) facts.builds = all.builds || all.result;
  return {
    facts,
    yearsOfExperience: angle.uses.includes("identity") ? state.facts.years : null,
    design: { voice, angle: angle.text, words: `${words[0]} to ${words[1]}` },
    ...extra
  };
}

// "A professional 'About' opener: Builds…" -> "Builds…"
function withoutVoiceEcho(text, designId) {
  const [lead, ...rest] = text.split(/:\s+/);
  return rest.length && overlap(lead, voiceOf(designId).voice) > 0.5 ? rest.join(": ") : text;
}

// "N+ years" or "X years" copied from the instructions: the real number
function withRealYears(text, years) {
  if (!years) return text.replace(/\b(?:with\s+)?[NX]\+?\s+years?(?:\s+of\s+experience)?,?\s*/gi, "");
  return text.replace(/\b[NX]\+?\s+years?/gi, `${years}+ years`);
}

async function writeOne(llm, payload, id, signal) {
  try {
    const reply = await llm.invokeJson(WRITE_PROMPT, payload, signal);
    return fitLength(plainWords(withRealYears(withoutVoiceEcho(clean(reply?.summary), id), payload.yearsOfExperience)), id);
  } catch (error) {
    if (signal?.aborted) throw error;
    return "";
  }
}

async function write(state, config) {
  const { llm, onProgress = () => {}, signal } = config.configurable;
  const drafts = {};

  for (const [index, id] of state.designIds.entries()) {
    onProgress(`Writing summary ${index + 1} of ${state.designIds.length}`);
    const avoidOpenings = Object.values(drafts).filter(Boolean).slice(-6).map((text) => firstWords(text));
    drafts[id] = await writeOne(llm, briefFor(state, id, index, { avoidOpenings }), id, signal);
  }

  return { drafts };
}

function check({ designIds, drafts, facts, core }, config) {
  config.configurable.onProgress?.("Checking every summary against your portfolio");
  const accepted = [];
  const failures = {};

  const withBuilds = { ...facts, builds: core.builds };
  for (const id of designIds) {
    const problem = draftProblem(drafts[id], id, withBuilds, accepted);
    if (problem) failures[id] = problem;
    else accepted.push({ id, text: drafts[id] });
  }

  return { failures };
}

async function revise(state, config) {
  const { llm, onProgress = () => {}, signal } = config.configurable;
  const ids = Object.keys(state.failures);
  const avoidOpenings = state.designIds
    .filter((id) => !state.failures[id] && state.drafts[id])
    .slice(0, 10)
    .map((id) => firstWords(state.drafts[id]));
  const drafts = {};

  for (const [index, id] of ids.entries()) {
    onProgress(`Rewriting ${index + 1} of ${ids.length} that didn't pass the checks`);
    const turn = state.designIds.indexOf(id) + state.revisions + 1;
    drafts[id] = await writeOne(llm, briefFor(state, id, turn, {
      avoidOpenings,
      draft: state.drafts[id] || "",
      feedback: `This draft ${state.failures[id]}. Fix that.`
    }), id, signal);
  }

  return { drafts, revisions: state.revisions + 1 };
}

const heroSummaryGraph = new StateGraph(State)
  .addNode("grasp", grasp)
  .addNode("write", write)
  .addNode("check", check)
  .addNode("revise", revise)
  .addEdge(START, "grasp")
  .addEdge("grasp", "write")
  .addEdge("write", "check")
  .addConditionalEdges("check", ({ failures, revisions }) =>
    Object.keys(failures).length && revisions < MAX_REVISIONS ? "revise" : END)
  .addEdge("revise", "check")
  .compile();

// source: gatherResumeData() output; designIds: which designs to write for.
// Returns { summaries: { [designId]: text }, core, notes }. Designs whose
// summary still fails the checks are left out and explained in notes.
async function writeHeroSummaries({ llm, source, headline = "", targetRoles = [], designIds, onProgress, signal }) {
  const state = await heroSummaryGraph.invoke(
    { source, headline: clean(headline), targetRoles: targetRoles.map(clean).filter(Boolean), designIds },
    { configurable: { llm, onProgress, signal }, signal, recursionLimit: 20 }
  );

  const summaries = {};
  const notes = [...state.notes];
  for (const id of designIds) {
    if (state.failures[id]) notes.push(`${id}: left out because it ${state.failures[id]}.`);
    else summaries[id] = state.drafts[id];
  }

  return { summaries, core: state.core, notes };
}

module.exports = { writeHeroSummaries, heroSummaryGraph, draftProblem, factsOf, fitLength, plainWords, withRealYears };
