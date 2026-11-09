import { locate } from "../../demoStore";
import { currentStore } from "../current";

// "Show in portfolio" and "Show in resume" for any entry, on the demo data.
// The same sections, names and replies as the server's entryVisibility.js.

// section -> [list in the demo data, what names the entry]
const SECTIONS = {
  experience: ["experiences", (doc) => `${doc.jobTitle || doc.title || "Role"} at ${doc.organization || doc.companyName || ""}`.trim()],
  education: ["educations", (doc) => [doc.degree, doc.institution].filter(Boolean).join(", ")],
  projects: ["projects", (doc) => doc.title],
  certifications: ["certifications", (doc) => doc.name],
  achievements: ["achievements", (doc) => doc.title],
  volunteering: ["volunteering", (doc) => [doc.role, doc.organization].filter(Boolean).join(" at ")],
  publications: ["publications", (doc) => doc.title],
  patents: ["patents", (doc) => doc.title],
  interests: ["interests", (doc) => doc.name],
  recommendations: ["recommendations", (doc) => [doc.firstName, doc.lastName].filter(Boolean).join(" ")],
  skills: ["skills", (doc) => doc.name]
};
// Projects inside a job or school are kept in their parent
const NESTED = { experience_project: "experiences", education_project: "educations" };
export const SECTION_IDS = [...Object.keys(SECTIONS), ...Object.keys(NESTED)];

const listOf = (name) => currentStore()[`/api/${name}`]?.[name] || [];
const labelOf = (section, doc) => SECTIONS[section][1](doc) || section;
const flagsOf = (doc) => ({ showInPortfolio: doc.showInPortfolio !== false, showInResume: doc.showInResume !== false });

// { showInPortfolio?, showInResume? } -> the entry's flags, or null if not found
export async function setEntryVisibility(userId, section, id, changes = {}) {
  if (!SECTION_IDS.includes(section)) throw new Error(`Unknown section "${section}"`);
  const set = {};
  for (const key of ["showInPortfolio", "showInResume"]) {
    if (changes[key] === undefined) continue;
    if (typeof changes[key] !== "boolean") throw new Error(`${key} must be true or false`);
    set[key] = changes[key];
  }
  if (!Object.keys(set).length) throw new Error("Send showInPortfolio and/or showInResume");
  if (NESTED[section]) {
    const project = listOf(NESTED[section]).flatMap((parent) => parent.projects || []).find((item) => item._id === id);
    if (!project) return null;
    Object.assign(project, set);
    return { section, id: project._id, label: project.title, ...flagsOf(project) };
  }
  const doc = locate(currentStore(), `/api/${SECTIONS[section][0]}/${id}`)?.entry;
  if (!doc) return null;
  Object.assign(doc, set);
  return { section, id: doc._id, label: labelOf(section, doc), ...flagsOf(doc) };
}

// Every entry with its flags (optionally one section), for the agents
export async function listEntries(userId, section) {
  const sections = section ? [section] : SECTION_IDS;
  return sections.flatMap((id) => {
    if (NESTED[id]) return listOf(NESTED[id]).flatMap((parent) => (parent.projects || []).map((project) => ({ section: id, id: project._id, label: project.title, ...flagsOf(project) })));
    if (!SECTIONS[id]) return [];
    return listOf(SECTIONS[id][0]).map((doc) => ({ section: id, id: doc._id, label: labelOf(id, doc), ...flagsOf(doc) }));
  });
}
