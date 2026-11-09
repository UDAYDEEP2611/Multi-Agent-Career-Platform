const mongoose = require("mongoose");
const Draft = require("../../models/Draft");
const CustomDesign = require("../../models/CustomDesign");
const { callController } = require("../../utils/callController");
const { specOf, coerceAll } = require("./sectionSpecs");
const { designById, SECTIONS } = require("./designCatalog");
const { resumeSettingsView, effectiveResumeSettings, changedResumeSettings } = require("./resumeSettingsRules");

// What the agents (through MCP) and the pages (through REST) change on the
// user's behalf: the buffer zone of prepared entries, and custom designs.
// Everything here runs inside the user's request (their database).

const MAX_DRAFTS = 100;
const MAX_DESIGNS = 30;

// ---- Buffer zone -----------------------------------------------------------

const draftView = (draft) => {
  const spec = specOf(draft.section);
  return {
    id: String(draft._id),
    section: draft.section,
    sectionLabel: spec?.label || draft.section,
    route: spec?.route || "/dashboard",
    summary: spec ? spec.describe(draft.data || {}) || spec.singular : draft.section,
    data: draft.data || {},
    fields: spec ? spec.fieldSpecs.map(({ name, type, required, enum: options, label }) => ({ name, type, required, options, label })) : [],
    notes: draft.notes || [],
    error: draft.error || "",
    sourceText: draft.sourceText || "",
    createdAt: draft.createdAt
  };
};

async function addDraft(userId, { section, data, sourceText = "", notes = [] }) {
  const spec = specOf(section);
  if (!spec) throw new Error(`Unknown section "${section}"`);
  if (await Draft.countDocuments({ userId }) >= MAX_DRAFTS) throw new Error("The buffer is full; confirm or discard some entries first");
  const draft = await Draft.create({
    userId,
    section,
    data: coerceAll(spec, data),
    sourceText: String(sourceText).slice(0, 4000),
    notes: notes.map((note) => String(note).slice(0, 300)).slice(0, 5)
  });
  return draftView(draft);
}

async function listDrafts(userId, section) {
  const drafts = await Draft.find({ userId, ...(section ? { section } : {}) }).sort({ createdAt: -1 }).lean();
  return drafts.map(draftView);
}

async function findDraft(userId, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Draft.findOne({ _id: id, userId });
}

async function updateDraft(userId, id, data) {
  const draft = await findDraft(userId, id);
  if (!draft) return null;
  const spec = specOf(draft.section);
  draft.data = coerceAll(spec, { ...draft.data, ...data });
  draft.error = "";
  draft.markModified("data");
  await draft.save();
  return draftView(draft);
}

async function discardDraft(userId, id) {
  const draft = await findDraft(userId, id);
  if (!draft) return false;
  await draft.deleteOne();
  return true;
}

// Creates the real record through the section's own controller, so it gets
// exactly the validation the section page's form gets. On failure the
// draft stays, with the controller's reason.
async function confirmDraft(session, id) {
  const draft = await findDraft(session.userId, id);
  if (!draft) return { status: 404, message: "That entry isn't in the buffer any more" };
  const spec = specOf(draft.section);
  let problem = null;

  if (spec.singleton) {
    problem = await confirmSingleton(session, draft.section, draft.data || {});
  } else {
    const [file, fn] = spec.controller;
    const handler = require(`../../controllers/${file}`)[fn];
    const body = { ...draft.data };
    // Controllers that need a value for booleans get false rather than missing
    for (const field of spec.fieldSpecs) if (field.type === "boolean" && body[field.name] === undefined) body[field.name] = false;
    const { status, body: reply } = await callController(handler, { session, body });
    if (status >= 400 || reply?.success === false) problem = reply?.message || "The section didn't accept it";
  }

  if (problem) {
    draft.error = String(problem).slice(0, 500);
    await draft.save();
    return { status: 400, message: draft.error, draft: draftView(draft) };
  }
  await draft.deleteOne();
  return { status: 201, message: spec.singleton ? `Updated your ${spec.label}.` : `Added to ${spec.label}.`, section: draft.section };
}

// ---- Skills ------------------------------------------------------------------

// Whether a skill is already there, compared the way the Skills page does:
// case and spacing don't matter ("python" = "Python", "React  JS" = "react js").
// { name, existing, inBuffer, similar, canonical, skillType }
async function checkSkill(userId, rawName) {
  const UserSkill = require("../../models/UserSkill");
  const { normalizeSkillName } = UserSkill;
  const { findSimilar } = require("../../utils/skillSimilarity");
  const catalog = require("../../scripts/skillCatalogData");

  const name = String(rawName || "").trim().replace(/\s+/g, " ");
  const normalized = normalizeSkillName(name);
  const skills = await UserSkill.find({ userId }, { name: 1, normalizedName: 1, skillType: 1 }).lean();
  const existing = skills.find((skill) => skill.normalizedName === normalized);
  const drafts = await Draft.find({ userId, section: "skills" }, { data: 1 }).lean();
  const inBuffer = drafts.find((draft) => draft.data?.name && normalizeSkillName(draft.data.name) === normalized);

  // The catalog's spelling when it's the same skill ("langgraph" -> "LangGraph")
  const exact = catalog.find((item) => normalizeSkillName(item.name) === normalized);
  return {
    name,
    existing: existing ? { name: existing.name } : null,
    inBuffer: inBuffer ? { name: inBuffer.data.name } : null,
    // Look-alikes already on the Skills page ("ReactJS" next to "React")
    similar: existing ? [] : findSimilar(name, skills).map((skill) => skill.name),
    canonical: exact?.name || null,
    skillType: exact?.skillType || null
  };
}

// Profile and Summary are single records: whether there is one, and what's in it
async function getSectionRecord(userId, section) {
  if (section === "profile") {
    const profile = await require("../../models/Profile").findOne({ userId }).lean();
    return { exists: Boolean(profile), data: profile ? { ...profile.contact, headline: profile.roleDetails?.headline || "", roleTargeting: profile.roleDetails?.roleTargeting || "", targetRoles: profile.roleDetails?.targetRoles || [] } : {} };
  }
  if (section === "summary") {
    const summary = await require("../../models/Summary").findOne({ userId }).lean();
    return { exists: Boolean(summary), data: summary ? { content: summary.content } : {} };
  }
  return { exists: false, data: {} };
}

const ROLE_FIELDS = ["headline", "roleTargeting", "targetRoles"];

// Saving a single record: update it if it's there, create it if not, through
// the same controllers as the Profile and Summary pages
async function confirmSingleton(session, section, data) {
  const { exists } = await getSectionRecord(session.userId, section);
  const controller = require(`../../controllers/${section === "profile" ? "profileController" : "summaryController"}`);
  const failed = (reply) => reply.status >= 400 || reply.body?.success === false;

  if (section === "summary") {
    const reply = await callController(exists ? controller.updateSummary : controller.createSummary, { session, body: { content: data.content, origin: "Assistant" } });
    return failed(reply) ? reply.body?.message || "The summary wasn't saved" : null;
  }

  const contact = Object.fromEntries(Object.entries(data).filter(([key]) => !ROLE_FIELDS.includes(key)));
  const roles = Object.fromEntries(Object.entries(data).filter(([key]) => ROLE_FIELDS.includes(key)));
  if (Object.keys(contact).length || !exists) {
    const reply = exists
      ? await callController(controller.updateContact, { session, body: contact })
      : await callController(controller.createProfile, { session, body: { contact } });
    if (failed(reply)) return reply.body?.message || "The profile wasn't saved";
  }
  if (Object.keys(roles).length) {
    const reply = await callController(controller.updateRoleDetails, { session, body: roles });
    if (failed(reply)) return reply.body?.message || "The role details weren't saved";
  }
  return null;
}

// ---- Resume settings -------------------------------------------------------
// The rules are in resumeSettingsRules.js; this reads and stores them

async function getResumeSettings(userId) {
  const ResumeSettings = require("../../models/ResumeSettings");
  return resumeSettingsView(await ResumeSettings.findOne({ userId }).lean());
}

// See changedResumeSettings for the changes it takes
async function updateResumeSettings(userId, changes = {}, designId = "") {
  const ResumeSettings = require("../../models/ResumeSettings");
  const doc = (await ResumeSettings.findOne({ userId })) || new ResumeSettings({ userId });
  const next = changedResumeSettings(resumeSettingsView(doc.toObject()), changes, designId);
  const { limits, extras, allSkills, columns, hiddenFields, skillStyle, tweaks, order, rewrites, designs } = next;
  doc.set({ limits, extras, allSkills, columns, hiddenFields, skillStyle, order, designs });
  doc.tweaks = Object.keys(tweaks).length ? tweaks : undefined;
  doc.rewrites = Object.keys(rewrites).length ? rewrites : undefined;
  for (const path of ["limits", "columns", "tweaks", "rewrites", "designs"]) doc.markModified(path);
  await doc.save();
  return resumeSettingsView(doc.toObject());
}

// ---- Custom designs --------------------------------------------------------

const designView = (design) => ({
  id: String(design._id),
  name: design.name,
  baseId: design.baseId,
  baseName: designById(design.baseId)?.name || design.baseId,
  accent: design.accent,
  font: design.font,
  headingFont: design.headingFont,
  corners: design.corners,
  mode: design.mode,
  hidden: design.hidden || [],
  order: design.order || [],
  titles: design.titles instanceof Map ? Object.fromEntries(design.titles) : (design.titles || {}),
  limits: design.limits instanceof Map ? Object.fromEntries(design.limits) : (design.limits || {}),
  heroSummary: design.heroSummary || "",
  updatedAt: design.updatedAt
});

async function listCustomDesigns(userId) {
  const designs = await CustomDesign.find({ userId }).sort({ updatedAt: -1 }).lean();
  return designs.map(designView);
}

async function getCustomDesign(userId, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const design = await CustomDesign.findOne({ _id: id, userId }).lean();
  return design ? designView(design) : null;
}

// Applies a checked plan (designPlanner.sanitizePlan output).
// Returns { action, design?, deleted? }
async function applyDesignPlan(userId, plan) {
  if (plan.action === "delete") {
    if (!mongoose.isValidObjectId(plan.targetId)) return { action: "none" };
    const deleted = await CustomDesign.findOneAndDelete({ _id: plan.targetId, userId }).lean();
    return deleted ? { action: "delete", deleted: designView(deleted) } : { action: "none" };
  }
  if (!["create", "update"].includes(plan.action)) return { action: plan.action };

  let design;
  if (plan.action === "create") {
    if (await CustomDesign.countDocuments({ userId }) >= MAX_DESIGNS) throw new Error(`You can keep up to ${MAX_DESIGNS} custom designs`);
    const base = designById(plan.baseId) || designById("slate");
    const taken = new Set((await CustomDesign.find({ userId }, { name: 1 }).lean()).map((item) => item.name.toLowerCase()));
    let name = plan.changes.name || `My ${base.name}`;
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${plan.changes.name || `My ${base.name}`} ${n}`;
    design = new CustomDesign({ userId, baseId: base.id, name });
  } else {
    if (!mongoose.isValidObjectId(plan.targetId)) return { action: "none" };
    design = await CustomDesign.findOne({ _id: plan.targetId, userId });
    if (!design) return { action: "none" };
  }

  const { changes } = plan;
  for (const key of ["accent", "font", "headingFont", "corners", "mode", "heroSummary"]) {
    if (changes[key] !== undefined) design[key] = changes[key];
  }
  if (changes.name && plan.action === "update") design.name = changes.name;
  if (changes.order) design.order = changes.order;
  const hidden = new Set(design.hidden || []);
  for (const id of changes.hide || []) hidden.add(id);
  for (const id of changes.show || []) hidden.delete(id);
  design.hidden = [...hidden].filter((id) => SECTIONS.includes(id));
  for (const [id, title] of Object.entries(changes.titles || {})) design.titles.set(id, title);
  for (const [id, count] of Object.entries(changes.limits || {})) {
    if (count === null) design.limits.delete(id);
    else {
      design.limits.set(id, count);
      // Limiting a section means showing it
      design.hidden = design.hidden.filter((hiddenId) => hiddenId !== id);
    }
  }

  await design.save();
  return { action: plan.action, design: designView(design) };
}

async function deleteCustomDesign(userId, id) {
  if (!mongoose.isValidObjectId(id)) return false;
  return Boolean(await CustomDesign.findOneAndDelete({ _id: id, userId }));
}

module.exports = {
  effectiveResumeSettings,
  getResumeSettings,
  updateResumeSettings,
  checkSkill,
  getSectionRecord,
  addDraft, listDrafts, updateDraft, discardDraft, confirmDraft,
  listCustomDesigns, getCustomDesign, applyDesignPlan, deleteCustomDesign
};
