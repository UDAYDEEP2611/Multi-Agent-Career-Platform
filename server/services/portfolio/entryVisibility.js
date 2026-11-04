const mongoose = require("mongoose");

// "Show in portfolio" and "Show in resume" for any entry, used by the
// dashboard (REST) and the agents (MCP). Runs inside the user's request.

// section -> [model file, field that names the entry]
const SECTIONS = {
  experience: ["Experience", (doc) => `${doc.jobTitle || doc.title || "Role"} at ${doc.organization || doc.companyName || ""}`.trim()],
  education: ["Education", (doc) => [doc.degree, doc.institution].filter(Boolean).join(", ")],
  projects: ["Project", (doc) => doc.title],
  certifications: ["Certification", (doc) => doc.name],
  achievements: ["Achievement", (doc) => doc.title],
  volunteering: ["Volunteering", (doc) => [doc.role, doc.organization].filter(Boolean).join(" at ")],
  publications: ["Publication", (doc) => doc.title],
  patents: ["Patent", (doc) => doc.title],
  interests: ["Interest", (doc) => doc.name],
  recommendations: ["Recommendation", (doc) => [doc.firstName, doc.lastName].filter(Boolean).join(" ")],
  skills: ["UserSkill", (doc) => doc.name]
};
// Projects inside a job or school are stored in their parent
const NESTED = { experience_project: "Experience", education_project: "Education" };
const SECTION_IDS = [...Object.keys(SECTIONS), ...Object.keys(NESTED)];

const modelOf = (section) => require(`../../models/${SECTIONS[section][0]}`);
const labelOf = (section, doc) => SECTIONS[section][1](doc) || section;
const flagsOf = (doc) => ({ showInPortfolio: doc.showInPortfolio !== false, showInResume: doc.showInResume !== false });

// { showInPortfolio?, showInResume? } -> the entry's flags, or null if not found
async function setEntryVisibility(userId, section, id, changes = {}) {
  if (!SECTION_IDS.includes(section)) throw new Error(`Unknown section "${section}"`);
  if (!mongoose.isValidObjectId(id)) return null;
  const set = {};
  for (const key of ["showInPortfolio", "showInResume"]) {
    if (changes[key] === undefined) continue;
    if (typeof changes[key] !== "boolean") throw new Error(`${key} must be true or false`);
    set[key] = changes[key];
  }
  if (!Object.keys(set).length) throw new Error("Send showInPortfolio and/or showInResume");
  if (NESTED[section]) {
    const inner = Object.fromEntries(Object.entries(set).map(([key, value]) => [`projects.$.${key}`, value]));
    const parent = await require(`../../models/${NESTED[section]}`).findOneAndUpdate({ userId, "projects._id": id }, { $set: inner }, { new: true }).lean();
    const project = parent?.projects.find((item) => String(item._id) === String(id));
    return project ? { section, id: String(project._id), label: project.title, ...flagsOf(project) } : null;
  }
  const doc = await modelOf(section).findOneAndUpdate({ _id: id, userId }, { $set: set }, { new: true }).lean();
  return doc ? { section, id: String(doc._id), label: labelOf(section, doc), ...flagsOf(doc) } : null;
}

// Every entry with its flags (optionally one section), for the agents
async function listEntries(userId, section) {
  const sections = section ? [section] : SECTION_IDS;
  const lists = await Promise.all(sections.map(async (id) => {
    if (NESTED[id]) {
      const parents = await require(`../../models/${NESTED[id]}`).find({ userId }, { projects: 1 }).lean();
      return parents.flatMap((parent) => (parent.projects || []).map((project) => ({ section: id, id: String(project._id), label: project.title, ...flagsOf(project) })));
    }
    if (!SECTIONS[id]) return [];
    const docs = await modelOf(id).find({ userId }).lean();
    return docs.map((doc) => ({ section: id, id: String(doc._id), label: labelOf(id, doc), ...flagsOf(doc) }));
  }));
  return lists.flat();
}

module.exports = { setEntryVisibility, listEntries, SECTION_IDS };
