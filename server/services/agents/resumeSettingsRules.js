const { RESUME_LIMIT_DEFAULTS, RESUME_EXTRAS, RESUME_COLUMN_SECTIONS, RESUME_COLUMN_PLACES, RESUME_SKILL_STYLES } = require("../../models/resumeSettingsOptions");

// The rules for resume settings, on plain objects: reading them, one design's
// settings on top of the shared ones, and what a change makes of them. The
// server stores the result in MongoDB; the GitHub Pages demo in the browser.

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

const DESIGN_ID = /^[a-z][a-z0-9-]{0,40}$/;
const ENTRY_KEY = /^[a-z]+:[0-9a-f]{24}$/;

// The columns asked for, keeping only known sections and places
const validColumns = (columns = {}) =>
  Object.entries(columns).filter(([id, place]) => RESUME_COLUMN_SECTIONS.includes(id) && RESUME_COLUMN_PLACES.includes(place));

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
  const titles = Object.entries(rewrite.titles || {}).filter(([id, value]) => RESUME_COLUMN_SECTIONS.includes(id) && cleanText(value, 60));
  if (titles.length) next.titles = { ...(current.titles || {}), ...Object.fromEntries(titles.map(([id, value]) => [id, cleanText(value, 60)])) };
  return next;
}

const validOrder = (order) => Array.isArray(order) && order.length > 0 && order.every((id) => RESUME_COLUMN_SECTIONS.includes(id));
// Sizes that are numbers within sense; anything else is dropped
const TWEAK_LIMITS = { sideShift: [-40, 40], margin: [-100, 200], gutter: [-100, 200], text: [-100, 200], spacing: [-100, 200] };
const validTweaks = (tweaks) => Object.fromEntries(Object.entries(tweaks || {})
  .filter(([key, value]) => TWEAK_LIMITS[key] && Number.isFinite(value) && value >= TWEAK_LIMITS[key][0] && value <= TWEAK_LIMITS[key][1]));
const validSkillStyle = (style) => RESUME_SKILL_STYLES.includes(style);

// The settings after a change, from the current ones (as resumeSettingsView
// gives them). Returns new settings to store; the current ones are left as they are.
// changes: { limits: { projects: 3 | null (all) | "default" }, show: [...], hide: [...], allSkills, columns: { education: "right" }, hideFields / showFields: [...], skillStyle }
// designId: change only that resume design (its own overrides), which also
// takes hideEntries / showEntries (["projects:<id>"]), accent ("#1d4ed8" or
// "" for the design's own) and reset (drop all of that design's changes)
function changedResumeSettings(current, changes = {}, designId = "") {
  const settings = JSON.parse(JSON.stringify(current));

  if (designId) {
    if (!DESIGN_ID.test(designId)) throw new Error("Unknown resume design");
    const own = changes.reset ? {} : overrideView(settings.designs[designId] || {});
    const next = { ...own, limits: { ...(own.limits || {}) } };
    for (const [id, count] of Object.entries(changes.limits || {})) {
      if (!(id in RESUME_LIMIT_DEFAULTS)) continue;
      if (count === null) next.limits[id] = 0;
      else if (count === "default") delete next.limits[id];
      else if (Number.isInteger(count) && count >= 1 && count <= 50) next.limits[id] = count;
    }
    if (changes.show?.length || changes.hide?.length) {
      const extras = new Set(own.extras || settings.extras);
      for (const id of changes.show || []) if (RESUME_EXTRAS.includes(id)) extras.add(id);
      for (const id of changes.hide || []) extras.delete(id);
      next.extras = [...extras];
    }
    if (typeof changes.allSkills === "boolean") next.allSkills = changes.allSkills;
    const columns = validColumns(changes.columns);
    if (columns.length) next.columns = { ...(own.columns || {}), ...Object.fromEntries(columns) };
    if (changes.hideFields?.length || changes.showFields?.length) next.hiddenFields = changedFields(own.hiddenFields || settings.hiddenFields || [], changes);
    if (validSkillStyle(changes.skillStyle)) next.skillStyle = changes.skillStyle;
    if (Object.keys(validTweaks(changes.tweaks)).length) next.tweaks = { ...(own.tweaks || {}), ...validTweaks(changes.tweaks) };
    if (validOrder(changes.order)) next.order = changes.order;
    if (changes.rewrite) {
      const rewrites = changedRewrites(own.rewrites, changes.rewrite);
      if (rewrites) next.rewrites = rewrites;
      else delete next.rewrites;
    }
    const hidden = new Set(own.hiddenEntries || []);
    for (const key of changes.hideEntries || []) if (ENTRY_KEY.test(key)) hidden.add(key);
    for (const key of changes.showEntries || []) hidden.delete(key);
    next.hiddenEntries = [...hidden].slice(0, 200);
    if (typeof changes.accent === "string" && /^(#[0-9a-fA-F]{6})?$/.test(changes.accent)) next.accent = changes.accent;
    if (!Object.keys(next.limits).length) delete next.limits;
    settings.designs[designId] = next;
    return settings;
  }

  const overrides = Object.values(settings.designs);
  for (const [id, count] of Object.entries(changes.limits || {})) {
    if (!(id in RESUME_LIMIT_DEFAULTS)) continue;
    if (count === null) settings.limits[id] = 0;
    else if (count === "default") settings.limits[id] = RESUME_LIMIT_DEFAULTS[id];
    else if (Number.isInteger(count) && count >= 1 && count <= 50) settings.limits[id] = count;
  }
  const extras = new Set(settings.extras);
  for (const id of changes.show || []) if (RESUME_EXTRAS.includes(id)) extras.add(id);
  for (const id of changes.hide || []) extras.delete(id);
  settings.extras = [...extras];
  if (typeof changes.allSkills === "boolean") settings.allSkills = changes.allSkills;
  // Every resume means every resume: a design's own choice for that section gives way
  for (const [id, place] of validColumns(changes.columns)) {
    settings.columns[id] = place;
    for (const override of overrides) delete override.columns?.[id];
  }
  if (changes.hideFields?.length || changes.showFields?.length) {
    settings.hiddenFields = changedFields(settings.hiddenFields, changes);
    for (const override of overrides) if (override.hiddenFields) override.hiddenFields = changedFields(override.hiddenFields, changes);
  }
  if (changes.rewrite) {
    settings.rewrites = changedRewrites(settings.rewrites, changes.rewrite) || {};
    if (changes.rewrite.clear) for (const override of overrides) delete override.rewrites;
  }
  if (validOrder(changes.order)) {
    settings.order = changes.order;
    for (const override of overrides) delete override.order;
  }
  if (validSkillStyle(changes.skillStyle)) {
    settings.skillStyle = changes.skillStyle;
    for (const override of overrides) delete override.skillStyle;
  }
  const tweaks = validTweaks(changes.tweaks);
  if (Object.keys(tweaks).length) {
    settings.tweaks = { ...settings.tweaks, ...tweaks };
    for (const override of overrides) {
      if (override.tweaks) override.tweaks = Object.fromEntries(Object.entries(override.tweaks).filter(([key]) => !(key in tweaks)));
    }
  }
  return settings;
}

module.exports = { resumeSettingsView, effectiveResumeSettings, changedResumeSettings };
