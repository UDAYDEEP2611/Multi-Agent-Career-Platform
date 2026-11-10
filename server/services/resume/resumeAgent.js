const { StateGraph, Annotation, START, END } = require("@langchain/langgraph");
const { lines } = require("./resumeData");
const { dateRange, formatDate, cleanBullet, inventsNumbers, mentions, isSkillKeyword, resumeText, bulletProblems } = require("./atsRules");
const { dictionaryKeywords } = require("./skillDictionary");
const { tidyText, onlyTypoFixes, knownSkill } = require("./resumeQuality");
const { baselineRequirements, criticalKeywords } = require("../match/requirements");
const { experienceYears } = require("../match/evidence");
const { callTool } = require("../../mcp/toolClient");
const { weaveKeywords } = require("./keywordWeaver");

// The resume agent, as a LangGraph state graph:
//
//   prepare → analyzeJob → writeSummary → writeExperience → writeProjects
//     → weaveKeywords → orderSkills → proofread → atsReview
//   atsReview → reviseBullets → proofread → atsReview (once, if bullets fail)
//
// prepare is plain code; proofread fixes known misspellings in code and asks
// the model only for other typos. Tools come from the portfolio MCP server
// (mcp/portfolioMcpServer.js) through an MCP client: analyzeJob calls
// find_job_keywords, orderSkills calls group_skills, and atsReview calls
// check_ats, which hands the resume to the ATS Reviewer agent over A2A
// (a2a/atsReviewerAgent.js). The others ask the
// language model (Ollama), and only when AI is turned on. weaveKeywords runs
// the Keyword Matcher and Keyword Weaver agents (keywordWeaver.js), which
// work important job keywords missing from the bullets into the work they
// belong to; keywords that fit no work go to Skills instead. Whatever the model writes is checked: bullets that add numbers
// not in the user's own text are dropped, and anything unusable falls back
// to the user's original wording.

const MAX_REVISIONS = 1;

const ATS_RULES = [
  "Follow ATS (applicant tracking system) best practices:",
  "- Plain text only: no emojis, symbols, tables or markdown.",
  "- No first-person pronouns (I, me, my, we).",
  "- Use standard, specific wording recruiters search for.",
  "- Use ONLY facts in the input. Never invent employers, numbers, percentages,",
  "  team sizes, tools, certifications or results.",
  "- targetJobKeywords are skills the candidate already has that the job asks for:",
  "  use them where they fit. Never mention any skill or tool not in the input.",
  "- Describe the candidate by their real job titles; the target title only guides emphasis.",
  "- No buzzwords: never write leverage, utilize, spearhead, robust, seamless, cutting-edge,",
  "  innovative, synergy, passionate, results-driven or \"proven track record\". Say what was done.",
  "- Use short forms: NLP, LLMs, RAG, MCP, A2A, CI/CD, GCP, AWS, OCI (not the spelled-out names).",
  "- userInstructions, if given, are the candidate's own preferences (tone, focus, what to",
  "  leave out): follow them, except never invent facts even if asked."
].join("\n");

const SUMMARY_PROMPT = [
  "You are an expert resume writer. Write the professional summary at the top of a resume.",
  ATS_RULES,
  "- General and company-independent: it represents the candidate's whole engineering",
  "  background. Never name an employer, client or school.",
  "- 75 to 100 words in 4 sentences, readable in 15 to 20 seconds:",
  "  1. Identity (about 15%): role (target title if given), years of experience and primary",
  "     specialization.",
  "  2. AI systems and expertise (about 35%): the kinds of systems built (LLM applications, RAG",
  "     pipelines, agents, predictive models) and what they do. Capabilities, not a tool list.",
  "  3. Technical implementation (about 30%): the most relevant frameworks, cloud platforms and",
  "     deployment and evaluation tools, tied to what was done with them.",
  "  4. Measured impact (about 20%): end with 1 or 2 results from achievements, numbers exactly",
  "     as written.",
  "- Name 5 to 8 highly relevant technical keywords in total, not every skill. Engineering",
  "  responsibilities matter more than a long technology inventory.",
  "- Follow emphasis: it says which kind of work to give the most space.",
  "- No generic closing phrases (\"passionate about innovation\", \"driving AI transformation\",",
  "  \"delivering business value\"): the last sentence is a measured result.",
  "- Use only skills from the candidate's data.",
  "- If jobDescription is given, word the sentences toward what that job needs and use",
  "  targetJobKeywords where they fit; never claim skills that are only in the job.",
  "- If feedback is given, rewrite draftSummary to fix exactly that.",
  'Reply with JSON only: {"summary": string}'
].join("\n");

const BULLETS_PROMPT = [
  "You are an expert resume writer. Rewrite the bullet points for ONE resume entry.",
  ATS_RULES,
  "- Write exactly bulletCount bullets (fewer only if the input has too little information).",
  "  Pick the most impressive and job-relevant facts from tasks, context and relatedProjects;",
  "  combine small related tasks into one bullet.",
  "- Each bullet starts with a different strong action verb, past tense (present tense if the",
  "  entry is current): Architected, Engineered, Automated, Deployed, Designed, Delivered,",
  "  Modeled, Trained, Implemented, Optimized, Developed, Built, Created, Scaled, Integrated,",
  "  Reduced, Streamlined. Never use a verb listed in avoidVerbs.",
  "- Never start with \"Responsible for\", \"Worked on\", \"Helped\" or \"Assisted\".",
  "- Don't overstate the role: something the candidate helped with becomes \"Supported\" or",
  "  \"Contributed to\", never \"Led\" or \"Owned\".",
  "- Length: bulletLength (about two full lines).",
  "- Structure every bullet as: <action> <system or component> <technical implementation>",
  "  <scale or quality> <measured outcome>. Explain what was built and how, not just which",
  "  tools: e.g. for RAG, the ingestion, chunking, embeddings, vector indexing, hybrid retrieval,",
  "  reranking or grounding steps; for agents, the state, orchestration, MCP tools, A2A and",
  "  human approvals; for ML, features, training, validation and serving. Describe only the",
  "  steps the input mentions. Link work to results with \"reducing\", \"cutting\", \"improving\".",
  "- Don't tack tools or platforms onto the end of a sentence (\"...by 38% on AWS\"): name them",
  "  where they were used, in the middle of the bullet.",
  "- With bulletCount 1 (a project), write ONE bullet: what was built, how it works with",
  "  the key technologies, and the result.",
  "- Mention only skills and tools that appear in THIS entry's tasks, context, skillsUsed",
  "  or relatedProjects. Never add skills from elsewhere, and never pad thin entries.",
  "- Prefer the most impressive facts: shipped systems, deployments, projects, measurable results.",
  "- Each bullet is ONE achievement: never join several into one bullet.",
  "- If draftBullets are given, improve those; otherwise write from tasks and context.",
  "- jobThemes are what the target job values beyond tools (e.g. working with product managers",
  "  and stakeholders). Where the input has facts that show them, keep those facts in a bullet;",
  "  never invent them.",
  "- Don't repeat the job title, company name or dates in the bullets.",
  "- End every bullet with a period.",
  "- If feedback is given, fix exactly those problems.",
  'Reply with JSON only: {"bullets": string[]}'
].join("\n");

const PROOFREAD_PROMPT = [
  "You are a proofreader. Fix ONLY spelling mistakes and typos in each text.",
  "- Do not reword, reorder, add or remove words, or change punctuation style.",
  "- Keep technical terms, product names, company names and acronyms as written,",
  "  except obvious typos of them (e.g. \"Langchian\" -> \"LangChain\").",
  "- Never change numbers.",
  "- Return the texts in the same order, same count.",
  'Reply with JSON only: {"texts": string[]}'
].join("\n");

const KEYWORDS_PROMPT = [
  "Extract the skills an ATS would search for from this job description.",
  "Return ONLY things a candidate could list as a skill on a resume:",
  "- programming languages, frameworks, libraries, tools, platforms, cloud services, databases",
  "- technical concepts and methods (e.g. RAG, LLMs, CI/CD, microservices, machine learning)",
  "- certifications",
  "- at most 3 specific domain skills if central to the job (e.g. CRM data, financial modeling)",
  "Do NOT return: job titles, company or team names, locations, onsite/remote/hybrid,",
  "salary or pay, benefits, years of experience, degrees, plain verbs (design, develop, deploy)",
  "or soft-skill phrases (team player, fast-paced, operational efficiency).",
  "Each keyword is 1 to 3 words in the job description's own wording. Most important first, at most 15.",
  'Example: "Senior Data Engineer, Austin, TX (Hybrid), $150k + benefits. Build ETL pipelines in Python and',
  'Spark on AWS with Airflow and SQL. 5+ years." -> {"keywords": ["Python", "Spark", "AWS", "ETL pipelines", "Airflow", "SQL"]}',
  'Reply with JSON only: {"keywords": string[]}'
].join("\n");

const State = Annotation.Root({
  source: Annotation(),
  options: Annotation(),
  keywords: Annotation({ reducer: (_, next) => next, default: () => [] }),
  // The job keywords the candidate's own data already mentions
  supportedKeywords: Annotation({ reducer: (_, next) => next, default: () => [] }),
  // Job keywords that must end up on the resume (in bullets or Skills)
  importantKeywords: Annotation({ reducer: (_, next) => next, default: () => [] }),
  resume: Annotation(),
  review: Annotation(),
  revisions: Annotation({ reducer: (_, next) => next, default: () => 0 }),
  aiCalls: Annotation({ reducer: (total, added) => total + added, default: () => 0 }),
  notes: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] }),
  // MCP tools the agent called, and who did the ATS review
  toolCalls: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] }),
  reviewedBy: Annotation()
});

const tools = (config) => ({
  llm: config?.configurable?.llm,
  progress: config?.configurable?.onProgress || (() => {}),
  signal: config?.configurable?.signal
});

const sentences = (text) =>
  String(text || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 15);

// The user's own bullets, or failing that, lines from their description
function startingBullets(bullets, ...fallbackTexts) {
  let list = bullets.map(cleanBullet).filter(Boolean);

  for (const text of fallbackTexts) {
    if (list.length) break;
    const fromLines = lines(text);
    list = (fromLines.length > 1 ? fromLines : sentences(text)).map(cleanBullet).filter(Boolean);
  }

  return list.slice(0, 8);
}

const PROJECT_BULLET_MAX = 300;
// The title is left out: it names the project ("Agentic AI Assistant"), not its tools
const projectText = (item) => [item.description, ...item.bullets].join("\n");

// About 5 lines of resume text. Longer summaries are cut back to whole
// sentences that fit.
const SUMMARY_MIN_WORDS = 75;
const SUMMARY_MAX_WORDS = 100;
const wordCount = (text) => (String(text).match(/\S+/g) || []).length;
// Closing lines that say nothing: "passionate about innovation"
const GENERIC_PHRASES = /\b(passionate|cutting[- ]edge|transformation|innovati\w*|thought leader|dynamic|results[- ]driven|business value|strive|eager)\b/i;

// Which work a summary gives the most space to, by the role it targets
function summaryEmphasis(targetTitle, jobDescription) {
  const text = `${targetTitle || ""} ${String(jobDescription || "").slice(0, 1500)}`.toLowerCase();
  const llm = (text.match(/\b(llms?|genai|generative|agents?|agentic|rag|prompt)\b/g) || []).length;
  const ml = (text.match(/\b(machine learning|ml engineer|model training|feature engineering|mlops|inference|predictive|data scien\w*)\b/g) || []).length;
  if (!llm && !ml) return undefined;
  return llm >= ml
    ? "AI/LLM engineering: give most space to LLMs, RAG, agents, evaluation and deployment."
    : "ML engineering: give most space to model training, feature engineering, inference, evaluation and MLOps.";
}

function fitSummary(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (wordCount(clean) <= SUMMARY_MAX_WORDS) return clean;

  let fitted = "";
  for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
    if (wordCount(`${fitted} ${sentence}`) > SUMMARY_MAX_WORDS) break;
    fitted = `${fitted} ${sentence}`.trim();
  }
  return fitted || clean.split(/\s+/).slice(0, SUMMARY_MAX_WORDS).join(" ") + "…";
}

// Roughly how many facts an entry has to draw bullets from
const richness = (item) =>
  (item.bullets?.length || 0) +
  sentences([item.summary, item.highlights, item.description].filter(Boolean).join(" ")).length +
  (item.projects?.length || 0) * 2;

// Whole years of work from real job dates, overlapping jobs counted once
function yearsOfExperience(experiences) {
  const years = experienceYears(experiences);
  return years ? Math.floor(years) : null;
}

// "…reducing manual workflow steps by 34%…" -> "reducing manual workflow steps by 34%"
const RESULT_VERBS = { reduc: "reducing", improv: "improving", cut: "cutting", increas: "increasing", rais: "raising",
  lower: "lowering", sav: "saving", boost: "boosting", grow: "growing", decreas: "decreasing" };

function resultClauses(tasks) {
  const clauses = [];
  for (const task of tasks) {
    const match = task.match(/\b(reduc|improv|cut|increas|rais|lower|sav|boost|grow|decreas)[a-z]*\s+([^,.;]*?\bby\s+\d+(?:\.\d+)?%)/i);
    if (match) clauses.push(`${RESULT_VERBS[match[1].toLowerCase()]} ${match[2].trim()}`);
  }
  return clauses;
}

// Keeps a summary sentence with a result ("…by 37%") only if that result
// comes from a task naming the same tools, so a number is never pinned on
// the wrong work ("MCP servers… 37%" when 37% came from support apps)
function keepAttributedResults(summary, achievements) {
  const sentences = summary.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => {
    const results = sentence.match(/\d+(?:\.\d+)?\s?%/g);
    if (!results) return true;
    const tools = dictionaryKeywords(sentence);
    return results.every((result) => achievements.some((task) =>
      task.includes(result.replace(/\s/g, "")) && tools.every((tool) => mentions(task, tool))));
  });
  return { text: kept.join(" "), dropped: sentences.length - kept.length };
}

// "Tata Consultancy Services (Client: Verizon)" -> both names
const employerNames = (names) => names.filter(Boolean).flatMap((name) => {
  const bracket = name.match(/^(.*?)\s*\((?:client:\s*)?([^)]+)\)$/i);
  return bracket ? [bracket[1], bracket[2]] : [name];
}).map((name) => name.trim()).filter((name) => name.length >= 3);

// Drops summary sentences that name an employer, client or school. Skills
// that contain a company name ("Oracle AI Vector Search") don't count.
function withoutEmployers(summary, names) {
  const employers = employerNames(names);
  const sentences = summary.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => {
    const skillsRemoved = dictionaryKeywords(sentence).reduce(
      (rest, skill) => rest.split(new RegExp(escapeRegExp(skill), "i")).join(" "), sentence);
    return !employers.some((name) => mentions(skillsRemoved, name));
  });
  return { text: kept.join(" "), dropped: sentences.length - kept.length };
}

// A summary sentence quoting the candidate's own results, word for word
function resultsSentence(tasks) {
  const clauses = resultClauses(tasks).slice(0, 2);
  return clauses.length ? `Results include ${clauses.join(" and ")}.` : "";
}

// The candidate's measured results, for the summary to quote
const achievementsOf = (experiences) =>
  experiences.flatMap((item) => item.bullets).filter((task) => /\d+(\.\d+)?\s?%|\d+[KMB+]/.test(task)).slice(0, 6);

// ---- Nodes -----------------------------------------------------------------

// Optional sections keep the user's own words; descriptions become bullets
function extraItem(item) {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle || "",
    dates: item.start !== undefined ? dateRange(item) : formatDate(item.date),
    detail: item.detail || "",
    bullets: startingBullets([], item.description).slice(0, 3)
  };
}

function prepare({ source, options }) {
  const { sections } = options;

  const resume = {
    sections,
    targetTitle: options.targetTitle,
    showContact: options.showContact,
    contact: source.contact,
    summary: sections.summary ? fitSummary(source.summary) : "",
    // The latest job gets 4 bullets, older ones 3 (or 2 with little to say)
    experience: source.experiences.map((item, index) => {
      const bullets = startingBullets(item.bullets, item.highlights, item.summary);
      // Recent jobs get 3-5 bullets, older ones 2-3, by how much there is to say
      const rich = richness(item);
      const target = index === 0
        ? (rich >= 8 ? 5 : 4)
        : index === 1
          ? (rich >= 6 ? 4 : rich >= 3 ? 3 : 2)
          : (rich >= 3 ? 3 : 2);

      return {
        id: item.id,
        title: item.title,
        organization: item.organization,
        location: item.location,
        dates: dateRange(item),
        start: item.start,
        end: item.end,
        current: item.current,
        targetBullets: target,
        bullets: bullets.slice(0, options.useAi ? target : Math.max(target, 3))
      };
    }),
    education: source.educations.map((item) => ({
      id: item.id,
      institution: item.institution,
      degree: item.degree,
      fieldOfStudy: item.fieldOfStudy,
      location: item.location,
      dates: dateRange(item),
      start: item.start,
      grade: item.grade,
      courses: item.courses.slice(0, 8),
      bullets: item.bullets.map(cleanBullet).filter(Boolean).slice(0, 4)
    })),
    projects: source.projects.map((item) => ({
      id: item.id,
      title: item.title,
      role: item.role,
      dates: dateRange(item),
      start: item.start,
      current: item.current,
      link: item.link,
      // "Title | LangGraph, MCP, FastAPI" and one bullet of about two lines
      skills: [...new Set([...item.skills, ...dictionaryKeywords(projectText(item))])].slice(0, 8),
      targetBullets: 1,
      maxLength: PROJECT_BULLET_MAX,
      bullets: startingBullets(item.bullets, item.description).slice(0, 1)
    })),
    skills: {
      technical: source.skills.filter((skill) => skill.skillType !== "soft").map((skill) => skill.name),
      soft: source.skills.filter((skill) => skill.skillType === "soft").map((skill) => skill.name)
    },
    extras: {
      certifications: (source.certifications || []).map(extraItem),
      achievements: (source.achievements || []).map(extraItem),
      volunteering: (source.volunteering || []).map(extraItem),
      publications: (source.publications || []).map(extraItem),
      patents: (source.patents || []).map(extraItem),
      interests: (source.interests || []).map((item) => item.title)
    }
  };

  return { resume };
}

// Job keywords: known skills found in the text (always), plus what the
// model picks out (when AI is on)
async function keywords({ source, options }, config) {
  const description = options.jobDescription;
  if (!description) return {};

  const usable = (keyword) => isSkillKeyword(keyword, options.targetTitle);
  // Known skills in the job, from the portfolio MCP server's tool
  const { keywords: fromDictionary } = await callTool("find_job_keywords", {
    jobDescription: description,
    extraSkills: source.skills.map((skill) => skill.name),
    targetTitle: options.targetTitle
  });

  let fromAi = [];
  const update = { toolCalls: ["find_job_keywords"] };

  if (options.useAi) {
    const { llm, progress, signal } = tools(config);
    progress("Reading the job description for keywords");
    update.aiCalls = 1;

    try {
      const reply = await llm.invokeJson(KEYWORDS_PROMPT, { jobDescription: description }, signal);
      // Only real skills: job phrases like "conversational experiences" or
      // "intelligent automation workflows" are never keywords
      fromAi = (Array.isArray(reply.keywords) ? reply.keywords : [])
        .filter((keyword) => typeof keyword === "string")
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword && keyword.length <= 40 && usable(keyword))
        .map((keyword) => knownSkill(keyword))
        .filter((keyword) => keyword && !TOO_GENERIC_KEYWORDS.has(keyword.toLowerCase()))
        .slice(0, 15);
    } catch (error) {
      if (signal?.aborted) throw error;
      update.notes = ["The AI couldn't read the job description; matched known skills only."];
    }
  }

  // The job's own wording first ("LLMs", "RAG"), then anything the AI found
  // that isn't the same skill under another name
  const same = (a, b) => mentions(a, b) || mentions(b, a) || (knownSkill(a) && knownSkill(a) === knownSkill(b));
  const list = [];
  for (const keyword of [...fromDictionary, ...fromAi]) {
    if (!list.some((kept) => same(kept, keyword))) list.push(keyword);
  }

  // Only these reach the writers, so the AI can't claim skills the user
  // doesn't have; the rest are shown to the user as missing
  const candidateText = JSON.stringify(source);
  const supportedKeywords = list.filter((keyword) => mentions(candidateText, keyword));

  return { ...update, keywords: list.slice(0, 20), supportedKeywords };
}

// What the summary writer sees
function summaryPayload({ source, options, resume, jobKeywords }) {
  return {
    targetTitle: options.targetTitle,
    currentSummary: source.summary,
    yearsOfExperience: yearsOfExperience(source.experiences),
    // The summary ends with 1 or 2 of these
    achievements: achievementsOf(source.experiences),
    emphasis: summaryEmphasis(options.targetTitle, options.jobDescription),
    jobThemes: jobThemesOf(options.jobDescription),
    // Job titles without employers: the summary never names them
    roles: resume.experience.map((item) => `${item.title} (${item.dates})`),
    education: resume.education.map((item) => [item.degree, item.fieldOfStudy].filter(Boolean).join(", ")),
    skills: [...resume.skills.technical.slice(0, 30), ...resume.skills.soft.slice(0, 5)],
    certifications: resume.extras.certifications.map((item) => item.title),
    targetJobKeywords: jobKeywords,
    jobDescription: options.jobDescription ? options.jobDescription.slice(0, 1500) : undefined,
    userInstructions: options.instructions || undefined
  };
}

async function summary({ source, options, resume, supportedKeywords: jobKeywords }, config) {
  if (!options.useAi || !options.sections.summary) return {};

  const { llm, progress, signal } = tools(config);
  progress("Writing your professional summary");

  const payload = summaryPayload({ source, options, resume, jobKeywords });

  try {
    // Numbers must come from the candidate's data, not the job post
    const sourceText = JSON.stringify({ ...payload, jobDescription: undefined });
    const usable = (text) => text.length >= 80 && !inventsNumbers(text, sourceText);
    // A measured result ("by 38%"), not just a size like "10TB+"
    const hasResult = (text) => /\d+(?:\.\d+)?\s?%/.test(text);

    // What's wrong with a draft, by the summary rules
    const problems = (draft) => {
      const list = [];
      const words = wordCount(draft);
      if (words < SUMMARY_MIN_WORDS || words > SUMMARY_MAX_WORDS) list.push(`It has ${words} words; write ${SUMMARY_MIN_WORDS} to ${SUMMARY_MAX_WORDS}.`);
      if (payload.achievements.length && !hasResult(draft)) list.push("End with 1 or 2 results from achievements, numbers exactly as written.");
      const named = dictionaryKeywords(draft).length;
      if (named > 8) list.push(`It names ${named} tools; keep the 5 to 8 most relevant and describe the work instead.`);
      if (GENERIC_PHRASES.test(draft)) list.push(`Remove the generic phrase "${draft.match(GENERIC_PHRASES)[0]}".`);
      return list;
    };

    let text = fitSummary((await llm.invokeJson(SUMMARY_PROMPT, payload, signal)).summary || "");
    let calls = 1;

    // Ask once more with what to fix, and keep whichever draft has fewer problems
    const first = problems(text);
    if (!usable(text) || first.length) {
      calls += 1;
      const retry = fitSummary((await llm.invokeJson(SUMMARY_PROMPT, {
        ...payload,
        draftSummary: text,
        feedback: first.join(" ") || "Keep every number exactly as it is in achievements."
      }, signal)).summary || "");
      if (usable(retry) && (!usable(text) || problems(retry).length <= first.length)) text = retry;
    }

    if (!usable(text)) {
      return { notes: ["Kept your own summary: the AI version didn't pass the checks."], aiCalls: calls };
    }

    // Results pinned on the wrong work are taken out
    const attributed = keepAttributedResults(text, payload.achievements);
    if (attributed.dropped) text = attributed.text;

    // A general summary names no employer, client or school
    const unnamed = withoutEmployers(text, [
      ...source.experiences.map((item) => item.organization),
      ...source.educations.map((item) => item.institution)
    ]);
    if (unnamed.dropped) text = unnamed.text;

    // Generic closing lines say nothing: drop them
    const sentences = text.split(/(?<=[.!?])\s+/);
    const specific = sentences.filter((sentence) => !GENERIC_PHRASES.test(sentence));
    if (specific.length && specific.length < sentences.length) text = specific.join(" ");

    // Still no measured result: end with one sentence of the candidate's own results
    const results = hasResult(text) ? "" : resultsSentence(payload.achievements);
    if (results) {
      let withResults = `${text} ${results}`;
      // Make room by dropping the last sentence if it would run past 100 words
      if (wordCount(withResults) > SUMMARY_MAX_WORDS) {
        withResults = `${text.split(/(?<=[.!?])\s+/).slice(0, -1).join(" ")} ${results}`;
      }
      if (wordCount(withResults) <= SUMMARY_MAX_WORDS) text = withResults.trim();
    }

    return { resume: { ...resume, summary: text }, aiCalls: calls };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { notes: ["Couldn't rewrite the summary; kept your own."], aiCalls: 1 };
  }
}

// Asks the model for better bullets for one entry; null if unusable
// Implementation steps a bullet may only describe if the user's own text does
const IMPLEMENTATION_STEPS = [
  ["chunking", /\bchunk(ing|s|ed)?\b/i],
  ["embeddings", /\bembedding/i],
  ["reranking", /\bre-?rank/i],
  ["hybrid retrieval", /\bhybrid (retrieval|search)/i],
  ["vector indexing", /\bvector (index|indexing|indices)/i],
  ["semantic caching", /\bsemantic cach/i],
  ["ingestion", /\bingest/i],
  ["grounding checks", /\bground(edness|ing)\b/i],
  ["tracing", /\btrac(ing|es)\b/i],
  ["drift monitoring", /\bdrift/i],
  ["A/B testing", /\ba\/b test/i],
  ["fine-tuning", /\bfine[- ]?tun/i],
  ["quantization", /\bquantiz/i],
  ["RBAC", /\brbac\b|role-based access/i],
  ["PII redaction", /\bpii\b/i],
  ["prompt-injection defenses", /prompt[- ]injection/i],
  ["guardrails", /\bguardrail/i],
  ["audit logging", /\baudit (log|trail)/i],
  ["canary or blue-green releases", /\b(canary|blue[- ]green)\b/i],
  ["autoscaling", /\bauto-?scal/i],
  ["load testing", /\bload test/i],
  ["feature store", /\bfeature store/i]
];

const STOPWORDS = new Set("the a an and or of for to in on with by from using across over into via as at is was were that this".split(" "));
const contentWords = (text) => new Set((text.toLowerCase().match(/[a-z0-9%+]+/g) || []).filter((word) => !STOPWORDS.has(word)));
const numbersOf = (text) => text.match(/\d+(?:[.,]\d+)*%?\+?/g) || [];

// True when two bullets tell the same story: the same result number, or
// most of their words in common
function sameStory(a, b) {
  if (numbersOf(a).some((number) => /%|\+/.test(number) && numbersOf(b).includes(number))) return true;
  const wordsA = contentWords(a);
  const wordsB = contentWords(b);
  const shared = [...wordsA].filter((word) => wordsB.has(word)).length;
  return shared / Math.min(wordsA.size, wordsB.size) >= 0.6;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "…at Oracle", "…as a Software Engineer": the header already says that
function repeatsHeader(bullet, entry) {
  const lower = bullet.toLowerCase();
  const organization = (entry.organization || "").trim().toLowerCase();
  const title = (entry.title || "").split("|")[0].trim().toLowerCase();
  return Boolean(
    (organization && lower.includes(` at ${organization}`)) ||
    (title && new RegExp(`\\bas an? ${escapeRegExp(title)}`).test(lower))
  );
}

// Why a written bullet can't be used, or null if it's fine
function bulletRejection(bullet, entry, sourceText, avoid, kept = []) {
  // Two-line bullets: anything far shorter is a fragment ("This was achieved…")
  if (bullet.length < ((entry.maxLength || 220) >= 260 ? 80 : 20)) return "too short";
  if (/^(this|it|these|those|that|which|also|additionally|and|while|as well)\b/i.test(bullet)) return "is a fragment, not an achievement";
  if (kept.some((other) => sameStory(bullet, other))) return "repeats another bullet's achievement";
  if (repeatsHeader(bullet, entry)) return "repeats the company or job title";
  if (bullet.length > (entry.maxLength || 220)) return `longer than ${entry.maxLength || 220} characters`;
  if (inventsNumbers(bullet, sourceText)) return "has a number that isn't in the input";
  // Every technology a bullet names must be in this entry's own details
  const foreign = dictionaryKeywords(bullet).filter((tool) => !mentions(sourceText, tool));
  if (foreign.length) return `names tools not in this entry (${foreign.join(", ")})`;
  // ...and so must every implementation step it describes
  const steps = IMPLEMENTATION_STEPS.filter(([, pattern]) => pattern.test(bullet) && !pattern.test(sourceText)).map(([name]) => name);
  if (steps.length) return `describes steps not in this entry (${steps.join(", ")})`;
  if (avoid.has(firstWord(bullet))) return `starts with "${firstWord(bullet)}", already used`;
  return null;
}

const splitBullets = (reply) => (Array.isArray(reply.bullets) ? reply.bullets : [])
  .filter((bullet) => typeof bullet === "string")
  // Split run-ons the model joined: "Did X. Did Y" -> two bullets
  .flatMap((bullet) => bullet.split(/(?<=[a-z0-9%)])\.\s+(?=[A-Z])/))
  .map(cleanBullet);

// Asks the model for bullets for one entry. Bullets that fail a check are
// dropped; if too few are left, it tries once more, saying what was wrong.
async function rewriteBullets(llm, entry, extra, signal) {
  const payload = { ...entry, ...extra };
  const sourceText = JSON.stringify({ ...payload, avoidVerbs: undefined });
  const wanted = entry.bulletCount || 4;
  const avoid = new Set(extra.avoidVerbs || []);
  const kept = [];
  const rejected = [];

  const take = (bullets) => {
    for (const bullet of bullets) {
      if (kept.length >= wanted) break;
      const reason = bulletRejection(bullet, entry, sourceText, avoid, kept);
      if (reason) {
        rejected.push(`"${bullet.slice(0, 70)}…" ${reason}`);
      } else {
        kept.push(bullet);
        avoid.add(firstWord(bullet));
      }
    }
  };

  take(splitBullets(await llm.invokeJson(BULLETS_PROMPT, payload, signal)));
  let calls = 1;

  if (kept.length < wanted && rejected.length) {
    calls += 1;
    const retry = await llm.invokeJson(BULLETS_PROMPT, {
      ...payload,
      bulletCount: wanted - kept.length,
      avoidVerbs: [...avoid],
      alreadyWritten: kept,
      feedback: [...(payload.feedback || []), ...rejected.map((line) => `Rejected: ${line}`), "Write different bullets that fix these problems."]
    }, signal);
    take(splitBullets(retry));
  }

  // Still short: use the candidate's own task wording for the rest, so a
  // job never ends up thinner than its facts allow
  for (const task of (entry.tasks || []).map(cleanBullet)) {
    if (kept.length >= wanted) break;
    if (
      task.length >= 20 &&
      task.length <= (entry.maxLength || 220) &&
      !bulletProblems(task).length &&
      !kept.some((other) => sameStory(task, other))
    ) {
      kept.push(task);
    }
  }

  return { bullets: kept.length ? kept : null, calls };
}

// What the writer sees for one entry: every task the user wrote (not just
// the ones that fit), plus their summary, skills and related projects.
// draft: the current bullets, when asking for a fix
const EXPERIENCE_BULLET_MAX = 330;

const experienceEntry = (item, original, draft) => ({
  entry: "work experience",
  title: item.title,
  organization: item.organization,
  current: item.current,
  bulletCount: item.targetBullets,
  bulletLength: "170 to 300 characters (two to three lines)",
  maxLength: EXPERIENCE_BULLET_MAX,
  tasks: original.bullets,
  context: [original.summary, original.highlights].filter(Boolean).join("\n"),
  skillsUsed: original.skills,
  relatedProjects: original.projects?.length ? original.projects : undefined,
  draftBullets: draft
});

const projectEntry = (item, original, draft) => ({
  entry: "project",
  title: item.title,
  role: item.role,
  current: item.current,
  bulletCount: 1,
  bulletLength: "150 to 260 characters (about two lines)",
  maxLength: PROJECT_BULLET_MAX,
  tasks: original.bullets,
  context: original.description,
  skillsUsed: item.skills,
  draftBullets: draft
});

// What the job values beyond tools (collaboration, communication,
// leadership, governance), found by the job-match rules
const jobThemesOf = (jobDescription) =>
  jobDescription
    ? baselineRequirements(jobDescription).filter((item) => item.kind === "behavioral").map((item) => item.text)
    : [];

// The job keywords this one entry's own text supports. A keyword from
// another job mustn't be claimed here.
const keywordsFor = (entry, jobKeywords) => {
  const text = JSON.stringify({ ...entry, draftBullets: undefined });
  return jobKeywords.filter((keyword) => mentions(text, keyword));
};

const firstWord = (bullet) => (bullet.match(/^[A-Za-z-]+/) || [""])[0].toLowerCase();

// Opening verbs already used, so each bullet starts differently
const usedVerbs = (lists) => [...new Set(lists.flat().flatMap((item) => item.bullets).map(firstWord).filter(Boolean))];

// Rewrites the bullets of every entry in one list (experience or projects)
function bulletWriter(listKey, sourceKey, makeEntry, label) {
  return async (state, config) => {
    const { options, resume, source, supportedKeywords: jobKeywords } = state;
    if (!options.useAi || !resume[listKey].length) return {};

    const { llm, progress, signal } = tools(config);
    const updated = [];
    const notes = [];
    let calls = 0;

    for (const [index, item] of resume[listKey].entries()) {
      progress(`${label} ${index + 1} of ${resume[listKey].length}: ${item.title}`);
      const original = source[sourceKey].find((entry) => entry.id === item.id);

      try {
        const entry = makeEntry(item, original);
        // Projects avoid the verbs already used in Experience too
        const avoidVerbs = usedVerbs([updated, listKey === "projects" ? resume.experience : []]);
        const { bullets, calls: used } = await rewriteBullets(
          llm,
          entry,
          { targetTitle: options.targetTitle, targetJobKeywords: keywordsFor(entry, jobKeywords), jobThemes: jobThemesOf(options.jobDescription), userInstructions: options.instructions || undefined, avoidVerbs },
          signal
        );
        calls += used;
        updated.push(bullets ? { ...item, bullets } : item);
        if (!bullets) notes.push(`Kept your own bullets for "${item.title}".`);
      } catch (error) {
        if (signal?.aborted) throw error;
        updated.push(item);
        notes.push(`Couldn't rewrite "${item.title}"; kept your own bullets.`);
      }
    }

    return { resume: { ...resume, [listKey]: updated }, notes, aiCalls: calls };
  };
}

const MAX_IMPORTANT_KEYWORDS = 8;
const TOP_JOB_KEYWORDS = 10;

// The job's important keywords (core tools, then its top keywords) that no
// bullet mentions yet. Keywords the portfolio never mentions are only used
// when the user turned on Add missing keywords.
function importantJobKeywords({ options, resume, source, jobKeywords }) {
  if (!options.jobDescription) return [];
  const bulletText = [...resume.experience, ...resume.projects].flatMap((item) => item.bullets).join("\n");
  const candidateText = JSON.stringify(source);
  return [...new Set([...criticalKeywords(options.jobDescription, jobKeywords), ...jobKeywords.slice(0, TOP_JOB_KEYWORDS)])]
    .filter((keyword) => knownSkill(keyword) && !TOO_GENERIC_KEYWORDS.has(keyword.toLowerCase()))
    .filter((keyword) => !mentions(bulletText, keyword))
    // Keywords only the job mentions need the user's go-ahead (Add missing keywords)
    .filter((keyword) => options.addMissingKeywords || mentions(candidateText, keyword))
    .slice(0, MAX_IMPORTANT_KEYWORDS);
}

// Important job keywords (the tools the job centers on, then its top
// keywords) that no bullet mentions yet get worked into the bullet whose
// story they belong to. Those that fit nowhere are added to Skills.
// Keywords the portfolio never mentions are only used when the user turned
// on Add missing keywords, and are listed so they can be undone.
async function weave({ options, resume, source, keywords: jobKeywords }, config) {
  const own = options.includeKeywords || [];
  if (!options.jobDescription && !own.length) return {};
  // Without AI nothing is rewritten; important keywords still go to Skills
  if (!options.useAi) return { importantKeywords: importantJobKeywords({ options, resume, source, jobKeywords }) };

  const { llm, progress, signal } = tools(config);
  const notes = [];
  let woven = [];
  let calls = 0;

  // First the keywords the user asked for: they say they have them, so they
  // go into work experience (never projects) wherever the story fits
  const ownMissing = own.filter((keyword) => !resume.experience.some((item) => item.bullets.some((bullet) => mentions(bullet, keyword))));
  if (ownMissing.length && resume.experience.length) {
    try {
      const result = await weaveKeywords({
        llm, source, keywords: ownMissing, progress, signal,
        resume: { ...resume, projects: [] },
        maxLength: { experience: EXPERIENCE_BULLET_MAX, projects: PROJECT_BULLET_MAX }
      });
      calls += result.calls;
      resume = { ...result.resume, projects: resume.projects };
      woven = result.woven.map((change) => ({ ...change, fromJob: [], byUser: true }));
      notes.push(...result.notes);
      if (result.unplaced.length) notes.push(`${result.unplaced.join(", ")} didn't fit any of your work experience bullets.`);
    } catch (error) {
      if (signal?.aborted) throw error;
      calls += 1;
      notes.push("Couldn't add your keywords to the bullets.");
    }
  }

  if (!options.jobDescription) {
    return { resume: { ...resume, keywordsWoven: woven }, notes, aiCalls: calls };
  }

  const important = importantJobKeywords({ options, resume, source, jobKeywords });
  if (!important.length) return { resume: { ...resume, keywordsWoven: woven }, importantKeywords: important, notes, aiCalls: calls };

  try {
    const result = await weaveKeywords({
      llm, resume, source, keywords: important, progress, signal,
      maxLength: { experience: EXPERIENCE_BULLET_MAX, projects: PROJECT_BULLET_MAX }
    });
    notes.push(...result.notes);
    if (result.woven.length) {
      notes.push(`Worked ${result.woven.flatMap((change) => change.keywords).join(", ")} into your bullets.`);
    }
    if (result.unplaced.length) {
      notes.push(`${result.unplaced.join(", ")} didn't fit any of your work, so they're only in Skills.`);
    }
    return {
      resume: { ...result.resume, keywordsWoven: [...woven, ...result.woven] },
      importantKeywords: important,
      notes,
      aiCalls: calls + result.calls
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      resume: { ...resume, keywordsWoven: woven },
      importantKeywords: important,
      notes: [...notes, "Couldn't work the job keywords into your bullets; they're in Skills."],
      aiCalls: calls + 1
    };
  }
}

const MAX_ADDED_KEYWORDS = 8;
// Broad ideas, not skills to list: they belong in bullets, not Skills
const TOO_GENERIC_KEYWORDS = new Set([
  "artificial intelligence", "machine learning", "software development lifecycle (sdlc)", "sdlc",
  "software design", "digital transformation", "process automation", "workflow automation", "data analysis"
]);

// Job keywords missing from the resume can be added to Skills (the user's
// choice; they're listed so the user can remove any they don't have).
// Skills that match the job come first, then they're sorted into
// TECHNICAL SKILLS categories ("Languages & Engineering: Python, SQL").
async function skills({ resume, options, keywords: jobKeywords, importantKeywords = [] }) {
  const text = resumeText(resume);
  // Tools the job centers on (Databricks for a "Databricks Apps" role) are
  // always offered; the rest only when the user turned that on. Either
  // way they're listed so the user can remove any they haven't used.
  const critical = options.jobDescription ? criticalKeywords(options.jobDescription, jobKeywords) : [];
  // Important keywords are always included: in a bullet, or here
  const candidates = options.addMissingKeywords ? [...critical, ...importantKeywords, ...jobKeywords] : [...critical, ...importantKeywords];
  const fromJob = options.sections.skills
    ? [...new Set(candidates)]
      .filter((keyword) => knownSkill(keyword) && !TOO_GENERIC_KEYWORDS.has(keyword.toLowerCase()))
      .filter((keyword) => !mentions(text, keyword))
      .slice(0, MAX_ADDED_KEYWORDS)
    : [];
  // A keyword worked into a bullet is listed in Skills too; the ones the
  // portfolio never mentions are shown as added so the user can confirm
  const listed = resume.skills.technical.join("\n");
  const woven = options.sections.skills
    ? (resume.keywordsWoven || []).flatMap((change) => change.keywords.map((keyword) => ({ keyword, fromJob: change.fromJob.includes(keyword) })))
      .filter(({ keyword }) => knownSkill(keyword) && !mentions(listed, keyword) && !fromJob.includes(keyword))
    : [];
  const added = [...fromJob, ...woven.filter((item) => item.fromJob).map((item) => item.keyword)];
  // Tools the user asked to include are theirs: listed, never flagged
  const own = options.sections.skills
    ? (options.includeKeywords || []).map((keyword) => knownSkill(keyword)).filter(Boolean)
      .filter((keyword) => !mentions(listed, keyword) && !added.includes(keyword))
    : [];
  const extra = [...new Set([...added, ...woven.filter((item) => !item.fromJob).map((item) => item.keyword), ...own])];

  const wanted = jobKeywords.map((keyword) => keyword.toLowerCase());
  const matches = (name) => wanted.some((keyword) => keyword === name.toLowerCase() || keyword.includes(name.toLowerCase()));
  const sortGroup = (names) => [...names].sort((a, b) => matches(b) - matches(a));

  // The MCP group_skills tool fixes spellings ("OracleSQL" -> "Oracle SQL"),
  // drops repeats ("OCI" = "Oracle Cloud Infrastructure") and sorts the
  // skills into categories, keeping this order within each
  const grouped = await callTool("group_skills", {
    technical: sortGroup([...resume.skills.technical, ...extra]),
    soft: sortGroup(resume.skills.soft)
  });

  return {
    resume: {
      ...resume,
      skills: {
        technical: grouped.technical,
        soft: grouped.soft,
        added: added.filter((keyword) => grouped.technical.includes(keyword)),
        addedCritical: added.filter((keyword) => critical.includes(keyword) && grouped.technical.includes(keyword)),
        groups: grouped.groups
      }
    },
    notes: grouped.notes,
    toolCalls: ["group_skills"]
  };
}

// Every piece of text on the resume (except company and school names) as
// { read, write } so it can be fixed in place. prose marks sentences.
function textFields(resume) {
  const fields = [];
  const field = (prose, read, write) => fields.push({ prose, read, write });

  field(true, (r) => r.summary, (r, value) => { r.summary = value; });

  for (const listKey of ["experience", "projects", "education"]) {
    resume[listKey].forEach((item, index) => {
      const keys = listKey === "experience" ? ["title"] : listKey === "projects" ? ["title"] : ["degree", "fieldOfStudy"];
      keys.forEach((key) => field(false, (r) => r[listKey][index][key], (r, value) => { r[listKey][index][key] = value; }));
      item.bullets.forEach((_, b) =>
        field(true, (r) => r[listKey][index].bullets[b], (r, value) => { r[listKey][index].bullets[b] = value; }));
    });
  }

  resume.education.forEach((item, index) => item.courses.forEach((_, c) =>
    field(false, (r) => r.education[index].courses[c], (r, value) => { r.education[index].courses[c] = value; })));

  Object.keys(resume.extras || {}).forEach((key) => resume.extras[key].forEach((item, index) => {
    if (typeof item === "string") {
      field(false, (r) => r.extras[key][index], (r, value) => { r.extras[key][index] = value; });
      return;
    }
    field(false, (r) => r.extras[key][index].title, (r, value) => { r.extras[key][index].title = value; });
    item.bullets.forEach((_, b) =>
      field(true, (r) => r.extras[key][index].bullets[b], (r, value) => { r.extras[key][index].bullets[b] = value; }));
  }));

  return fields.filter((entry) => entry.read(resume));
}

// Fixes spelling everywhere: known misspellings and tech-name capitals
// always, then (with AI) a proofread that may only fix small typos
async function proofread({ resume, options }, config) {
  const fixed = structuredClone(resume);
  const notes = [];
  const fields = textFields(fixed);

  for (const entry of fields) {
    const original = entry.read(fixed);
    const { text, fixes, buzzwords } = tidyText(original);
    if (text !== original) {
      entry.write(fixed, text);
      fixes.forEach(([from, to]) => notes.push(`Fixed spelling: "${from}" → "${to}".`));
      buzzwords.forEach((word) => notes.push(`Removed buzzword "${word}".`));
    }
  }

  const update = { resume: fixed };
  // All text goes to the proofreader except company and school names,
  // which textFields leaves out
  const prose = fields;

  if (options.useAi && prose.length) {
    const { llm, progress, signal } = tools(config);
    progress("Proofreading for spelling mistakes");
    update.aiCalls = 1;

    try {
      const texts = prose.map((entry) => entry.read(fixed));
      const reply = await llm.invokeJson(PROOFREAD_PROMPT, { texts }, signal);
      const corrected = Array.isArray(reply.texts) && reply.texts.length === texts.length ? reply.texts : [];

      corrected.forEach((text, index) => {
        const original = texts[index];
        const clean = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
        if (!clean || clean === original || !onlyTypoFixes(original, clean)) return;

        // A bullet keeps its final period even if the proofreader dropped it
        prose[index].write(fixed, /[.!?]$/.test(original) && !/[.!?]$/.test(clean) ? `${clean}.` : clean);
        const before = original.split(/\s+/);
        clean.split(/\s+/).forEach((word, w) => {
          if (word !== before[w]) notes.push(`Fixed spelling: "${before[w]}" → "${word}".`);
        });
      });
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  // The same fix can show up more than once; list it once
  return { ...update, notes: [...new Set(notes)] };
}

// The MCP check_ats tool hands the resume to the ATS Reviewer agent over
// A2A (or runs the same rules itself if that agent is unreachable)
async function review({ resume, keywords: jobKeywords, reviewedBy }, config) {
  tools(config).progress("Asking the ATS Reviewer agent (A2A) to check the resume");
  const result = await callTool("check_ats", { resume, keywords: jobKeywords });

  return {
    review: result.review,
    reviewedBy: result.reviewedBy,
    toolCalls: ["check_ats"],
    // Mention a fallback once, even if the review runs twice
    notes: result.reviewedBy.startsWith("built-in") && !reviewedBy
      ? ["The ATS Reviewer agent (A2A) wasn't reachable, so the built-in review was used."]
      : []
  };
}

// Second pass on the entries whose bullets failed the review
async function revise(state, config) {
  const { options, resume, source, review: result, supportedKeywords: jobKeywords } = state;
  const { llm, progress, signal } = tools(config);
  const next = { ...resume, experience: [...resume.experience], projects: [...resume.projects] };
  let calls = 0;

  for (const target of result.rewrite) {
    const listKey = target.kind === "experience" ? "experience" : "projects";
    const sourceKey = target.kind === "experience" ? "experiences" : "projects";
    const index = next[listKey].findIndex((item) => item.id === target.id);
    if (index === -1) continue;

    const item = next[listKey][index];
    const original = source[sourceKey].find((entry) => entry.id === item.id);
    const makeEntry = target.kind === "experience" ? experienceEntry : projectEntry;

    progress(`Fixing bullets for ${item.title}`);
    calls += 1;

    try {
      const entry = makeEntry(item, original, item.bullets);
      // Keywords worked into this entry must stay in it
      const changes = (next.keywordsWoven || []).filter((change) => change.listKey === listKey && change.id === item.id);
      const kept = changes.flatMap((change) => change.keywords);
      const { bullets, calls: used } = await rewriteBullets(
        llm,
        entry,
        {
          targetTitle: options.targetTitle,
          targetJobKeywords: [...new Set([...keywordsFor(entry, jobKeywords), ...kept])],
          userInstructions: options.instructions || undefined,
          feedback: kept.length ? [].concat(target.feedback, `Keep these keywords in the bullets: ${kept.join(", ")}.`) : target.feedback
        },
        signal
      );
      calls += used - 1;
      const text = (bullets || []).join("\n");
      if (bullets && kept.every((keyword) => mentions(text, keyword))) {
        next[listKey][index] = { ...item, bullets };
        // The keywords are still there, but the bullets they were added to changed
        if (changes.length) next.keywordsWoven = next.keywordsWoven.filter((change) => !changes.includes(change));
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  return { resume: next, revisions: state.revisions + 1, aiCalls: calls };
}

const afterReview = ({ options, review: result, revisions }) =>
  options.useAi && result.rewrite.length && revisions < MAX_REVISIONS ? "reviseBullets" : END;

const resumeGraph = new StateGraph(State)
  .addNode("prepare", prepare)
  .addNode("analyzeJob", keywords)
  .addNode("writeSummary", summary)
  .addNode("writeExperience", bulletWriter("experience", "experiences", experienceEntry, "Improving experience"))
  .addNode("writeProjects", bulletWriter("projects", "projects", projectEntry, "Improving project"))
  .addNode("weaveKeywords", weave)
  .addNode("orderSkills", skills)
  .addNode("proofread", proofread)
  .addNode("atsReview", review)
  .addNode("reviseBullets", revise)
  .addEdge(START, "prepare")
  .addEdge("prepare", "analyzeJob")
  .addEdge("analyzeJob", "writeSummary")
  .addEdge("writeSummary", "writeExperience")
  .addEdge("writeExperience", "writeProjects")
  .addEdge("writeProjects", "weaveKeywords")
  .addEdge("weaveKeywords", "orderSkills")
  .addEdge("orderSkills", "proofread")
  .addEdge("proofread", "atsReview")
  .addConditionalEdges("atsReview", afterReview, ["reviseBullets", END])
  .addEdge("reviseBullets", "proofread")
  .compile();

// ---- Revising a finished resume from the user's instructions ----
//
//   planRevision → applyRevision → proofread → atsReview
//
// The Revision Planner agent reads the instructions and the finished resume
// and lists the parts to change; only those are rewritten, with the same
// checks as the first build (facts from the portfolio only).

const PLAN_PROMPT = [
  "You plan changes to a finished resume from the candidate's instructions.",
  "parts lists the resume's parts, each with a ref. List the parts the instructions ask to change:",
  '- "summary" for the professional summary; an entry ref for that job\'s or project\'s bullets;',
  '  "skills" to take skills out (put their exact names in remove); "fields" to hide details,',
  "  with remove naming only fields from removableFields.",
  "- An instruction about all bullets (tone, length, verbs, a keyword everywhere) lists every entry.",
  "- For each part, restate the instruction as one specific change for that part.",
  "- bulletCount only if the instructions ask for a number of bullets for that entry.",
  "- Leave out parts the instructions don't touch.",
  "- clarifications are the candidate's answers to earlier questions: follow them.",
  "- If an instruction could mean different parts and clarifications don't settle it (\"remove",
  "  the dates\": jobs, schools or projects?), don't guess: reply with a question instead,",
  "  with 2 to 4 short options.",
  'Reply with JSON only: {"changes": [{"ref": string, "change": string, "bulletCount"?: number, "remove"?: string[]}]}',
  'or, to ask: {"question": string, "options": string[]}'
].join("\n");

// Details a revision can hide, and where they appear
const REMOVABLE_FIELDS = {
  "contact.email": "Email in the header", "contact.phone": "Phone in the header",
  "contact.location": "Location in the header", "contact.linkedin": "LinkedIn in the header",
  "contact.github": "GitHub in the header", "contact.portfolio": "Portfolio link in the header",
  "experience.location": "Locations of jobs", "experience.dates": "Dates of jobs",
  "education.location": "Locations of schools", "education.dates": "Dates of schools",
  "education.grade": "GPA/grades", "education.courses": "Coursework",
  "projects.dates": "Dates of projects", "projects.link": "Project links"
};

// Which removable fields the resume actually shows
function shownFields(resume) {
  const shown = new Set();
  for (const key of ["email", "phone", "location", "linkedin", "github", "portfolio"]) {
    if (resume.contact?.[key]) shown.add(`contact.${key}`);
  }
  const lists = { experience: ["location", "dates"], education: ["location", "dates", "grade", "courses"], projects: ["dates", "link"] };
  for (const [listKey, fields] of Object.entries(lists)) {
    for (const field of fields) {
      if (resume[listKey].some((item) => (Array.isArray(item[field]) ? item[field].length : item[field]))) shown.add(`${listKey}.${field}`);
    }
  }
  return shown;
}

// Words that name a detail found in several places, and the words that
// say which place. "Remove location" with a location in the header and in
// the jobs is a question, not a guess.
const AMBIGUOUS_DETAILS = [
  { word: /\blocations?\b|\bcity\b|\bcities\b/i, label: "location", plural: "locations", fields: ["contact.location", "experience.location", "education.location"] },
  { word: /\bdates?\b|\byears?\b/i, label: "date", plural: "dates", fields: ["experience.dates", "education.dates", "projects.dates"] },
  { word: /\blinks?\b|\burls?\b/i, label: "link", plural: "links", fields: ["contact.linkedin", "contact.github", "contact.portfolio", "projects.link"] }
];
const PLACE_WORDS = {
  contact: /\b(top|header|heading|contact|under (my )?name)\b/i,
  experience: /\b(experience|jobs?|work|roles?|employers?|companies)\b/i,
  education: /\b(education|schools?|universit\w*|colleges?|degrees?)\b/i,
  projects: /\bprojects?\b/i
};
const EVERYWHERE = /\b(all|every|everywhere|entire|whole)\b/i;
const REMOVE_WORDS = /\b(remove|delete|drop|hide|take out|get rid of|no|without)\b/i;

// A question for the user when an instruction names a detail that appears
// in several places without saying which; null when it's clear
function clarifyDetail(instructions, resume) {
  if (!REMOVE_WORDS.test(instructions) || EVERYWHERE.test(instructions)) return null;
  const shown = shownFields(resume);

  for (const detail of AMBIGUOUS_DETAILS) {
    if (!detail.word.test(instructions)) continue;
    const places = detail.fields.filter((field) => shown.has(field));
    if (places.length < 2) continue;
    // A place is named ("location at the top"): clear enough
    if (places.some((field) => PLACE_WORDS[field.split(".")[0]].test(instructions))) continue;

    // Each option knows the fields it removes
    const choices = [
      ...places.map((field) => ({ text: `Only the ${REMOVABLE_FIELDS[field].toLowerCase()}`, fields: [field] })),
      { text: `All ${detail.plural} on the resume`, fields: places }
    ];
    return { question: `Which ${detail.plural} should be removed?`, options: choices.map((choice) => choice.text), choices };
  }
  return null;
}

const MAX_REVISION_CHANGES = 12;

const ReviseState = Annotation.Root({
  ...State.spec,
  instructions: Annotation(),
  // The user's answers to earlier questions: [{ question, answer }]
  clarifications: Annotation({ reducer: (_, next) => next, default: () => [] }),
  // Set when the instructions are unclear: { question, options }
  question: Annotation(),
  plan: Annotation({ reducer: (_, next) => next, default: () => [] })
});

const entryRef = (listKey, item) => `${listKey}:${item.id}`;

// The Revision Planner agent: which parts to change, and how
async function planRevision({ resume, instructions, clarifications }, config) {
  const { llm, progress, signal } = tools(config);
  progress("Revision Planner agent: reading your instructions");

  // Unclear details are asked about before anything changes
  const answered = clarifications.map((item) => `${item.question} ${item.answer}`).join(" ");
  const detailQuestion = clarifyDetail(`${instructions} ${answered}`, resume);
  if (detailQuestion && !clarifications.length) {
    const { choices, ...question } = detailQuestion;
    return { question };
  }
  const shown = shownFields(resume);

  // An answer to one of those questions says exactly which fields go
  const asked = clarifyDetail(instructions, resume);
  const chosen = asked
    ? clarifications.flatMap((item) => asked.choices.find((choice) => choice.text === item.answer)?.fields || [])
    : [];

  const parts = [
    ...(resume.sections.summary && resume.summary ? [{ ref: "summary", text: resume.summary }] : []),
    ...resume.experience.map((item) => ({ ref: entryRef("experience", item), title: `${item.title} at ${item.organization}`, bullets: item.bullets })),
    ...resume.projects.map((item) => ({ ref: entryRef("projects", item), title: `Project: ${item.title}`, bullets: item.bullets })),
    ...(resume.skills.technical.length ? [{ ref: "skills", skills: resume.skills.technical }] : []),
    { ref: "fields" }
  ];
  const refs = new Set(parts.map((part) => part.ref));
  const removableFields = Object.fromEntries([...shown].map((field) => [field, REMOVABLE_FIELDS[field]]));

  let plan = [];
  try {
    const reply = await llm.invokeJson(PLAN_PROMPT, { instructions, clarifications, parts, removableFields }, signal);
    // The planner asks (once) when it can't tell what's meant
    const options = Array.isArray(reply.options) ? reply.options.filter((option) => typeof option === "string" && option.trim()).slice(0, 4) : [];
    if (!clarifications.length && typeof reply.question === "string" && reply.question.trim() && options.length >= 2) {
      return { question: { question: reply.question.trim().slice(0, 200), options: options.map((option) => option.trim().slice(0, 120)) }, aiCalls: 1 };
    }
    plan = (Array.isArray(reply.changes) ? reply.changes : [])
      .filter((change) => change && refs.has(String(change.ref).trim()) && typeof change.change === "string")
      .map((change) => ({
        ref: String(change.ref).trim(),
        change: change.change.trim().slice(0, 400),
        bulletCount: Number.isInteger(change.bulletCount) ? Math.min(6, Math.max(1, change.bulletCount)) : undefined,
        remove: Array.isArray(change.remove) ? change.remove.filter((name) => typeof name === "string") : []
      }))
      .map((change) => (change.ref === "fields" ? { ...change, remove: change.remove.filter((field) => shown.has(field)) } : change))
      .filter((change) => change.ref !== "fields" || change.remove.length);
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  if (chosen.length) {
    // Exactly the details the user chose, no more of that kind
    const places = asked.choices[asked.choices.length - 1].fields;
    const fields = plan.find((change) => change.ref === "fields");
    if (fields) fields.remove = [...new Set([...fields.remove.filter((field) => !places.includes(field)), ...chosen])];
    else plan.unshift({ ref: "fields", change: "Remove the chosen details", remove: chosen });
  }

  // Nothing usable: apply the instructions to the summary and every entry
  if (!plan.length) {
    plan = parts.filter((part) => part.ref !== "skills" && part.ref !== "fields").map((part) => ({ ref: part.ref, change: instructions, remove: [] }));
  }

  // One change per part
  const seen = new Set();
  plan = plan.filter((change) => !seen.has(change.ref) && seen.add(change.ref)).slice(0, MAX_REVISION_CHANGES);
  return { plan, aiCalls: 1 };
}

// Rewrites the planned parts; anything that fails a check stays as it was
async function applyRevision(state, config) {
  const { source, options, resume, plan, instructions, supportedKeywords: jobKeywords } = state;
  const { llm, progress, signal } = tools(config);
  const next = { ...resume, experience: [...resume.experience], projects: [...resume.projects], education: [...resume.education] };
  const notes = [];
  let calls = 0;

  for (const change of plan) {
    if (change.ref === "summary") {
      progress("Revising the summary");
      calls += 1;
      try {
        const payload = summaryPayload({ source, options, resume: next, jobKeywords });
        const sourceText = JSON.stringify({ ...payload, jobDescription: undefined });
        let text = fitSummary((await llm.invokeJson(SUMMARY_PROMPT, {
          ...payload, draftSummary: next.summary, feedback: change.change, userInstructions: instructions
        }, signal)).summary || "");
        text = withoutEmployers(text, [
          ...source.experiences.map((item) => item.organization),
          ...source.educations.map((item) => item.institution)
        ]).text;
        const specific = text.split(/(?<=[.!?])\s+/).filter((sentence) => !GENERIC_PHRASES.test(sentence));
        if (specific.length) text = specific.join(" ");
        // The results the summary quoted must survive
        const lost = (next.summary.match(/\d+(?:\.\d+)?\s?%/g) || []).filter((result) => !text.includes(result));
        if (text.length >= 80 && !inventsNumbers(text, sourceText) && !lost.length) next.summary = text;
        else notes.push("Kept the summary: the revised version changed its facts.");
      } catch (error) {
        if (signal?.aborted) throw error;
        notes.push("Couldn't revise the summary.");
      }
      continue;
    }

    if (change.ref === "fields") {
      for (const field of change.remove) {
        const [listKey, key] = field.split(".");
        if (listKey === "contact") next.contact = { ...next.contact, [key]: "" };
        else next[listKey] = next[listKey].map((item) => ({ ...item, [key]: Array.isArray(item[key]) ? [] : "" }));
      }
      notes.push(`Removed: ${change.remove.map((field) => REMOVABLE_FIELDS[field].toLowerCase()).join(", ")}.`);
      continue;
    }

    if (change.ref === "skills") {
      const remove = change.remove.map((name) => name.toLowerCase());
      if (!remove.length) continue;
      const keep = (skill) => !remove.includes(skill.toLowerCase());
      next.skills = {
        ...next.skills,
        technical: next.skills.technical.filter(keep),
        soft: next.skills.soft.filter(keep),
        added: (next.skills.added || []).filter(keep),
        addedCritical: (next.skills.addedCritical || []).filter(keep),
        groups: (next.skills.groups || []).map((group) => ({ ...group, skills: group.skills.filter(keep) })).filter((group) => group.skills.length)
      };
      continue;
    }

    const [listKey, id] = change.ref.split(":");
    const index = next[listKey].findIndex((item) => item.id === id);
    const item = next[listKey][index];
    const original = source[listKey === "experience" ? "experiences" : "projects"].find((entry) => entry.id === id);
    if (!item || !original) continue;

    progress(`Revising ${item.title}`);
    try {
      const makeEntry = listKey === "experience" ? experienceEntry : projectEntry;
      const entry = { ...makeEntry(item, original, item.bullets), bulletCount: change.bulletCount || item.bullets.length || item.targetBullets };
      // Keywords worked into this entry must stay in it
      const kept = (next.keywordsWoven || []).filter((woven) => woven.listKey === listKey && woven.id === id).flatMap((woven) => woven.keywords);
      const { bullets, calls: used } = await rewriteBullets(llm, entry, {
        targetTitle: options.targetTitle,
        targetJobKeywords: [...new Set([...keywordsFor(entry, jobKeywords), ...kept])],
        userInstructions: instructions,
        avoidVerbs: usedVerbs([next.experience.filter((other) => other.id !== id)]),
        feedback: [change.change, ...(kept.length ? [`Keep these keywords in the bullets: ${kept.join(", ")}.`] : [])]
      }, signal);
      calls += used;
      const text = (bullets || []).join("\n");
      if (bullets && kept.every((keyword) => mentions(text, keyword))) {
        next[listKey][index] = { ...item, bullets };
        next.keywordsWoven = (next.keywordsWoven || []).filter((woven) => !(woven.listKey === listKey && woven.id === id));
      } else {
        notes.push(`Kept the bullets for "${item.title}": the revised ones didn't pass the checks.`);
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      notes.push(`Couldn't revise "${item.title}".`);
    }
  }

  return { resume: next, notes, aiCalls: calls };
}

const reviseGraph = new StateGraph(ReviseState)
  .addNode("planRevision", planRevision)
  .addNode("applyRevision", applyRevision)
  .addNode("proofread", proofread)
  .addNode("atsReview", review)
  .addEdge(START, "planRevision")
  // An unclear instruction ends the run with a question for the user
  .addConditionalEdges("planRevision", ({ question }) => (question ? END : "applyRevision"), ["applyRevision", END])
  .addEdge("applyRevision", "proofread")
  .addEdge("proofread", "atsReview")
  .addEdge("atsReview", END)
  .compile();

// Revises a finished resume. source: the same portfolio data it was built
// from; keywords: the job keywords found when it was built.
// Returns { question } instead when the instructions need a clarification;
// clarifications: the user's earlier answers [{ question, answer }].
async function reviseResume({ source, options, resume, instructions, clarifications = [], keywords = [], llm, onProgress, signal }) {
  const candidateText = JSON.stringify(source);
  const state = await reviseGraph.invoke(
    { source, options, resume, instructions, clarifications, keywords, supportedKeywords: keywords.filter((keyword) => mentions(candidateText, keyword)) },
    { configurable: { llm, onProgress, signal }, signal, recursionLimit: 15 }
  );
  if (state.question) return { question: state.question };
  const { rewrite, ...reviewResult } = state.review;

  return {
    resume: state.resume,
    review: reviewResult,
    keywords,
    notes: state.notes,
    aiCalls: state.aiCalls,
    revision: state.plan.map((change) => change.ref),
    agents: { mcpTools: [...new Set(state.toolCalls)], reviewedBy: state.reviewedBy }
  };
}

// source: gatherResumeData() output, already filtered to the chosen items
// options: { sections, targetTitle, jobDescription, useAi }
// llm: { invokeJson(system, payload, signal) } (required when useAi)
async function buildResume({ source, options, llm, onProgress, signal }) {
  const state = await resumeGraph.invoke(
    { source, options },
    { configurable: { llm, onProgress, signal }, signal, recursionLimit: 25 }
  );

  const { rewrite, ...reviewResult } = state.review;

  return {
    resume: state.resume,
    review: reviewResult,
    keywords: state.keywords,
    notes: state.notes,
    aiCalls: state.aiCalls,
    agents: {
      mcpTools: [...new Set(state.toolCalls)],
      reviewedBy: state.reviewedBy
    }
  };
}

module.exports = { buildResume, resumeGraph, reviseResume, GENERIC_PHRASES, withoutEmployers, wordCount, ATS_RULES, prompts: { SUMMARY_PROMPT, BULLETS_PROMPT, PROOFREAD_PROMPT, KEYWORDS_PROMPT, PLAN_PROMPT } };
