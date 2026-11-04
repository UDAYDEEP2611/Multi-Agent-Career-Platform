const mongoose = require("mongoose");
const Draft = require("../../models/Draft");
const CustomDesign = require("../../models/CustomDesign");
const { callController } = require("../../utils/callController");
const { specOf, coerceAll } = require("./sectionSpecs");
const { designById, SECTIONS } = require("./designCatalog");

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

const plain = (value) => (value instanceof Map ? Object.fromEntries(value) : JSON.parse(JSON.stringify(value || {})));

function overrideView(override = {}) {
  const view = { hiddenEntries: override.hiddenEntries || [], accent: override.accent || "" };
  const limits = plain(override.limits);
  if (Object.keys(limits).length) view.limits = limits;
  if (Array.isArray(override.extras)) view.extras = override.extras;
  if (typeof override.allSkills === "boolean") view.allSkills = override.allSkills;
  const columns = plain(override.columns);
  if (Object.keys(columns).length) view.columns = columns;
  if (Array.isArray(override.hiddenFields)) view.hiddenFields = override.hiddenFields;
  if (override.skillStyle) view.skillStyle = override.skillStyle;
  if (override.tweaks && Object.keys(override.tweaks).length) view.tweaks = override.tweaks;
  if (override.order?.length) view.order = override.order;
  if (override.rewrites && Object.keys(override.rewrites).length) view.rewrites = override.rewrites;
  return view;
}

function resumeSettingsView(doc) {
  const { RESUME_LIMIT_DEFAULTS } = require("../../models/ResumeSettings");
  const limits = doc?.limits ? { ...RESUME_LIMIT_DEFAULTS, ...JSON.parse(JSON.stringify(doc.limits)) } : { ...RESUME_LIMIT_DEFAULTS };
  const designs = Object.fromEntries(Object.entries(plain(doc?.designs)).map(([id, override]) => [id, overrideView(override)]));
  return { limits, extras: doc?.extras || [], allSkills: Boolean(doc?.allSkills), columns: plain(doc?.columns), hiddenFields: doc?.hiddenFields || [], skillStyle: doc?.skillStyle || "", tweaks: doc?.tweaks || {}, order: doc?.order || [], rewrites: doc?.rewrites || {}, designs };
}

// Wording for every resume, with one resume's own on top
function mergedRewrites(shared = {}, own = {}) {
  return {
    ...shared,
    ...own,
    replace: [...(shared.replace || []), ...(own.replace || [])],
    contact: { ...(shared.contact || {}), ...(own.contact || {}) },
    titles: { ...(shared.titles || {}), ...(own.titles || {}) }
  };
}

// One design's settings: the shared ones with its own changes on top
function effectiveResumeSettings(settings, designId) {
  const override = settings.designs?.[designId] || {};
  return {
    limits: { ...settings.limits, ...(override.limits || {}) },
    extras: override.extras || settings.extras,
    allSkills: override.allSkills ?? settings.allSkills,
    columns: { ...(settings.columns || {}), ...(override.columns || {}) },
    hiddenFields: override.hiddenFields || settings.hiddenFields || [],
    skillStyle: override.skillStyle || settings.skillStyle || "",
    tweaks: { ...(settings.tweaks || {}), ...(override.tweaks || {}) },
    order: override.order?.length ? override.order : settings.order || [],
    rewrites: mergedRewrites(settings.rewrites, override.rewrites),
    hiddenEntries: override.hiddenEntries || [],
    accent: override.accent || ""
  };
}

async function getResumeSettings(userId) {
  const ResumeSettings = require("../../models/ResumeSettings");
  return resumeSettingsView(await ResumeSettings.findOne({ userId }).lean());
}

const DESIGN_ID = /^[a-z][a-z0-9-]{0,40}$/;
const ENTRY_KEY = /^[a-z]+:[0-9a-f]{24}$/;

// The columns asked for, keeping only known sections and places
const validColumns = (columns = {}) => {
  const { RESUME_COLUMN_SECTIONS, RESUME_COLUMN_PLACES } = require("../../models/ResumeSettings");
  return Object.entries(columns).filter(([id, place]) => RESUME_COLUMN_SECTIONS.includes(id) && RESUME_COLUMN_PLACES.includes(place));
};

// Details left off entries, after hiding and showing some ("education:<id>:grade")
const FIELD_KEY = /^(?:[a-z]+:[0-9a-f]{24}:[a-z]+|(?:contact|page):[a-z]+)$/;
function changedFields(current, changes) {
  const fields = new Set(current);
  for (const key of changes.hideFields || []) if (FIELD_KEY.test(key)) fields.add(key);
  for (const key of changes.showFields || []) fields.delete(key);
  return [...fields].slice(0, 300);
}
// Resume-only wording after a change. rewrite: { replace: { from, to }, summary,
// line, contact: { phone: "..." }, titles: { experience: "..." }, clear: true }
const REWRITE_CONTACT = ["name", "phone", "email", "location", "linkedin", "github", "portfolio"];
const cleanText = (value, max) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : "");
function changedRewrites(current = {}, rewrite = {}) {
  if (rewrite.clear) return undefined;
  const next = { ...current };
  const from = cleanText(rewrite.replace?.from, 1000);
  const to = cleanText(rewrite.replace?.to, 1000);
  if (from && to) next.replace = [...(current.replace || []).filter((item) => item.from.toLowerCase() !== from.toLowerCase()), { from, to }].slice(-100);
  for (const key of ["summary", "line"]) if (cleanText(rewrite[key], 1500)) next[key] = cleanText(rewrite[key], 1500);
  const contact = Object.entries(rewrite.contact || {}).filter(([id, value]) => REWRITE_CONTACT.includes(id) && cleanText(value, 200));
  if (contact.length) next.contact = { ...(current.contact || {}), ...Object.fromEntries(contact.map(([id, value]) => [id, cleanText(value, 200)])) };
  const titles = Object.entries(rewrite.titles || {}).filter(([id, value]) => require("../../models/ResumeSettings").RESUME_COLUMN_SECTIONS.includes(id) && cleanText(value, 60));
  if (titles.length) next.titles = { ...(current.titles || {}), ...Object.fromEntries(titles.map(([id, value]) => [id, cleanText(value, 60)])) };
  return next;
}

const validOrder = (order) => Array.isArray(order) && order.length > 0 && order.every((id) => require("../../models/ResumeSettings").RESUME_COLUMN_SECTIONS.includes(id));
// Sizes that are numbers within sense; anything else is dropped
const TWEAK_LIMITS = { sideShift: [-40, 40], margin: [-100, 200], gutter: [-100, 200], text: [-100, 200], spacing: [-100, 200] };
const validTweaks = (tweaks) => Object.fromEntries(Object.entries(tweaks || {})
  .filter(([key, value]) => TWEAK_LIMITS[key] && Number.isFinite(value) && value >= TWEAK_LIMITS[key][0] && value <= TWEAK_LIMITS[key][1]));
const validSkillStyle = (style) => require("../../models/ResumeSettings").RESUME_SKILL_STYLES.includes(style);

// changes: { limits: { projects: 3 | null (all) | "default" }, show: [...], hide: [...], allSkills, columns: { education: "right" }, hideFields / showFields: [...], skillStyle }
// designId: change only that resume design (its own overrides), which also
// takes hideEntries / showEntries (["projects:<id>"]), accent ("#1d4ed8" or
// "" for the design's own) and reset (drop all of that design's changes)
async function updateResumeSettings(userId, changes = {}, designId = "") {
  const ResumeSettings = require("../../models/ResumeSettings");
  const { RESUME_LIMIT_DEFAULTS, RESUME_EXTRAS } = ResumeSettings;
  const doc = (await ResumeSettings.findOne({ userId })) || new ResumeSettings({ userId });

  if (designId) {
    if (!DESIGN_ID.test(designId)) throw new Error("Unknown resume design");
    const current = changes.reset ? {} : overrideView(doc.designs?.get(designId)?.toObject?.() || doc.designs?.get(designId) || {});
    const next = { ...current, limits: { ...(current.limits || {}) } };
    for (const [id, count] of Object.entries(changes.limits || {})) {
      if (!(id in RESUME_LIMIT_DEFAULTS)) continue;
      if (count === null) next.limits[id] = 0;
      else if (count === "default") delete next.limits[id];
      else if (Number.isInteger(count) && count >= 1 && count <= 50) next.limits[id] = count;
    }
    if (changes.show?.length || changes.hide?.length) {
      const extras = new Set(current.extras || doc.extras);
      for (const id of changes.show || []) if (RESUME_EXTRAS.includes(id)) extras.add(id);
      for (const id of changes.hide || []) extras.delete(id);
      next.extras = [...extras];
    }
    if (typeof changes.allSkills === "boolean") next.allSkills = changes.allSkills;
    const columns = validColumns(changes.columns);
    if (columns.length) next.columns = { ...(current.columns || {}), ...Object.fromEntries(columns) };
    if (changes.hideFields?.length || changes.showFields?.length) next.hiddenFields = changedFields(current.hiddenFields || doc.hiddenFields || [], changes);
    if (validSkillStyle(changes.skillStyle)) next.skillStyle = changes.skillStyle;
    if (Object.keys(validTweaks(changes.tweaks)).length) next.tweaks = { ...(current.tweaks || {}), ...validTweaks(changes.tweaks) };
    if (validOrder(changes.order)) next.order = changes.order;
    if (changes.rewrite) {
      const rewrites = changedRewrites(current.rewrites, changes.rewrite);
      if (rewrites) next.rewrites = rewrites;
      else delete next.rewrites;
    }
    const hidden = new Set(current.hiddenEntries || []);
    for (const key of changes.hideEntries || []) if (ENTRY_KEY.test(key)) hidden.add(key);
    for (const key of changes.showEntries || []) hidden.delete(key);
    next.hiddenEntries = [...hidden].slice(0, 200);
    if (typeof changes.accent === "string" && /^(#[0-9a-fA-F]{6})?$/.test(changes.accent)) next.accent = changes.accent;
    if (!Object.keys(next.limits).length) delete next.limits;
    doc.designs.set(designId, next);
    doc.markModified("designs");
    await doc.save();
    return resumeSettingsView(doc.toObject());
  }

  for (const [id, count] of Object.entries(changes.limits || {})) {
    if (!(id in RESUME_LIMIT_DEFAULTS)) continue;
    if (count === null) doc.limits[id] = 0;
    else if (count === "default") doc.limits[id] = RESUME_LIMIT_DEFAULTS[id];
    else if (Number.isInteger(count) && count >= 1 && count <= 50) doc.limits[id] = count;
  }
  const extras = new Set(doc.extras);
  for (const id of changes.show || []) if (RESUME_EXTRAS.includes(id)) extras.add(id);
  for (const id of changes.hide || []) extras.delete(id);
  doc.extras = [...extras];
  if (typeof changes.allSkills === "boolean") doc.allSkills = changes.allSkills;
  // Every resume means every resume: a design's own choice for that section gives way
  for (const [id, place] of validColumns(changes.columns)) {
    doc.columns.set(id, place);
    for (const override of doc.designs.values()) override.columns?.delete(id);
    doc.markModified("designs");
  }
  if (changes.hideFields?.length || changes.showFields?.length) {
    doc.hiddenFields = changedFields(doc.hiddenFields || [], changes);
    for (const override of doc.designs.values()) if (override.hiddenFields) override.hiddenFields = changedFields(override.hiddenFields, changes);
    doc.markModified("designs");
  }
  if (changes.rewrite) {
    doc.rewrites = changedRewrites(doc.rewrites, changes.rewrite);
    doc.markModified("rewrites");
    if (changes.rewrite.clear) {
      for (const override of doc.designs.values()) override.rewrites = undefined;
      doc.markModified("designs");
    }
  }
  if (validOrder(changes.order)) {
    doc.order = changes.order;
    for (const override of doc.designs.values()) override.order = undefined;
    doc.markModified("designs");
  }
  if (validSkillStyle(changes.skillStyle)) {
    doc.skillStyle = changes.skillStyle;
    for (const override of doc.designs.values()) override.skillStyle = undefined;
    doc.markModified("designs");
  }
  const tweaks = validTweaks(changes.tweaks);
  if (Object.keys(tweaks).length) {
    doc.tweaks = { ...(doc.tweaks || {}), ...tweaks };
    doc.markModified("tweaks");
    for (const override of doc.designs.values()) {
      if (!override.tweaks) continue;
      override.tweaks = Object.fromEntries(Object.entries(override.tweaks).filter(([key]) => !(key in tweaks)));
    }
    doc.markModified("designs");
  }
  doc.markModified("limits");
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
