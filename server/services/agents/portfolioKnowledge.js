const crypto = require("node:crypto");
const { Document } = require("@langchain/core/documents");

// What the agents know about a user's portfolio, in two forms:
//
// RAG: the portfolio cut into small documents (one per job, school,
// project…), found by hybrid search: BM25 keyword ranking, plus vector
// similarity when an Ollama embedding model is installed
// (OLLAMA_EMBED_MODEL, default nomic-embed-text), merged by reciprocal rank
// fusion.
//
// GraphRAG: the same portfolio as a knowledge graph. Nodes are the person,
// jobs, organizations, schools, degrees, projects, skills, certifications…;
// edges say how they connect (WORKED_AT, USED_SKILL, STUDIED_AT…). A
// question is answered from the neighbourhood of the entities it mentions,
// so "Which projects used LangGraph?" follows LangGraph's edges instead of
// hoping the right text chunk ranks first. The data entry agent also uses
// the graph to spot entries the user already has.

const dateText = (date) => (date ? [date.month ? String(date.month).padStart(2, "0") : "", date.year].filter(Boolean).join("/") : "");
const range = (item) => [dateText(item.start), item.current ? "present" : dateText(item.end)].filter(Boolean).join(" – ");
const norm = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();

// ---- Documents -------------------------------------------------------------

function documentsOf(source) {
  const docs = [];
  const add = (id, section, title, lines, link) => docs.push(new Document({
    pageContent: [title, ...lines].filter(Boolean).join("\n"),
    metadata: { id, section, title, link }
  }));

  if (source.summary) add("summary", "about", "About me", [source.summary], "/dashboard/summary");
  for (const job of source.experiences || []) {
    add(`experience:${job.id}`, "experience", `${job.title} at ${job.organization}`, [
      range(job), job.location, job.summary, ...job.bullets, job.skills.length ? `Skills: ${job.skills.join(", ")}` : "",
      ...(job.projects || []).map((project) => `Project: ${project.title}. ${project.description}`)
    ], "/dashboard/experience");
  }
  for (const school of source.educations || []) {
    add(`education:${school.id}`, "education", [school.degree, school.fieldOfStudy && `in ${school.fieldOfStudy}`, `at ${school.institution}`].filter(Boolean).join(" "), [
      range(school), school.grade && `Grade: ${school.grade}`, school.description, ...school.bullets,
      school.courses.length ? `Courses: ${school.courses.join(", ")}` : ""
    ], "/dashboard/education");
  }
  for (const project of source.projects || []) {
    add(`project:${project.id}`, "projects", project.title, [
      project.source, range(project), project.description, ...project.bullets,
      project.skills.length ? `Skills: ${project.skills.join(", ")}` : ""
    ], "/dashboard/projects");
  }
  if (source.skills?.length) {
    const key = source.skills.filter((skill) => skill.isImportant).map((skill) => skill.name);
    add("skills", "skills", "Skills", [
      key.length ? `Key skills: ${key.join(", ")}` : "",
      `All skills: ${source.skills.map((skill) => skill.name).join(", ")}`
    ], "/dashboard/skills");
  }
  const extras = [
    ["certifications", "Certification"], ["achievements", "Achievement"], ["volunteering", "Volunteering"],
    ["publications", "Publication"], ["patents", "Patent"], ["interests", "Interest"]
  ];
  for (const [key, label] of extras) {
    for (const item of source[key] || []) {
      add(`${key}:${item.id}`, key, `${label}: ${item.title}`, [item.subtitle, dateText(item.date) || range(item), item.description, item.detail], `/dashboard/${key}`);
    }
  }
  return docs;
}

// ---- BM25 ------------------------------------------------------------------

const STOP = new Set("a an and are as at be by did do does for from has have how i in is it my of on or that the this to was what when where which who with you your me".split(" "));
const tokens = (text) => norm(text).split(" ").filter((word) => word && !STOP.has(word));

function bm25Index(docs) {
  const docTokens = docs.map((doc) => tokens(doc.pageContent));
  const avg = docTokens.reduce((sum, list) => sum + list.length, 0) / Math.max(1, docTokens.length);
  const df = new Map();
  for (const list of docTokens) for (const word of new Set(list)) df.set(word, (df.get(word) || 0) + 1);

  return (query, k = 5) => {
    const terms = tokens(query);
    const scored = docTokens.map((list, index) => {
      let score = 0;
      for (const term of terms) {
        const tf = list.filter((word) => word === term).length;
        if (!tf) continue;
        const idf = Math.log(1 + (docs.length - df.get(term) + 0.5) / (df.get(term) + 0.5));
        score += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (list.length / avg))));
      }
      return { index, score };
    });
    return scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, k).map((item) => item.index);
  };
}

// ---- Embeddings (optional) -------------------------------------------------

const embedModel = () => process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const baseUrl = () => (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

// OLLAMA_EMBED_MODEL=off: keyword search only, without asking Ollama
async function embeddingsAvailable() {
  if (embedModel() === "off") return false;
  try {
    const response = await fetch(`${baseUrl()}/api/tags`, { signal: AbortSignal.timeout(1500) });
    const { models = [] } = await response.json();
    return models.some((entry) => entry.name === embedModel() || entry.name === `${embedModel()}:latest`);
  } catch {
    return false;
  }
}

async function makeEmbedder() {
  if (!(await embeddingsAvailable())) return null;
  const { OllamaEmbeddings } = require("@langchain/ollama");
  return new OllamaEmbeddings({ model: embedModel(), baseUrl: baseUrl() });
}

const cosine = (a, b) => {
  let dot = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    left += a[i] * a[i];
    right += b[i] * b[i];
  }
  return dot / (Math.sqrt(left * right) || 1);
};

// ---- Knowledge graph -------------------------------------------------------

function graphOf(source) {
  const nodes = new Map();
  const edges = [];
  const node = (type, label, extra = {}) => {
    const id = `${type}:${norm(label)}`;
    if (!nodes.has(id)) nodes.set(id, { id, type, label, ...extra });
    return id;
  };
  const link = (from, rel, to) => edges.push({ from, rel, to });
  const me = node("person", source.contact?.name || "Me");

  for (const job of source.experiences || []) {
    const role = node("job", `${job.title} at ${job.organization}`, { section: "experience", recordId: job.id, title: job.title, organization: job.organization, when: range(job) });
    link(me, "HELD", role);
    link(role, "AT", node("organization", job.organization));
    link(role, "TITLE", node("title", job.title));
    for (const skill of job.skills) link(role, "USED_SKILL", node("skill", skill));
    for (const project of job.projects || []) link(role, "INCLUDED_PROJECT", node("project", project.title));
  }
  for (const school of source.educations || []) {
    const study = node("education", `${school.degree} at ${school.institution}`, { section: "education", recordId: school.id, institution: school.institution, degree: school.degree, when: range(school) });
    link(me, "STUDIED", study);
    link(study, "AT", node("school", school.institution));
    if (school.degree) link(study, "DEGREE", node("degree", school.degree));
    if (school.fieldOfStudy) link(study, "FIELD", node("field", school.fieldOfStudy));
    for (const course of school.courses) link(study, "TOOK_COURSE", node("course", course));
  }
  for (const project of source.projects || []) {
    const id = node("project", project.title, { section: "projects", recordId: project.id, when: range(project) });
    link(me, "BUILT", id);
    for (const skill of project.skills) link(id, "USED_SKILL", node("skill", skill));
  }
  for (const skill of source.skills || []) link(me, skill.isImportant ? "KEY_SKILL" : "HAS_SKILL", node("skill", skill.name));
  for (const item of source.certifications || []) {
    const id = node("certification", item.title, { section: "certifications", recordId: item.id });
    link(me, "CERTIFIED", id);
    if (item.subtitle) link(id, "ISSUED_BY", node("organization", item.subtitle));
  }
  for (const [key, type, rel] of [["achievements", "achievement", "ACHIEVED"], ["volunteering", "volunteering", "VOLUNTEERED"],
    ["publications", "publication", "PUBLISHED"], ["patents", "patent", "INVENTED"], ["interests", "interest", "INTERESTED_IN"]]) {
    for (const item of source[key] || []) link(me, rel, node(type, item.title, { section: key, recordId: item.id }));
  }
  return { nodes, edges };
}

// Nodes the question names (whole-label match), then everything within two
// hops of them, as readable facts
function graphFacts({ nodes, edges }, question, limit = 30) {
  const text = ` ${norm(question)} `;
  const seeds = [...nodes.values()].filter((item) => item.type !== "person" && norm(item.label).length > 1 && text.includes(` ${norm(item.label)} `));
  if (!seeds.length) return { seeds: [], facts: [] };

  const near = new Set(seeds.map((item) => item.id));
  for (let hop = 0; hop < 2; hop += 1) {
    for (const edge of edges) {
      if (near.has(edge.from) && nodes.get(edge.from).type !== "person") near.add(edge.to);
      if (near.has(edge.to)) near.add(edge.from);
    }
  }
  const facts = edges
    .filter((edge) => near.has(edge.from) && near.has(edge.to))
    .map((edge) => `${nodes.get(edge.from).label} —${edge.rel}→ ${nodes.get(edge.to).label}`);
  return { seeds: seeds.map((item) => item.label), facts: [...new Set(facts)].slice(0, limit) };
}

// An existing record that looks like the same entry, or null
function findExisting({ nodes }, section, data) {
  if (section === "skills" && data.name) {
    const skill = nodes.get(`skill:${norm(data.name)}`);
    return skill ? { ...skill, label: skill.label, section: "skills" } : null;
  }
  if (section === "profile" || section === "summary") return null;
  // "M.S." and "MS" are the same degree
  const flat = (text) => norm(text).replace(/[^a-z0-9+#]/g, "");
  const same = (a, b) => a && b && (flat(a) === flat(b) || flat(a).includes(flat(b)) || flat(b).includes(flat(a)));
  for (const item of nodes.values()) {
    if (item.section !== section) continue;
    if (section === "education" && same(item.institution, data.institution) && (!data.degree || same(item.degree, data.degree))) return item;
    if (section === "experience" && same(item.organization, data.organization) && (!data.jobTitle || same(item.title, data.jobTitle))) return item;
    const key = data.title || data.name;
    if (!["education", "experience"].includes(section) && key && same(item.label, key)) return item;
  }
  return null;
}

// ---- The index -------------------------------------------------------------

const SECTION_HINTS = {
  education: /\b(stud(?:y|ied|ying)|school|college|universit\w*|degree|graduat\w*|gpa|major)\b/i,
  experience: /\b(work(?:ed|ing)?|jobs?|compan\w*|employ\w*|role|career|positions?)\b/i,
  projects: /\b(projects?|built|build|made)\b/i,
  skills: /\b(skills?|technolog\w*|tools?|languages?|stack)\b/i,
  certifications: /\b(certif\w*|credentials?)\b/i,
  about: /\b(summary|about me|who am i|bio)\b/i
};

const cache = new Map(); // userId -> { key, index }

async function buildIndex(source) {
  const docs = documentsOf(source);
  const graph = graphOf(source);
  const bm25 = bm25Index(docs);
  let vectors = null;
  let embedder = null;

  try {
    embedder = docs.length ? await makeEmbedder() : null;
    if (embedder) vectors = await embedder.embedDocuments(docs.map((doc) => doc.pageContent));
  } catch {
    embedder = null;
    vectors = null;
  }

  // Hybrid search: BM25 and vector ranks merged by reciprocal rank fusion,
  // plus the documents of any section the question is about ("Where did I
  // study?" is about education even though no document says "study")
  async function search(query, k = 5) {
    const rankings = [bm25(query, 10)];
    const hinted = Object.entries(SECTION_HINTS).filter(([, pattern]) => pattern.test(query)).map(([section]) => section);
    if (hinted.length) rankings.push(docs.map((doc, index) => (hinted.includes(doc.metadata.section) ? index : -1)).filter((index) => index >= 0));
    if (embedder && vectors) {
      try {
        const queryVector = await embedder.embedQuery(query);
        rankings.push(vectors.map((vector, index) => ({ index, score: cosine(queryVector, vector) }))
          .sort((a, b) => b.score - a.score).slice(0, 10).map((item) => item.index));
      } catch {
        // keyword ranking alone
      }
    }
    const fused = new Map();
    for (const ranking of rankings) ranking.forEach((index, rank) => fused.set(index, (fused.get(index) || 0) + 1 / (60 + rank)));
    return [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([index]) => docs[index]);
  }

  return { docs, graph, search, mode: vectors ? "hybrid (BM25 + embeddings)" : "keyword (BM25)" };
}

// The user's index, rebuilt only when their portfolio changes
async function knowledgeFor(userId, source) {
  const key = crypto.createHash("sha1").update(JSON.stringify(source)).digest("hex");
  const hit = cache.get(String(userId));
  if (hit?.key === key) return hit.index;
  const index = await buildIndex(source);
  cache.set(String(userId), { key, index });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return index;
}

module.exports = { knowledgeFor, buildIndex, documentsOf, graphOf, graphFacts, findExisting, bm25Index, makeEmbedder };
