const catalog = require("../scripts/skillCatalogData");
const { knowledgeFor, graphFacts, findExisting } = require("../services/agents/portfolioKnowledge");
const { schemaSummary, specOf, coerceAll } = require("../services/agents/sectionSpecs");
const { sanitizePlan } = require("../services/agents/designPlanner");
const { designById } = require("../services/agents/designCatalog");
const { resumeSettingsView, changedResumeSettings } = require("../services/agents/resumeSettingsRules");
const { findSimilar } = require("../utils/skillSimilarity");

// The portfolio MCP tools, in memory, over one made-up portfolio. The agents
// call them as they would the real ones; every change is recorded, so an
// evaluation case can check what the agent did, not how it worded it.

const hex = (n) => n.toString(16).padStart(24, "0");
let next = 1;
const id = () => hex(next++);

// Alex Morgan: two engineering jobs and an internship, two Computer Science
// degrees, so some requests name more than one entry
function portfolio() {
  next = 1;
  return {
    contact: { name: "Alex Morgan", email: "alex@example.com", phone: "555-0100", location: "Denton, TX", linkedin: "linkedin.com/in/alexmorgan", github: "github.com/alexmorgan", portfolio: "" },
    summary: "AI Engineer with 5 years building LLM agents, RAG pipelines and ML platforms in Python.",
    experiences: [
      { id: id(), title: "AI Engineer", organization: "Oracle", employmentType: "Full-time", location: "Austin, TX", start: { month: 1, year: 2024 }, end: null, current: true, summary: "Agent platform team.", bullets: ["Built LangGraph agents that answer from internal docs with RAG", "Cut inference cost by 27% with request batching"], skills: ["LangGraph", "Python", "OCI"], projects: [{ id: id(), title: "Knowledge Assistant", description: "RAG assistant over 40k internal documents", tasks: [] }] },
      { id: id(), title: "Software Engineer", organization: "PayPal", employmentType: "Full-time", location: "San Jose, CA", start: { month: 1, year: 2021 }, end: { month: 12, year: 2023 }, current: false, summary: "", bullets: ["Built fraud detection models with XGBoost and PySpark", "Added RBAC and audit logging to model APIs"], skills: ["Python", "PySpark", "XGBoost"], projects: [] },
      { id: id(), title: "Machine Learning Intern", organization: "Acme Labs", employmentType: "Internship", location: "Dallas, TX", start: { month: 6, year: 2020 }, end: { month: 12, year: 2020 }, current: false, summary: "", bullets: ["Wrote data cleaning scripts in Python"], skills: ["Python"], projects: [] }
    ],
    educations: [
      { id: id(), institution: "University of North Texas", degree: "Master of Science", fieldOfStudy: "Computer Science", location: "Denton, TX", start: { month: 8, year: 2021 }, end: { month: 5, year: 2023 }, current: false, grade: "3.9", description: "", bullets: [], courses: ["Machine Learning", "Distributed Systems"] },
      { id: id(), institution: "JNTU Hyderabad", degree: "B.Tech", fieldOfStudy: "Computer Science", location: "Hyderabad", start: { month: 7, year: 2015 }, end: { month: 5, year: 2019 }, current: false, grade: "8.1", description: "", bullets: [], courses: [] }
    ],
    projects: [
      { id: id(), title: "Blood Bank Management System", role: "Developer", source: "Academic project", start: { month: 1, year: 2019 }, end: { month: 5, year: 2019 }, current: false, description: "Web app that matches blood donors with hospitals, built with Java and MySQL.", bullets: ["Matched donors by blood group and distance"], skills: [], link: "" },
      { id: id(), title: "UltraUnityVerse", role: "Creator", source: "Personal project", start: { month: 3, year: 2025 }, end: null, current: true, description: "Agentic portfolio platform built with LangGraph, MCP and A2A.", bullets: ["Supervisor routes chat to data entry, design and Q&A agents"], skills: [], link: "github.com/alexmorgan/uuv" },
      { id: id(), title: "Grade Predictor", role: "Developer", source: "Academic project", start: { month: 9, year: 2022 }, end: { month: 12, year: 2022 }, current: false, description: "Predicts student grades with PyTorch.", bullets: [], skills: [], link: "" },
      { id: id(), title: "Fraud Lens", role: "Developer", source: "Personal project", start: { month: 6, year: 2023 }, end: { month: 8, year: 2023 }, current: false, description: "Dashboard that explains XGBoost fraud scores with SHAP.", bullets: [], skills: [], link: "" }
    ],
    skills: ["Python", "LangGraph", "Docker", "React", "PyTorch", "SQL"].map((name, index) => ({ id: id(), name, skillType: "technical", rating: 5 - (index % 3), isImportant: index < 3 })),
    certifications: [
      { id: id(), title: "AWS Solutions Architect", subtitle: "Amazon Web Services", date: { month: 4, year: 2024 }, detail: "" },
      { id: id(), title: "Google Cloud Professional Machine Learning Engineer", subtitle: "Google Cloud", date: { month: 9, year: 2023 }, detail: "" }
    ],
    achievements: [{ id: id(), title: "Best Paper Award", subtitle: "NeurIPS Workshop", date: { month: 12, year: 2023 }, description: "For work on agents that explain themselves" }],
    volunteering: [{ id: id(), title: "Mentor", subtitle: "Code for Good", cause: "Education", start: { month: 1, year: 2022 }, end: null, current: true, description: "Mentor students learning Python" }],
    publications: [{ id: id(), title: "Agents that Explain Themselves", subtitle: "NeurIPS Workshop", date: { month: 12, year: 2023 }, detail: "" }],
    patents: [],
    interests: [{ id: id(), title: "Chess", subtitle: "" }, { id: id(), title: "Hiking", subtitle: "" }],
    recommendations: [{ id: id(), name: "Jane Smith", title: "Engineering Manager", organization: "Oracle" }]
  };
}

// What list_entries calls each entry, as services/portfolio/entryVisibility.js does
function entriesOf(data) {
  return [
    ...data.experiences.map((item) => ({ section: "experience", id: item.id, label: `${item.title} at ${item.organization}` })),
    ...data.experiences.flatMap((item) => item.projects.map((project) => ({ section: "experience_project", id: project.id, label: project.title }))),
    ...data.educations.map((item) => ({ section: "education", id: item.id, label: [item.degree, item.institution].join(", ") })),
    ...data.projects.map((item) => ({ section: "projects", id: item.id, label: item.title })),
    ...data.certifications.map((item) => ({ section: "certifications", id: item.id, label: item.title })),
    ...data.achievements.map((item) => ({ section: "achievements", id: item.id, label: item.title })),
    ...data.volunteering.map((item) => ({ section: "volunteering", id: item.id, label: `${item.title} at ${item.subtitle}` })),
    ...data.publications.map((item) => ({ section: "publications", id: item.id, label: item.title })),
    ...data.interests.map((item) => ({ section: "interests", id: item.id, label: item.title })),
    ...data.recommendations.map((item) => ({ section: "recommendations", id: item.id, label: item.name })),
    ...data.skills.map((item) => ({ section: "skills", id: item.id, label: item.name }))
  ].map((entry) => ({ ...entry, showInPortfolio: true, showInResume: true }));
}

const normalize = (name) => String(name || "").trim().replace(/\s+/g, " ").toLowerCase();

// A fresh portfolio and its tools: { tools, state }. state.changes lists every
// change in order: { tool, args }
function memoryTools() {
  const data = portfolio();
  const state = { data, entries: entriesOf(data), settings: resumeSettingsView(null), drafts: [], designs: [], changes: [] };
  const record = (tool, args) => state.changes.push({ tool, args: JSON.parse(JSON.stringify(args)) });
  // The portfolio as the agents read it, leaving out what's switched off
  const shown = (audience) => {
    const key = audience === "resume" ? "showInResume" : "showInPortfolio";
    const off = new Set(state.entries.filter((entry) => !entry[key]).map((entry) => entry.id));
    const keep = (list) => list.filter((item) => !off.has(item.id));
    return { ...data, experiences: keep(data.experiences), educations: keep(data.educations), projects: keep(data.projects), skills: keep(data.skills), certifications: keep(data.certifications) };
  };
  const index = () => knowledgeFor("eval", shown());

  const handlers = {
    list_entries: ({ section } = {}) => ({ entries: state.entries.filter((entry) => !section || entry.section === section) }),
    set_entry_visibility: ({ section, id: entryId, ...flags }) => {
      const entry = state.entries.find((item) => item.section === section && item.id === entryId);
      if (!entry) throw new Error("Entry not found");
      Object.assign(entry, flags);
      record("set_entry_visibility", { section, id: entryId, ...flags });
      return { entry };
    },
    get_resume_settings: () => state.settings,
    update_resume_settings: ({ designId = "", ...changes }) => {
      state.settings = resumeSettingsView(changedResumeSettings(state.settings, changes, designId));
      record("update_resume_settings", { designId, ...changes });
      return state.settings;
    },
    get_resume_text: () => shown("resume"),
    get_portfolio: () => shown(),
    search_portfolio: async ({ query, k = 5 }) => {
      const knowledge = await index();
      const results = await knowledge.search(query, k);
      return { mode: knowledge.mode, results: results.map((doc) => ({ ...doc.metadata, text: doc.pageContent })), graph: graphFacts(knowledge.graph, query) };
    },
    find_existing_entry: async ({ section, data: entry }) => {
      const match = findExisting((await index()).graph, section, entry);
      return { match: match ? { label: match.label, when: match.when || "", section: match.section } : null };
    },
    list_section_schemas: ({ sections } = {}) => ({ sections: schemaSummary(sections?.filter((section) => specOf(section))) }),
    check_skill: ({ name }) => {
      const normalized = normalize(name);
      const existing = data.skills.find((skill) => normalize(skill.name) === normalized);
      const inBuffer = state.drafts.find((draft) => draft.section === "skills" && normalize(draft.data.name) === normalized);
      const exact = catalog.find((item) => normalize(item.name) === normalized);
      return {
        name,
        existing: existing ? { name: existing.name } : null,
        inBuffer: inBuffer ? { name: inBuffer.data.name } : null,
        similar: existing ? [] : findSimilar(name, data.skills.map((skill) => ({ name: skill.name, normalizedName: normalize(skill.name) }))).map((skill) => skill.name),
        canonical: exact?.name || null,
        skillType: exact?.skillType || null
      };
    },
    get_section_record: ({ section }) => (section === "summary"
      ? { exists: true, data: { content: data.summary } }
      : { exists: true, data: { firstName: "Alex", lastName: "Morgan", email: data.contact.email, headline: "AI Engineer", roleTargeting: "", targetRoles: [] } }),
    add_to_buffer: ({ section, data: entry, notes = [] }) => {
      const spec = specOf(section);
      const coerced = coerceAll(spec, entry);
      const draft = { id: hex(9000 + state.drafts.length), section, sectionLabel: spec.label, route: spec.route, summary: spec.describe(coerced) || spec.singular, data: coerced, notes };
      state.drafts.push(draft);
      record("add_to_buffer", draft);
      return { draft };
    },
    list_buffer: ({ section } = {}) => ({ drafts: state.drafts.filter((draft) => !section || draft.section === section) }),
    list_custom_designs: () => ({ designs: state.designs }),
    apply_design_plan: ({ plan }) => {
      const checked = sanitizePlan(plan, state.designs, plan.targetId || "");
      record("apply_design_plan", checked);
      if (checked.action === "create") {
        const design = { id: hex(8000 + state.designs.length), name: checked.changes.name || `My ${checked.baseId}`, baseId: checked.baseId, baseName: designById(checked.baseId)?.name || checked.baseId, ...checked.changes };
        state.designs.push(design);
        return { action: "create", design, notes: checked.notes };
      }
      if (checked.action === "update") {
        const design = state.designs.find((item) => item.id === checked.targetId);
        if (design) Object.assign(design, checked.changes);
        return { action: design ? "update" : "none", design, notes: checked.notes };
      }
      if (checked.action === "delete") {
        const design = state.designs.find((item) => item.id === checked.targetId);
        state.designs = state.designs.filter((item) => item !== design);
        return { action: design ? "delete" : "none", deleted: design, notes: checked.notes };
      }
      return { action: checked.action, notes: checked.notes };
    }
  };

  const tools = {
    async call(name, args = {}) {
      if (!handlers[name]) throw new Error(`No tool ${name}`);
      return handlers[name](args);
    },
    tools: async () => Object.keys(handlers),
    close: async () => {}
  };
  return { tools, state };
}

module.exports = { memoryTools };
