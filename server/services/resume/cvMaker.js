// CV Maker's steps, without the web server: reading the build options,
// choosing the portfolio items, and building or revising the resume with its
// job match. The server streams the events; the GitHub Pages demo runs the
// same steps in the browser.
const { buildResume, reviseResume } = require("./resumeAgent");
const { evaluateJobMatch } = require("../match/jobMatchAgent");
const { CATEGORY_IDS } = require("../match/matchModel");

const SECTIONS = ["summary", "experience", "education", "projects", "skills"];
// Sections the user adds if they want them (off unless asked for)
const EXTRA_SECTIONS = ["certifications", "achievements", "volunteering", "publications", "patents", "interests"];

const ID_LISTS = {
  experienceIds: "experiences",
  educationIds: "educations",
  projectIds: "projects",
  skillIds: "skills"
};
const EXTRA_ID_LISTS = {
  certificationIds: "certifications",
  achievementIds: "achievements",
  volunteeringIds: "volunteering",
  publicationIds: "publications",
  patentIds: "patents",
  interestIds: "interests"
};

const CONTACT_FIELDS = ["email", "phone", "location", "linkedin", "github", "portfolio"];
const INSTRUCTIONS_MAX = 1000;

const isIdList = (list) =>
  Array.isArray(list) && list.length <= 500 && list.every((id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id));


// The portfolio items chosen for the resume, with hidden contact details
// blank. all: the resume data (gatherResumeData with audience "resume")
function pickSource(all, options, ids) {
  const lists = { ...ID_LISTS, ...EXTRA_ID_LISTS };
  const pick = (key, sectionOn) => (sectionOn ? all[lists[key]].filter((item) => ids[key].has(item.id)) : []);

  const contact = { ...all.contact };
  for (const key of CONTACT_FIELDS) if (!options.showContact[key]) contact[key] = "";

  return {
    contact,
    summary: options.sections.summary ? all.summary : "",
    experiences: pick("experienceIds", options.sections.experience),
    educations: pick("educationIds", options.sections.education),
    projects: pick("projectIds", options.sections.projects),
    skills: pick("skillIds", options.sections.skills),
    certifications: pick("certificationIds", options.sections.certifications),
    achievements: pick("achievementIds", options.sections.achievements),
    volunteering: pick("volunteeringIds", options.sections.volunteering),
    publications: pick("publicationIds", options.sections.publications),
    patents: pick("patentIds", options.sections.patents),
    interests: pick("interestIds", options.sections.interests)
  };
}

function parseOptions(body = {}) {
  const sections = {};
  for (const key of SECTIONS) sections[key] = body.sections?.[key] !== false;
  for (const key of EXTRA_SECTIONS) sections[key] = body.sections?.[key] === true;

  const ids = {};
  for (const key of Object.keys(ID_LISTS)) {
    if (!isIdList(body[key])) return { error: "Choose the items to include" };
    ids[key] = new Set(body[key]);
  }
  for (const key of Object.keys(EXTRA_ID_LISTS)) {
    const list = body[key] ?? [];
    if (!isIdList(list)) return { error: "Choose the items to include" };
    ids[key] = new Set(list);
  }

  // Contact details shown at the top (all unless switched off)
  const showContact = {};
  for (const key of CONTACT_FIELDS) showContact[key] = body.showContact?.[key] !== false;

  const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
  if (instructions.length > INSTRUCTIONS_MAX) {
    return { error: `Extra instructions can be up to ${INSTRUCTIONS_MAX} characters` };
  }

  // Keywords the user wants in their experience bullets ("TensorFlow, GitHub")
  const rawKeywords = Array.isArray(body.includeKeywords) ? body.includeKeywords : [];
  if (rawKeywords.length > 12 || rawKeywords.some((keyword) => typeof keyword !== "string" || keyword.trim().length > 40)) {
    return { error: "Add up to 12 keywords to include, each up to 40 characters" };
  }
  const includeKeywords = [...new Set(rawKeywords.map((keyword) => keyword.trim()).filter(Boolean))];

  const targetTitle = typeof body.targetTitle === "string" ? body.targetTitle.trim() : "";
  const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";

  if (targetTitle.length > 120) return { error: "The target job title can be up to 120 characters" };
  if (jobDescription.length > 8000) return { error: "The job description can be up to 8000 characters" };

  return {
    options: {
      sections, targetTitle, jobDescription, instructions, showContact, includeKeywords,
      // Off unless asked for: only known tools the job names are ever added
      addMissingKeywords: body.addMissingKeywords === true,
      useAi: body.useAi === true
    },
    ids
  };
}


const isRequirement = (item) =>
  item && typeof item === "object" && typeof item.text === "string" &&
  CATEGORY_IDS.includes(item.category) && ["critical", "required", "preferred"].includes(item.importance);

// The revise request's own parts: { resume, keywords, requirements,
// instructions, clarifications } or { error }
function parseRevision(body = {}) {
  const { resume, keywords = [], requirements } = body;
  const instructions = typeof body.revisionInstructions === "string" ? body.revisionInstructions.trim() : "";
  if (!instructions) return { error: "Say what to change" };
  if (instructions.length > INSTRUCTIONS_MAX) return { error: `Instructions can be up to ${INSTRUCTIONS_MAX} characters` };
  if (!resume || typeof resume.summary !== "string" || !resume.sections || !Array.isArray(resume.experience) ||
      !Array.isArray(resume.projects) || !Array.isArray(resume.education) || !resume.skills || !Array.isArray(resume.skills.technical)) {
    return { error: "Send the resume as it was built" };
  }
  // Answers to the agent's earlier questions: [{ question, answer }]
  const clarifications = body.clarifications ?? [];
  if (!Array.isArray(clarifications) || clarifications.length > 5 || !clarifications.every((item) =>
    item && typeof item.question === "string" && typeof item.answer === "string" &&
    item.question.length <= 200 && item.answer.trim() && item.answer.length <= 300)) {
    return { error: "Send your answers as they were asked" };
  }
  if (!Array.isArray(keywords) || keywords.length > 40 || !keywords.every((keyword) => typeof keyword === "string" && keyword.length <= 60)) {
    return { error: "Send the keywords from the build" };
  }
  return {
    resume,
    keywords,
    requirements,
    instructions,
    clarifications: clarifications.map((item) => ({ question: item.question, answer: item.answer.trim() }))
  };
}

// Builds the resume, then scores how well it fits the job (evidence and a
// weighted score from code; the AI only helps find requirements).
// send(event, data): "progress" { message }, then "result"
async function generateCv({ source, options, llm, signal, send }) {
  const progress = (message) => send("progress", { message });
  const result = await buildResume({ source, options, llm, signal, onProgress: progress });
  const match = await evaluateJobMatch({ resume: result.resume, jobDescription: options.jobDescription, llm, signal, onProgress: progress });
  send("result", { ...result, match, aiUsed: Boolean(llm), model: llm?.model || null });
}

// Sends the finished resume through the agents again under new instructions.
// Same events as generateCv, plus "clarify" { question, options } when the
// instructions are unclear
async function reviseCv({ source, options, revision, llm, signal, send }) {
  const progress = (message) => send("progress", { message });
  const result = await reviseResume({
    source, options: { ...options, useAi: true }, resume: revision.resume, instructions: revision.instructions,
    keywords: revision.keywords, llm, clarifications: revision.clarifications, signal, onProgress: progress
  });
  if (result.question) {
    send("clarify", result.question);
    return;
  }
  // Score against the requirements found at build time when we have them
  const { requirements } = revision;
  const reuse = Array.isArray(requirements) && requirements.length <= 60 && requirements.every(isRequirement);
  const match = await evaluateJobMatch({
    resume: result.resume,
    jobDescription: options.jobDescription,
    requirements: reuse ? requirements : null,
    llm: reuse ? null : llm,
    signal,
    onProgress: progress
  });
  send("result", { ...result, match, aiUsed: true, model: llm.model });
}

// Scores an edited resume against the requirements found when it was built,
// so a new score reflects real changes. No AI; the same input always gives
// the same result. body: { resume, requirements, weights? } → { match } or { error }
async function rescoreMatch(body = {}) {
  const { resume, requirements, weights } = body;
  if (!resume || !Array.isArray(resume.experience) || !Array.isArray(resume.projects) ||
      !Array.isArray(resume.education) || !resume.skills || !Array.isArray(resume.skills.technical)) {
    return { error: "Send the resume as it was built" };
  }
  if (!Array.isArray(requirements) || requirements.length > 60 || !requirements.every(isRequirement)) {
    return { error: "Send the requirements from the earlier match" };
  }
  const cleanWeights = {};
  for (const id of CATEGORY_IDS) {
    const value = Number(weights?.[id]);
    if (Number.isFinite(value) && value >= 0 && value <= 100) cleanWeights[id] = value;
  }
  return { match: await evaluateJobMatch({ resume, requirements, weights: cleanWeights }) };
}

module.exports = { parseOptions, parseRevision, pickSource, generateCv, reviseCv, rescoreMatch, isRequirement, INSTRUCTIONS_MAX };
