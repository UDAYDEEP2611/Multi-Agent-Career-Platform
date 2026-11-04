const { inventsNumbers, mentions } = require("./atsRules");
const { dictionaryKeywords } = require("./skillDictionary");
const { GENERIC_PHRASES, withoutEmployers, wordCount, ATS_RULES } = require("./resumeAgent");
const { experienceYears } = require("../match/evidence");

// The Summary page's AI writer: five versions of the professional summary,
// each in its own style, written only from the person's portfolio. Every
// version is checked (no new numbers, tools or employers, no buzzwords) and
// scored on the four things a summary needs: job title, experience level,
// key skills and a measured achievement.

const STYLES = [
  {
    id: "balanced",
    label: "Balanced",
    hint: "Title, years, core skills and a result, in that order.",
    words: [70, 100],
    brief: "4 sentences: identity (title, years, specialization); the kinds of systems built; the main tools tied to what was done with them; end with 1 or 2 measured results."
  },
  {
    id: "impact",
    label: "Impact first",
    hint: "Leads with measured results.",
    words: [60, 95],
    brief: "Open with title and years, then put the measured results early (second sentence), then the skills and systems that produced them. Results are quoted exactly."
  },
  {
    id: "technical",
    label: "Technical depth",
    hint: "More frameworks and platforms, for engineering readers.",
    words: [75, 110],
    brief: "Title and years, then the architecture and engineering detail: frameworks, cloud platforms, deployment and evaluation practices, each tied to what was built. End with one result."
  },
  {
    id: "concise",
    label: "Concise",
    hint: "Three short sentences, quick to scan.",
    words: [40, 65],
    maxSkills: 5,
    brief: "Exactly 3 short sentences: title, years and specialization; the 4 to 5 most important skills in context; one measured result."
  },
  {
    id: "targeted",
    label: "Role-targeted",
    hint: "Worded toward the target role or job description.",
    words: [65, 100],
    brief: "Word every sentence toward targetTitle and jobDescription: put the skills that role needs first, using only skills the candidate has. If neither is given, write for a recruiter outside engineering: plain words, fewer acronyms."
  }
];

const PROMPT = [
  "You are an expert resume writer. Write ONE version of a professional summary in the requested style.",
  ATS_RULES,
  "- Every summary states: a real job title, years of experience (use yearsOfExperience as",
  "  \"N+ years\" exactly, never more), the most relevant skills, and at least one measured",
  "  achievement copied exactly from achievements.",
  "- Never name an employer, client or school.",
  "- Describe the candidate by a real title from jobTitles. targetTitle only guides emphasis:",
  "  never add a seniority (Senior, Lead, Principal, Staff) that jobTitles don't have.",
  "- Name at most maxSkills skills, the most relevant ones, each tied to what was built with it.",
  "  No long \"Proficient in A, B, C, D...\" lists.",
  "- Don't open with \"Experienced\" or use \"demonstrated success\", \"expertise in\" or",
  "  \"proficient in\": start with the job title and say what was done.",
  "- No generic closing phrases; the summary ends with substance, not a slogan.",
  "- currentSummary shows facts and tone the candidate already uses; you may reuse its facts.",
  "- Follow style.brief and stay within style.words words.",
  "- If feedback is given, rewrite draftSummary to fix exactly that.",
  'Reply with JSON only: {"summary": string}'
].join("\n");

const FIRST_PERSON = /\b(I|me|my|mine|we|our|us)\b/;
// Only as part of a title ("Senior AI Engineer"), not the verb ("lead design")
const SENIORITY = /\b(?:Senior|Sr\.|Lead|Principal|Staff|Chief)(?=\s+[A-Z])/;
const FILLER = /^experienced\b|\bdemonstrated (success|ability)\b|\bproficient in\b|\bexpertise in\b/i;
const DEFAULT_MAX_SKILLS = 8;

// Distinct skills and tools a text names
const skillsNamed = (text, source) => [...new Set([
  ...(source.skills || []).map((skill) => skill.name).filter((name) => mentions(text, name)).map((name) => name.toLowerCase()),
  ...dictionaryKeywords(text).map((name) => name.toLowerCase())
])];
const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();

// Everything the portfolio says, to check a draft's facts against
function allowedTextOf(source) {
  const parts = [source.summary];
  for (const item of source.experiences || []) {
    parts.push(item.title, item.summary, item.highlights, ...item.bullets, ...item.skills);
    for (const project of item.projects || []) parts.push(project.title, project.description, ...project.tasks);
  }
  for (const item of source.projects || []) parts.push(item.title, item.description, ...item.bullets, ...item.skills);
  for (const item of source.educations || []) parts.push(item.degree, item.fieldOfStudy, item.description, ...item.bullets);
  parts.push(...(source.skills || []).map((skill) => skill.name));
  parts.push(...(source.certifications || []).map((item) => item.title));
  return parts.filter(Boolean).join("\n");
}

const achievementsOf = (source) =>
  [...(source.experiences || []).flatMap((item) => [...item.bullets, ...(item.projects || []).flatMap((p) => p.tasks)]),
    ...(source.projects || []).flatMap((item) => item.bullets)]
    .filter((line) => /\d+(?:\.\d+)?\s?%|\$\d|\b\d+(?:\.\d+)?[KMB]\b|\b\d+x\b/i.test(line))
    .slice(0, 8);

const titlesOf = (source) => [...new Set((source.experiences || []).map((item) => item.title).filter(Boolean))];

// Job-title words common enough to recognise a title written in other words
const ROLE_WORDS = /\b(engineer|developer|scientist|analyst|architect|manager|designer|consultant|specialist|administrator|lead|director|nurse|technician|researcher|intern)\b/i;

// The four things a summary needs, per the summary guidance:
// [{ id, label, ok, detail }]
function reviewSummary(text, source) {
  const summary = clean(text);
  const titles = titlesOf(source);
  const skills = (source.skills || []).map((skill) => skill.name);
  const shownSkills = skills.filter((skill) => mentions(summary, skill));
  const tools = [...new Set([...shownSkills, ...dictionaryKeywords(summary)])];
  const words = wordCount(summary);
  const title = titles.find((name) => mentions(summary, name)) || summary.match(ROLE_WORDS)?.[0];
  const years = summary.match(/\b(\d+)\+?\s*(?:years?|yrs?)\b/i);
  const result = summary.match(/\d+(?:\.\d+)?\s?%|\$\d[\d,.]*[KMB]?|\b\d+(?:\.\d+)?[KMB]\b|\b\d+x\b/i);

  return [
    { id: "title", label: "Job title", ok: Boolean(title),
      detail: title ? `States the role ("${title}").` : `Name your role${titles[0] ? `, e.g. "${titles[0]}"` : ""}.` },
    { id: "years", label: "Experience level", ok: Boolean(years),
      detail: years ? `Says "${years[0]}".` : "Say how many years of experience you have." },
    { id: "skills", label: "Key skills", ok: tools.length >= 3 && tools.length <= 12,
      detail: tools.length < 3 ? "Name 3 to 8 skills that matter for the roles you want."
        : tools.length > 12 ? `Names ${tools.length} skills; keep the 5 to 8 most relevant so they stand out.`
          : `Highlights ${tools.slice(0, 5).join(", ")}${tools.length > 5 ? "…" : ""}.` },
    { id: "achievement", label: "Achievement", ok: Boolean(result),
      detail: result ? `Shows a measured result (${result[0]}).` : "Add one measured result from your work." },
    { id: "length", label: "Length", ok: words >= 40 && words <= 120,
      detail: words < 40 ? `${words} words: a little thin; aim for 40 to 120.`
        : words > 120 ? `${words} words: too long to scan; aim for 40 to 120.` : `${words} words: easy to scan.` }
  ];
}

// A seniority word that no real job title has ("Senior" from the target role)
function falseSeniority(draft, titles) {
  const seniority = draft.match(SENIORITY);
  if (!seniority || !titles.length) return null;
  const word = seniority[0].toLowerCase().replace(/\.$/, "").replace(/^sr$/, "senior");
  return titles.some((title) => title.toLowerCase().includes(word)) ? null : seniority[0];
}

// "Senior AI Engineer" -> "AI Engineer" when no real title is senior
const withoutFalseSeniority = (draft, titles) =>
  falseSeniority(draft, titles)
    ? draft.replace(SENIORITY, "").replace(/\s{2,}/g, " ").trim()
    : draft;

// Facts that make a draft unusable, or null: these are never shown
function problemWith(draft, { allowedText, employers, years, titles = [] }) {
  if (!draft) return "came back empty";
  const words = wordCount(draft);
  if (words < 25 || words > 160) return `has ${words} words`;
  const seniority = falseSeniority(draft, titles);
  if (seniority) return `calls the candidate "${seniority}", which no job title says`;
  const claimed = draft.match(/\b(\d+)\+?\s*(?:years?|yrs?)\b/i);
  if (claimed && years !== null && Number(claimed[1]) > years) return `claims ${claimed[1]} years; the job dates show ${years}`;
  if (inventsNumbers(draft, `${allowedText}\n${years ?? ""}`)) return "has a number that isn't in the portfolio";
  const foreign = dictionaryKeywords(draft).filter((tool) => !mentions(allowedText, tool));
  if (foreign.length) return `names tools not in the portfolio (${foreign.join(", ")})`;
  if (withoutEmployers(draft, employers).dropped) return "names an employer, client or school";
  return null;
}

// Style issues: asked to fix once, then shown as warnings on the version
function styleIssues(draft, { style, source = {} }) {
  const issues = [];
  const words = wordCount(draft);
  const [min, max] = style.words;
  if (words < min - 12 || words > max + 20) issues.push(`has ${words} words; write ${min} to ${max}`);
  if (FIRST_PERSON.test(draft)) issues.push("uses first-person words (I, my, we)");
  if (GENERIC_PHRASES.test(draft)) issues.push(`uses the generic phrase "${draft.match(GENERIC_PHRASES)[0]}"`);
  if (FILLER.test(draft)) issues.push(`uses the filler phrase "${draft.match(FILLER)[0]}"; start with the job title and say what was done`);
  const target = style.maxSkills || DEFAULT_MAX_SKILLS;
  const named = skillsNamed(draft, source);
  // A little slack over the target: "LangGraph agents" and "agents" both count
  if (named.length > target + 3) issues.push(`names ${named.length} skills; keep the ${target} most relevant`);
  return issues;
}

// source: gatherResumeData() output. Returns { variants, review, notes }.
async function generateSummaryVariants({ llm, source, targetTitle = "", jobDescription = "", instructions = "", signal, onProgress }) {
  const years = experienceYears(source.experiences || []);
  const wholeYears = years ? Math.floor(years) : null;
  const allowedText = allowedTextOf(source);
  const employers = [
    ...(source.experiences || []).map((item) => item.organization),
    ...(source.educations || []).map((item) => item.institution)
  ];
  const base = {
    currentSummary: source.summary,
    jobTitles: titlesOf(source),
    yearsOfExperience: wholeYears,
    skills: (source.skills || []).slice(0, 40).map((skill) => skill.name),
    achievements: achievementsOf(source),
    work: (source.experiences || []).slice(0, 4).map((item) => ({
      title: item.title, tasks: item.bullets.slice(0, 6), skills: item.skills.slice(0, 12)
    })),
    projects: (source.projects || []).slice(0, 4).map((item) => ({ title: item.title, description: item.description, skills: item.skills.slice(0, 10) })),
    targetTitle: clean(targetTitle),
    jobDescription: String(jobDescription || "").slice(0, 4000),
    userInstructions: clean(instructions)
  };

  const variants = [];
  const notes = [];
  for (const [index, style] of STYLES.entries()) {
    onProgress?.(`Writing version ${index + 1} of ${STYLES.length}: ${style.label}`);
    const payload = {
      ...base,
      maxSkills: style.maxSkills || DEFAULT_MAX_SKILLS,
      style: { name: style.label, brief: style.brief, words: `${style.words[0]} to ${style.words[1]}` }
    };
    const task = { allowedText, employers, years: wholeYears, style, titles: base.jobTitles, source };

    try {
      const ask = async (extra) => withoutFalseSeniority(clean((await llm.invokeJson(PROMPT, { ...payload, ...extra }, signal)).summary), task.titles);
      let draft = await ask({});
      let problem = problemWith(draft, task);
      let issues = problem ? [] : styleIssues(draft, task);
      if (problem || issues.length) {
        const retry = await ask({ draftSummary: draft, feedback: `This draft ${[problem, ...issues].filter(Boolean).join("; ")}. Fix that.` });
        const retryProblem = problemWith(retry, task);
        const retryIssues = retryProblem ? [] : styleIssues(retry, task);
        // Keep whichever draft is usable and has fewer style issues
        if (!retryProblem && (problem || retryIssues.length <= issues.length)) {
          draft = retry;
          problem = null;
          issues = retryIssues;
        }
      }
      if (problem) {
        notes.push(`${style.label}: left out because it ${problem}.`);
        continue;
      }
      const review = reviewSummary(draft, source);
      if (issues.length) review.push({ id: "style", label: "Wording", ok: false, detail: `This version ${issues.join("; ")}.` });
      variants.push({ id: style.id, label: style.label, hint: style.hint, summary: draft, words: wordCount(draft), review });
    } catch (error) {
      if (signal?.aborted) throw error;
      notes.push(`${style.label}: the AI didn't answer (${error.message}).`);
    }
  }

  return { variants, review: source.summary ? reviewSummary(source.summary, source) : [], notes };
}

module.exports = { generateSummaryVariants, reviewSummary, problemWith, styleIssues, STYLES, allowedTextOf, titlesOf, falseSeniority };
