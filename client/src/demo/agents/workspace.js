import catalog from "../../../../server/scripts/skillCatalogData";
import { designById, SECTIONS } from "../../../../server/services/agents/designCatalog";
import { changedResumeSettings, effectiveResumeSettings, resumeSettingsView } from "../../../../server/services/agents/resumeSettingsRules";
import { coerceAll, specOf } from "../../../../server/services/agents/sectionSpecs";
import { findSimilar } from "../../../../server/utils/skillSimilarity";
import { newId, writeEntry, writeRecord } from "../demoStore";
import { currentStore } from "./current";

// The server's workspace.js (the buffer zone, resume settings and custom
// designs), kept in the demo data instead of MongoDB. The same functions and
// replies, so the agents and MCP tools run unchanged.

const MAX_DRAFTS = 100;
const MAX_DESIGNS = 30;
const normalizeSkillName = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();

export { effectiveResumeSettings };

// ---- Buffer zone -----------------------------------------------------------

const drafts = () => (currentStore().drafts ||= []);

const draftView = (draft) => {
  const spec = specOf(draft.section);
  return {
    id: draft._id,
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

export async function addDraft(userId, { section, data, sourceText = "", notes = [] }) {
  const spec = specOf(section);
  if (!spec) throw new Error(`Unknown section "${section}"`);
  if (drafts().length >= MAX_DRAFTS) throw new Error("The buffer is full; confirm or discard some entries first");
  const draft = {
    _id: newId(),
    section,
    data: coerceAll(spec, data),
    sourceText: String(sourceText).slice(0, 4000),
    notes: notes.map((note) => String(note).slice(0, 300)).slice(0, 5),
    error: "",
    createdAt: new Date().toISOString()
  };
  drafts().push(draft);
  return draftView(draft);
}

export async function listDrafts(userId, section) {
  return drafts().filter((draft) => !section || draft.section === section).reverse().map(draftView);
}

const findDraft = (id) => drafts().find((draft) => draft._id === id) || null;

export async function updateDraft(userId, id, data) {
  const draft = findDraft(id);
  if (!draft) return null;
  draft.data = coerceAll(specOf(draft.section), { ...draft.data, ...data });
  draft.error = "";
  return draftView(draft);
}

export async function discardDraft(userId, id) {
  const draft = findDraft(id);
  if (!draft) return false;
  drafts().splice(drafts().indexOf(draft), 1);
  return true;
}

// Where each section's entries are kept in the demo data
const LISTS = {
  skills: "skills", recommendations: "recommendations", education: "educations", experience: "experiences",
  projects: "projects", certifications: "certifications", achievements: "achievements", volunteering: "volunteering",
  publications: "publications", patents: "patents", interests: "interests"
};

// The checks the section's own form and controller make, in short: required
// fields, and no second copy of a skill
function problemWith(spec, data) {
  const missing = spec.fieldSpecs.filter((field) => field.required && (data[field.name] === undefined || data[field.name] === null || data[field.name] === ""));
  if (missing.length) return `Add ${missing.map((field) => field.label).join(", ")} first`;
  if (spec.id === "skills") {
    const name = normalizeSkillName(String(data.name || ""));
    if ((currentStore()["/api/skills"]?.skills || []).some((skill) => skill.normalizedName === name)) return `${data.name} is already on your Skills page`;
  }
  return null;
}

const ROLE_FIELDS = ["headline", "roleTargeting", "targetRoles"];

// Saves the entry to the demo data, as the section's page would
export async function confirmDraft(session, id) {
  const draft = findDraft(id);
  if (!draft) return { status: 404, message: "That entry isn't in the buffer any more" };
  const spec = specOf(draft.section);
  const store = currentStore();
  const data = { ...draft.data };
  let problem = null;

  if (spec.id === "summary") {
    writeRecord(store, "put", "/api/summary", { content: data.content, origin: "Assistant" });
  } else if (spec.id === "profile") {
    const contact = Object.fromEntries(Object.entries(data).filter(([key]) => !ROLE_FIELDS.includes(key)));
    const roles = Object.fromEntries(Object.entries(data).filter(([key]) => ROLE_FIELDS.includes(key)));
    if (Object.keys(contact).length) writeRecord(store, "patch", "/api/profile", { contact });
    if (Object.keys(roles).length) writeRecord(store, "patch", "/api/profile/roles", roles);
  } else {
    for (const field of spec.fieldSpecs) if (field.type === "boolean" && data[field.name] === undefined) data[field.name] = false;
    problem = problemWith(spec, data);
    if (!problem && !writeEntry(store, "post", `/api/${LISTS[spec.id]}`, data)) problem = "The section didn't accept it";
  }

  if (problem) {
    draft.error = String(problem).slice(0, 500);
    return { status: 400, message: draft.error, draft: draftView(draft) };
  }
  drafts().splice(drafts().indexOf(draft), 1);
  return { status: 201, message: spec.singleton ? `Updated your ${spec.label}.` : `Added to ${spec.label}.`, section: draft.section };
}

// ---- Skills ------------------------------------------------------------------

// Whether a skill is already there, compared the way the Skills page does
export async function checkSkill(userId, rawName) {
  const name = String(rawName || "").trim().replace(/\s+/g, " ");
  const normalized = normalizeSkillName(name);
  const skills = currentStore()["/api/skills"]?.skills || [];
  const existing = skills.find((skill) => skill.normalizedName === normalized);
  const inBuffer = drafts().find((draft) => draft.section === "skills" && draft.data?.name && normalizeSkillName(draft.data.name) === normalized);
  const exact = catalog.find((item) => normalizeSkillName(item.name) === normalized);
  return {
    name,
    existing: existing ? { name: existing.name } : null,
    inBuffer: inBuffer ? { name: inBuffer.data.name } : null,
    similar: existing ? [] : findSimilar(name, skills).map((skill) => skill.name),
    canonical: exact?.name || null,
    skillType: exact?.skillType || null
  };
}

// Profile and Summary are single records: whether there is one, and what's in it
export async function getSectionRecord(userId, section) {
  const store = currentStore();
  if (section === "profile") {
    const profile = store["/api/profile"]?.profile;
    return { exists: Boolean(profile), data: profile ? { ...profile.contact, headline: profile.roleDetails?.headline || "", roleTargeting: profile.roleDetails?.roleTargeting || "", targetRoles: profile.roleDetails?.targetRoles || [] } : {} };
  }
  if (section === "summary") {
    const summary = store["/api/summary"]?.summary;
    return { exists: Boolean(summary?.content), data: summary?.content ? { content: summary.content } : {} };
  }
  return { exists: false, data: {} };
}

// ---- Resume settings -------------------------------------------------------

const settingsReply = () => (currentStore()["/api/resume-settings"] ||= { success: true, settings: resumeSettingsView(null) });

export async function getResumeSettings() {
  return resumeSettingsView(settingsReply().settings);
}

export async function updateResumeSettings(userId, changes = {}, designId = "") {
  const reply = settingsReply();
  reply.settings = resumeSettingsView(changedResumeSettings(resumeSettingsView(reply.settings), changes, designId));
  return reply.settings;
}

// ---- Custom designs --------------------------------------------------------

const designs = () => {
  const reply = (currentStore()["/api/custom-designs"] ||= { success: true, designs: [] });
  return reply.designs;
};

const designView = (design) => ({
  id: design.id,
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
  titles: design.titles || {},
  limits: design.limits || {},
  heroSummary: design.heroSummary || "",
  updatedAt: design.updatedAt
});

export async function listCustomDesigns() {
  return [...designs()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(designView);
}

export async function getCustomDesign(userId, id) {
  const design = designs().find((item) => item.id === id);
  return design ? designView(design) : null;
}

// Applies a checked plan (designPlanner.sanitizePlan output).
// Returns { action, design?, deleted? }
export async function applyDesignPlan(userId, plan) {
  const list = designs();
  if (plan.action === "delete") {
    const deleted = list.find((item) => item.id === plan.targetId);
    if (!deleted) return { action: "none" };
    list.splice(list.indexOf(deleted), 1);
    return { action: "delete", deleted: designView(deleted) };
  }
  if (!["create", "update"].includes(plan.action)) return { action: plan.action };

  let design;
  if (plan.action === "create") {
    if (list.length >= MAX_DESIGNS) throw new Error(`You can keep up to ${MAX_DESIGNS} custom designs`);
    const base = designById(plan.baseId) || designById("slate");
    const taken = new Set(list.map((item) => item.name.toLowerCase()));
    let name = plan.changes.name || `My ${base.name}`;
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${plan.changes.name || `My ${base.name}`} ${n}`;
    design = { id: newId(), baseId: base.id, name, accent: "", font: "", headingFont: "", corners: "", mode: "", hidden: [], order: [], titles: {}, limits: {}, heroSummary: "" };
    list.push(design);
  } else {
    design = list.find((item) => item.id === plan.targetId);
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
  design.titles = { ...design.titles, ...(changes.titles || {}) };
  for (const [id, count] of Object.entries(changes.limits || {})) {
    if (count === null) delete design.limits[id];
    else {
      design.limits[id] = count;
      // Limiting a section means showing it
      design.hidden = design.hidden.filter((hiddenId) => hiddenId !== id);
    }
  }
  design.updatedAt = new Date().toISOString();
  return { action: plan.action, design: designView(design) };
}

export async function deleteCustomDesign(userId, id) {
  return (await applyDesignPlan(userId, { action: "delete", targetId: id })).action === "delete";
}
