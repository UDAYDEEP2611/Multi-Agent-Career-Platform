const User = require("../models/User");
const { gatherResumeData } = require("../services/resume/resumeData");
const { buildResume, reviseResume } = require("../services/resume/resumeAgent");
const { refitSummary } = require("../services/resume/summaryFit");
const { readResume, parseResumeText } = require("../services/resume/resumeParser");
const { atsFileCheck } = require("../services/resume/atsFileCheck");
const { recommendationsFor } = require("../services/match/recommendations");
const ResumeMatchLog = require("../models/ResumeMatchLog");
const { LOG_LIFETIME_SECONDS } = require("../models/ResumeMatchLog");
const mongoose = require("mongoose");
const { compareResume } = require("../services/match/resumeCompare");
const { jobInfoOf } = require("../services/match/jobInfo");
const { ollamaStatus, createOllamaLlm } = require("../services/resume/ollama");
const { evaluateJobMatch } = require("../services/match/jobMatchAgent");
const { CATEGORY_IDS } = require("../services/match/matchModel");

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

// One resume at a time per user: the local model handles one request at a time
const running = new Set();

const account = (userId) => User.findById(userId).select("username email").lean();

// GET /api/resume/sources
// Everything that can go on the resume, plus whether the AI is ready
exports.getSources = async (req, res) => {
  try {
    const [user, ai] = await Promise.all([account(req.session.userId), ollamaStatus()]);
    // Only entries with Show in resume on
    const sources = await gatherResumeData(req.session.userId, user, { audience: "resume" });

    return res.json({ success: true, sources, ai });
  } catch (error) {
    console.error("Resume sources error:", error);
    return res.status(500).json({ success: false, message: "Unable to load your portfolio" });
  }
};

// The portfolio items chosen for the resume, with hidden contact details blank
async function loadSource(userId, options, ids) {
  const all = await gatherResumeData(userId, await account(userId), { audience: "resume" });
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

// POST /api/resume/generate
// { sections: { summary, experience, education, projects, skills },
//   experienceIds, educationIds, projectIds, skillIds,
//   optional sections (certifications, achievements, volunteering,
//   publications, patents, interests) with certificationIds, ... ,
//   showContact?: { email, phone, location, linkedin, github, portfolio },
//   targetTitle?, jobDescription?, instructions?, includeKeywords?: string[], useAi }
// Replies with a stream of server-sent events: "progress" { message } while
// the agent works, then "result" { resume, review, ... } or "error" { message }.
exports.generateResume = async (req, res) => {
  const userId = String(req.session.userId);
  const { options, ids, error } = parseOptions(req.body);

  if (error) return res.status(400).json({ success: false, message: error });

  if (running.has(userId)) {
    return res.status(409).json({ success: false, message: "A resume is already being written. Wait for it to finish." });
  }

  let source;

  try {
    if (options.useAi) {
      const ai = await ollamaStatus();
      if (!ai.available) return res.status(503).json({ success: false, message: ai.message });
    }

    source = await loadSource(userId, options, ids);
  } catch (loadError) {
    console.error("Resume data error:", loadError);
    return res.status(500).json({ success: false, message: "Unable to load your portfolio" });
  }

  running.add(userId);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Closing the page stops the agent
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const llm = options.useAi ? createOllamaLlm() : null;

    const result = await buildResume({
      source,
      options,
      llm,
      signal: controller.signal,
      onProgress: (message) => send("progress", { message })
    });

    // How well the finished resume fits the job: evidence and a weighted,
    // explainable score from code (the AI only helps find requirements)
    const match = await evaluateJobMatch({
      resume: result.resume,
      jobDescription: options.jobDescription,
      llm,
      signal: controller.signal,
      onProgress: (message) => send("progress", { message })
    });

    send("result", { ...result, match, aiUsed: options.useAi, model: llm?.model || null });
  } catch (buildError) {
    if (!controller.signal.aborted) {
      console.error("Resume build error:", buildError);
      send("error", { message: "Unable to build the resume. Please try again." });
    }
  } finally {
    running.delete(userId);
    res.end();
  }
};

// POST /api/resume/summary-fit  { resume, summary, targetWords, feedback }
// Rephrases the summary to a length that fills its lines on the page (the
// browser measures them). Facts, numbers and tools must stay the same.
exports.fitSummary = async (req, res) => {
  const { resume, summary, targetWords, feedback } = req.body || {};

  if (!resume || !Array.isArray(resume.experience) || !resume.skills || !Array.isArray(resume.skills.technical)) {
    return res.status(400).json({ success: false, message: "Send the resume as it was built" });
  }
  if (typeof summary !== "string" || !summary.trim() || summary.length > 1500) {
    return res.status(400).json({ success: false, message: "Send the summary to rephrase" });
  }
  const words = Number(targetWords);
  if (!Number.isInteger(words) || words < 30 || words > 160) {
    return res.status(400).json({ success: false, message: "The target length must be 30 to 160 words" });
  }

  const status = await ollamaStatus();
  if (!status.available) return res.status(503).json({ success: false, message: status.message });

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const result = await refitSummary({
      llm: createOllamaLlm(),
      resume,
      summary: summary.trim(),
      targetWords: words,
      feedback: typeof feedback === "string" ? feedback.slice(0, 300) : "",
      signal: controller.signal
    });
    if (result.error) return res.status(422).json({ success: false, message: result.error });
    return res.json({ success: true, summary: result.summary });
  } catch (error) {
    if (controller.signal.aborted) return undefined;
    console.error("Summary fit error:", error);
    return res.status(500).json({ success: false, message: "Unable to rephrase the summary" });
  }
};

// POST /api/resume/revise
// { ...the options the resume was built with, resume, keywords, requirements?,
//   revisionInstructions }
// Sends the finished resume through the agents again under the user's new
// instructions. Same event stream as /generate, plus "clarify"
// { question, options } when the instructions are unclear; the client asks
// the user and sends again with clarifications: [{ question, answer }].
exports.reviseResume = async (req, res) => {
  const userId = String(req.session.userId);
  const { options, ids, error } = parseOptions(req.body);
  if (error) return res.status(400).json({ success: false, message: error });

  const { resume, keywords = [], requirements } = req.body;
  const instructions = typeof req.body.revisionInstructions === "string" ? req.body.revisionInstructions.trim() : "";
  if (!instructions) return res.status(400).json({ success: false, message: "Say what to change" });
  if (instructions.length > INSTRUCTIONS_MAX) {
    return res.status(400).json({ success: false, message: `Instructions can be up to ${INSTRUCTIONS_MAX} characters` });
  }
  if (!resume || typeof resume.summary !== "string" || !resume.sections || !Array.isArray(resume.experience) ||
      !Array.isArray(resume.projects) || !Array.isArray(resume.education) || !resume.skills || !Array.isArray(resume.skills.technical)) {
    return res.status(400).json({ success: false, message: "Send the resume as it was built" });
  }
  // Answers to the agent's earlier questions: [{ question, answer }]
  const clarifications = req.body.clarifications ?? [];
  if (!Array.isArray(clarifications) || clarifications.length > 5 || !clarifications.every((item) =>
    item && typeof item.question === "string" && typeof item.answer === "string" &&
    item.question.length <= 200 && item.answer.trim() && item.answer.length <= 300)) {
    return res.status(400).json({ success: false, message: "Send your answers as they were asked" });
  }
  if (!Array.isArray(keywords) || keywords.length > 40 || !keywords.every((keyword) => typeof keyword === "string" && keyword.length <= 60)) {
    return res.status(400).json({ success: false, message: "Send the keywords from the build" });
  }
  if (running.has(userId)) {
    return res.status(409).json({ success: false, message: "A resume is already being written. Wait for it to finish." });
  }

  const ai = await ollamaStatus();
  if (!ai.available) return res.status(503).json({ success: false, message: ai.message });

  let source;
  try {
    source = await loadSource(userId, options, ids);
  } catch (loadError) {
    console.error("Resume data error:", loadError);
    return res.status(500).json({ success: false, message: "Unable to load your portfolio" });
  }

  running.add(userId);
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const llm = createOllamaLlm();
    const result = await reviseResume({
      source, options: { ...options, useAi: true }, resume, instructions, keywords, llm,
      clarifications: clarifications.map((item) => ({ question: item.question, answer: item.answer.trim() })),
      signal: controller.signal,
      onProgress: (message) => send("progress", { message })
    });
    // Unclear instructions: ask the user before changing anything
    if (result.question) {
      send("clarify", result.question);
      return;
    }

    // Score against the requirements found at build time when we have them
    const reuse = Array.isArray(requirements) && requirements.length <= 60 && requirements.every(isRequirement);
    const match = await evaluateJobMatch({
      resume: result.resume,
      jobDescription: options.jobDescription,
      requirements: reuse ? requirements : null,
      llm: reuse ? null : llm,
      signal: controller.signal,
      onProgress: (message) => send("progress", { message })
    });
    send("result", { ...result, match, aiUsed: true, model: llm.model });
  } catch (reviseError) {
    if (!controller.signal.aborted) {
      console.error("Resume revise error:", reviseError);
      send("error", { message: "Unable to revise the resume. Please try again." });
    }
  } finally {
    running.delete(userId);
    res.end();
  }
};

// POST /api/resume/compare  multipart: file (PDF, DOCX, RTF or TXT resume), jobDescription
// Reads an uploaded resume and compares it with the job for any kind of
// role: keywords, responsibilities and qualifications, plus an ATS check of
// the file itself (layout, contact details, headings, bullets, length). The AI (if running)
// helps read the job and match duties worded differently; code checks and
// scores everything.
exports.compareResume = async (req, res) => {
  const jobDescription = typeof req.body?.jobDescription === "string" ? req.body.jobDescription.trim() : "";
  if (jobDescription.length < 50) return res.status(400).json({ success: false, message: "Paste the job description (at least a few sentences)" });
  if (jobDescription.length > 8000) return res.status(400).json({ success: false, message: "The job description can be up to 8000 characters" });
  // Optional: what the candidate typed; otherwise read from the job description
  const company = typeof req.body?.company === "string" ? req.body.company.trim().slice(0, 80) : "";
  const jobTitle = typeof req.body?.jobTitle === "string" ? req.body.jobTitle.trim().slice(0, 120) : "";

  let text;
  let meta;
  try {
    ({ text, meta } = await readResume(req.file.buffer, req.file.detectedType));
  } catch (readError) {
    console.error("Resume read error:", readError);
    return res.status(422).json({ success: false, message: "Couldn't read this file. Try saving it again as PDF or DOCX." });
  }
  if (text.replace(/\s/g, "").length < 200) {
    return res.status(422).json({ success: false, message: "This file has almost no text. If it's a scanned PDF, upload the original document instead." });
  }

  try {
    const links = (meta.links || []).slice(0, 50);
    const parsed = parseResumeText(text, { links });
    const { resume, found } = parsed;
    const ai = await ollamaStatus();
    const match = await compareResume({ resume, jobDescription, jobTitle, company, llm: ai.available ? createOllamaLlm() : null });
    const notes = [...match.notes];
    if (!ai.available) notes.push("The AI isn't running, so the job was read from its headings and wording only.");
    if (!found.structured) notes.push("Couldn't find the resume's sections, so the whole text was checked as one block.");

    const ats = atsFileCheck({ text, meta, parsed, type: req.file.detectedType, keywordScore: match.keywords.score });

    const recommendations = recommendationsFor(match, ats);
    const result = { resume, found, match, ats, recommendations, notes, aiUsed: ai.available };

    // Saved to the log book (deleted automatically after 72 hours)
    let logId = null;
    try {
      const log = await ResumeMatchLog.create({
        userId: req.session.userId,
        fileName: String(req.file.originalname || "resume").slice(0, 200),
        fileType: req.file.detectedType,
        file: req.file.buffer,
        text: text.slice(0, 100000),
        links,
        jobDescription,
        jobTitle: (match.header.role || "").slice(0, 120),
        company: (match.header.company || "").slice(0, 80),
        candidateName: (resume.contact.name || "").slice(0, 120),
        overall: match.overall,
        atsScore: ats.score,
        result
      });
      logId = String(log._id);
    } catch (logError) {
      console.error("Resume match log error:", logError);
      notes.push("Couldn't save this comparison to your log book.");
    }

    return res.json({ success: true, ...result, logId, text: text.slice(0, 100000) });
  } catch (compareError) {
    console.error("Resume compare error:", compareError);
    return res.status(500).json({ success: false, message: "Unable to compare the resume" });
  }
};

// POST /api/resume/job-info  { jobDescription } -> { title, company }
// Fills JobPilot's Company and Job title fields as the job is pasted (no AI)
exports.jobInfo = (req, res) => {
  const jobDescription = typeof req.body?.jobDescription === "string" ? req.body.jobDescription.slice(0, 8000) : "";
  return res.json({ success: true, ...jobInfoOf(jobDescription) });
};

const expiresAt = (createdAt) => new Date(new Date(createdAt).getTime() + LOG_LIFETIME_SECONDS * 1000);
const validLogId = (id) => mongoose.isValidObjectId(id) && /^[a-f0-9]{24}$/i.test(id);

// GET /api/resume/match-logs
// The log book: the user's comparisons from the last 72 hours, newest first
exports.listMatchLogs = async (req, res) => {
  try {
    const logs = await ResumeMatchLog.find({ userId: req.session.userId })
      .select("fileName fileType jobTitle company candidateName overall atsScore createdAt")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json({
      success: true,
      lifetimeHours: LOG_LIFETIME_SECONDS / 3600,
      logs: logs.map((log) => ({ ...log, id: String(log._id), _id: undefined, expiresAt: expiresAt(log.createdAt) }))
    });
  } catch (error) {
    console.error("Match log list error:", error);
    return res.status(500).json({ success: false, message: "Unable to load your log book" });
  }
};

// GET /api/resume/match-logs/:id  everything saved for one comparison
exports.getMatchLog = async (req, res) => {
  if (!validLogId(req.params.id)) return res.status(404).json({ success: false, message: "Log entry not found" });
  try {
    const log = await ResumeMatchLog.findOne({ _id: req.params.id, userId: req.session.userId }).select("+text").lean();
    if (!log) return res.status(404).json({ success: false, message: "This entry was not found or has expired (entries last 72 hours)" });
    const { _id, file, ...rest } = log;
    return res.json({ success: true, log: { ...rest, id: String(_id), expiresAt: expiresAt(log.createdAt) } });
  } catch (error) {
    console.error("Match log error:", error);
    return res.status(500).json({ success: false, message: "Unable to load this entry" });
  }
};

// GET /api/resume/match-logs/:id/file  the uploaded resume, for Preview
exports.getMatchLogFile = async (req, res) => {
  if (!validLogId(req.params.id)) return res.status(404).json({ success: false, message: "Log entry not found" });
  try {
    const log = await ResumeMatchLog.findOne({ _id: req.params.id, userId: req.session.userId }).select("+file fileName fileType").lean();
    if (!log) return res.status(404).json({ success: false, message: "This entry was not found or has expired" });
    const name = log.fileName.replace(/[^\w.\- ]/g, "_");
    res.set({
      "Content-Type": log.fileType,
      "Content-Disposition": `inline; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store"
    });
    return res.send(Buffer.from(log.file.buffer || log.file));
  } catch (error) {
    console.error("Match log file error:", error);
    return res.status(500).json({ success: false, message: "Unable to load the file" });
  }
};

// DELETE /api/resume/match-logs/:id
exports.deleteMatchLog = async (req, res) => {
  if (!validLogId(req.params.id)) return res.status(404).json({ success: false, message: "Log entry not found" });
  try {
    const { deletedCount } = await ResumeMatchLog.deleteOne({ _id: req.params.id, userId: req.session.userId });
    if (!deletedCount) return res.status(404).json({ success: false, message: "Log entry not found" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Match log delete error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete this entry" });
  }
};

// POST /api/resume/match-logs/:id/confirm  { confirmations: { key: "yes" | "no" | null } }
// The candidate answers questions about inferred or unconfirmed skills;
// the saved resume and job are compared again with those answers (no AI,
// so the same answers always give the same result). "null" clears an answer.
exports.confirmMatchLog = async (req, res) => {
  if (!validLogId(req.params.id)) return res.status(404).json({ success: false, message: "Log entry not found" });
  const sent = req.body?.confirmations;
  if (!sent || typeof sent !== "object" || Array.isArray(sent) || Object.keys(sent).length > 40) {
    return res.status(400).json({ success: false, message: "Send your answers as { skill: \"yes\" | \"no\" }" });
  }
  try {
    const log = await ResumeMatchLog.findOne({ _id: req.params.id, userId: req.session.userId }).select("+text +links");
    if (!log) return res.status(404).json({ success: false, message: "This entry was not found or has expired (entries last 72 hours)" });

    // Merge with earlier answers; only known questions, only yes/no
    const allowed = new Set((log.result?.match?.findings?.confirmable || []).map((entry) => entry.key));
    const confirmations = { ...(log.confirmations || {}) };
    for (const [key, value] of Object.entries(sent)) {
      if (!allowed.has(key)) continue;
      if (value === "yes" || value === "no") confirmations[key] = value;
      else delete confirmations[key];
    }

    // The resume-only match and the candidate-informed one are kept apart:
    // answers are self-reported, the resume is what employers see
    const parsed = parseResumeText(log.text, { links: log.links || [] });
    const details = { resume: parsed.resume, jobDescription: log.jobDescription, jobTitle: log.jobTitle, company: log.company };
    const answered = Object.keys(confirmations).length > 0;
    const resumeOnly = await compareResume(details);
    const match = answered ? await compareResume({ ...details, confirmations }) : resumeOnly;
    if (answered) match.resumeOnly = { overall: resumeOnly.overall, fit: resumeOnly.fit, classification: resumeOnly.classification };
    const ats = log.result.ats;
    const recommendations = recommendationsFor(match, ats);
    const notes = [...match.notes, ...(answered ? [`Includes your answers to the confirmation questions (self-reported). On the resume alone the match is ${resumeOnly.overall}%; confirmed skills still need to be written into the resume for employers to see them.`] : [])];
    const result = { ...log.result, match, recommendations, notes };

    // The Log Book keeps the resume-only score
    log.set({ result, confirmations, overall: resumeOnly.overall });
    log.markModified("result");
    log.markModified("confirmations");
    await log.save();
    return res.json({ success: true, ...result, logId: String(log._id), confirmations });
  } catch (error) {
    console.error("Match confirm error:", error);
    return res.status(500).json({ success: false, message: "Unable to update the comparison" });
  }
};

const isRequirement = (item) =>
  item && typeof item === "object" && typeof item.text === "string" &&
  CATEGORY_IDS.includes(item.category) && ["critical", "required", "preferred"].includes(item.importance);

// POST /api/resume/match  { resume, requirements, weights? }
// Scores an edited resume against the requirements found when it was built,
// so a new score reflects real changes. No AI; the same input always gives
// the same result.
exports.recalculateMatch = async (req, res) => {
  try {
    const { resume, requirements, weights } = req.body || {};

    if (!resume || !Array.isArray(resume.experience) || !Array.isArray(resume.projects) ||
        !Array.isArray(resume.education) || !resume.skills || !Array.isArray(resume.skills.technical)) {
      return res.status(400).json({ success: false, message: "Send the resume as it was built" });
    }
    if (!Array.isArray(requirements) || requirements.length > 60 || !requirements.every(isRequirement)) {
      return res.status(400).json({ success: false, message: "Send the requirements from the earlier match" });
    }

    const cleanWeights = {};
    for (const id of CATEGORY_IDS) {
      const value = Number(weights?.[id]);
      if (Number.isFinite(value) && value >= 0 && value <= 100) cleanWeights[id] = value;
    }

    const match = await evaluateJobMatch({ resume, requirements, weights: cleanWeights });
    return res.json({ success: true, match });
  } catch (error) {
    console.error("Recalculate match error:", error);
    return res.status(500).json({ success: false, message: "Unable to recalculate the match" });
  }
};
