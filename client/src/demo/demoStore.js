// The demo's data: the recorded replies, plus this visitor's edits, kept in
// their browser. Writes change the entries here, and the combined views (the
// portfolio, the resume sources, the overview) are rebuilt from them.
const VERSION = 2;
const storageKey = (account) => `uuv-demo-data-${VERSION}-${account}`;
const stores = new Map();

export async function storeFor(account) {
  if (stores.has(account)) return stores.get(account);

  // Written out so normal builds leave the sample data out altogether
  const { default: data } = import.meta.env.VITE_STATIC_SITE === "true" ? await import("./demoData.json") : { default: {} };
  let store = structuredClone(data[account] || {});
  try {
    store = JSON.parse(localStorage.getItem(storageKey(account))) || store;
  } catch {
    // No saved edits to read
  }
  stores.set(account, store);
  return store;
}

export function saveStore(account) {
  try {
    localStorage.setItem(storageKey(account), JSON.stringify(stores.get(account)));
  } catch {
    // Without storage the edits last until the page reloads
  }
}

export function resetStore(account) {
  stores.delete(account);
  try {
    localStorage.removeItem(storageKey(account));
  } catch {
    // Nothing was stored
  }
}

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, "0")).join("");
const idOf = (entry) => String(entry._id ?? entry.id);
const singular = (name) => ({ experiences: "experience", educations: "education", skills: "skill", volunteering: "volunteering", media: "media", patents: "patent" })[name] || name.replace(/s$/, "");
const isId = (text) => /^[a-f0-9]{24}$/i.test(text);

// /api/experiences/1/projects/2/tasks -> the list and entry those name
export function locate(store, path) {
  const [section, ...rest] = path.split("/").slice(2);
  const top = store[`/api/${section}`];
  if (!Array.isArray(top?.[section])) return null;

  let list = top[section];
  let listName = section;
  let parent = null;
  let entry = null;
  for (const part of rest) {
    if (isId(part)) {
      entry = list.find((item) => idOf(item) === part);
      if (!entry) return null;
    } else {
      if (!entry) return null;
      parent = entry;
      entry[part] ||= [];
      list = entry[part];
      listName = part;
      entry = null;
    }
  }
  return { list, listName, entry, parent };
}

// Copies the shape of a sibling, with its lists empty, so detail pages open
function newEntry(list, body) {
  const now = new Date().toISOString();
  const lists = Object.fromEntries(Object.entries(list[0] || {}).filter(([, value]) => Array.isArray(value)).map(([key]) => [key, []]));
  return { ...lists, _id: newId(), showInPortfolio: true, showInResume: true, createdAt: now, updatedAt: now, ...body };
}

const tallySkills = (store) => {
  const reply = store["/api/skills"];
  reply.total = reply.skills.length;
  reply.importantCount = reply.skills.filter((skill) => skill.isImportant).length;
};

// A write to a list or an entry. Returns the reply, or null if it isn't one.
export function writeEntry(store, method, path, body) {
  const found = locate(store, path);
  if (!found) return null;
  const { list, listName, entry } = found;
  const name = singular(listName);
  const answer = (item) => ({ success: true, [name]: item, item, entry: item, [listName]: list });
  const extra = path.startsWith("/api/skills") || listName === "interests"
    ? { normalizedName: String(body?.name ?? entry?.name ?? "").trim().toLowerCase() }
    : {};
  let result = null;

  if (method === "post" && !entry) {
    const item = newEntry(list, { ...body, ...extra, ...(listName === "skills" ? { sortOrder: Date.now() } : {}) });
    list.push(item);
    result = answer(item);
  } else if (method === "patch" || method === "put") {
    if (entry) {
      Object.assign(entry, body, extra, { updatedAt: new Date().toISOString() });
      result = answer(entry);
    }
  } else if (method === "delete" && entry) {
    list.splice(list.indexOf(entry), 1);
    result = { success: true, message: "Deleted" };
  }

  if (result && store["/api/skills"]) tallySkills(store);
  return result;
}

// The profile, the summary and the other single records
export function writeRecord(store, method, path, body) {
  const now = new Date().toISOString();

  if (path === "/api/profile" || path.startsWith("/api/profile/")) {
    const reply = store["/api/profile"];
    if (method === "delete") reply.profile = { ...reply.profile, contact: {}, personal: {}, roleDetails: {} };
    else if (path === "/api/profile") reply.profile.contact = { ...reply.profile.contact, ...body?.contact };
    else {
      const part = { contact: "contact", personal: "personal", roles: "roleDetails" }[path.split("/")[3]];
      if (!part) return null;
      reply.profile[part] = { ...reply.profile[part], ...body };
    }
    return { success: true, profile: reply.profile };
  }

  if (path === "/api/summary" || path.startsWith("/api/summary/history/")) {
    const summary = store["/api/summary"].summary;
    const keep = () => summary.content && summary.history.unshift({ _id: newId(), content: summary.content, origin: summary.origin, createdAt: summary.updatedAt });
    const historyId = path.split("/")[4];
    if (historyId) {
      const version = summary.history.find((item) => item._id === historyId);
      if (!version) return null;
      summary.history = summary.history.filter((item) => item !== version);
      if (method === "post") {
        keep();
        summary.content = version.content;
      }
    } else if (method === "delete") {
      keep();
      summary.content = "";
    } else {
      keep();
      summary.content = body?.content ?? "";
      summary.origin = body?.origin ?? "manual";
    }
    summary.updatedAt = now;
    return { success: true, summary };
  }

  if (path === "/api/skills/order" && method === "put") {
    const skills = store["/api/skills"].skills;
    (body?.skillIds || []).forEach((id, index) => {
      const skill = skills.find((item) => item._id === id);
      if (skill) skill.sortOrder = index + 1;
    });
    skills.sort((a, b) => a.sortOrder - b.sortOrder);
    return { success: true, skills };
  }

  if (path.startsWith("/api/visibility/")) {
    const [, , , section, id] = path.split("/");
    const list = { experience: "experiences", education: "educations" }[section] || section;
    const found = locate(store, `/api/${list}/${id}`);
    if (!found?.entry) return null;
    Object.assign(found.entry, body);
    return { success: true, entry: found.entry };
  }

  if (path === "/api/resume-settings" && method === "patch") {
    const settings = store[path].settings;
    const { designId, reset, ...changes } = body || {};
    if (designId) {
      settings.designs[designId] = reset ? {} : mergeSettings(settings.designs[designId] || {}, changes, settings);
    } else {
      Object.assign(settings, mergeSettings(settings, changes, settings));
    }
    return { success: true, settings };
  }

  if (path.startsWith("/api/portfolio/hero-summaries")) {
    const designId = path.split("/")[4];
    const saved = (store.heroSummaries ||= {});
    if (method === "put") saved[designId] = { text: body?.text ?? "", origin: "user", stale: false };
    else if (designId) saved[designId] = null;
    else Object.keys(store["/api/portfolio/showcase"].portfolio.heroSummaries).forEach((id) => { saved[id] = null; });
    return { success: true, heroSummaries: derivedHeroSummaries(store) };
  }

  if (path.startsWith("/api/admin/users/") && path.split("/").length === 5) {
    const reply = store["/api/admin/users"];
    const user = reply.users.find((item) => item.id === path.split("/")[4]);
    if (!user) return null;
    if (method === "delete") reply.users = reply.users.filter((item) => item !== user);
    else Object.assign(user, body);
    reply.summary.total = reply.users.length;
    reply.summary.admins = reply.users.filter((item) => item.role === "admin").length;
    reply.summary.disabled = reply.users.filter((item) => item.isDisabled).length;
    return { success: true, user };
  }

  return null;
}

function mergeSettings(current, changes, base) {
  const next = { ...current };
  const limits = { ...current.limits };
  for (const [id, count] of Object.entries(changes.limits || {})) {
    if (count === null) limits[id] = 0;
    else if (count === "default") delete limits[id];
    else limits[id] = count;
  }
  if (changes.limits) next.limits = limits;
  if (changes.show?.length || changes.hide?.length) {
    const extras = new Set(current.extras || base.extras);
    (changes.show || []).forEach((id) => extras.add(id));
    (changes.hide || []).forEach((id) => extras.delete(id));
    next.extras = [...extras];
  }
  if (changes.hideFields?.length || changes.showFields?.length) {
    const fields = new Set(current.hiddenFields || base.hiddenFields);
    (changes.hideFields || []).forEach((id) => fields.add(id));
    (changes.showFields || []).forEach((id) => fields.delete(id));
    next.hiddenFields = [...fields];
  }
  if (changes.hideEntries?.length || changes.showEntries?.length) {
    const entries = new Set(current.hiddenEntries);
    (changes.hideEntries || []).forEach((id) => entries.add(id));
    (changes.showEntries || []).forEach((id) => entries.delete(id));
    next.hiddenEntries = [...entries];
  }
  if (changes.columns) next.columns = { ...current.columns, ...changes.columns };
  if (changes.tweaks) next.tweaks = { ...current.tweaks, ...changes.tweaks };
  for (const key of ["allSkills", "skillStyle", "order", "accent"]) {
    if (changes[key] !== undefined) next[key] = changes[key];
  }
  return next;
}

// The combined views: the same shapes the server's resume data builder makes
const when = (month, year) => (year ? { month: month || null, year } : null);
const byOrder = (list = []) => [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const dateValue = (date) => (date ? date.year * 12 + (date.month || 12) : 0);
const newestFirst = (a, b) => (b.current - a.current) || (dateValue(b.end) - dateValue(a.end)) || (dateValue(b.start) - dateValue(a.start));
const newestDateFirst = (a, b) => dateValue(b.date) - dateValue(a.date);
const fromCalendar = (value) => (typeof value === "string" && /^\d{4}-\d{2}/.test(value) ? { month: Number(value.slice(5, 7)), year: Number(value.slice(0, 4)) } : null);

const nestedProject = (project, source) => ({
  id: project._id,
  title: project.title,
  role: "",
  source,
  start: when(project.startMonth, project.startYear),
  end: when(project.endMonth, project.endYear),
  current: false,
  description: project.description || "",
  bullets: byOrder(project.tasks).map((task) => task.description),
  skills: byOrder(project.skills).map((skill) => skill.name),
  link: ""
});

function gather(store, audience) {
  const shown = (entry) => (audience === "portfolio" ? entry?.showInPortfolio !== false : entry?.showInResume !== false);
  const list = (name) => (store[`/api/${name}`]?.[name] || []).filter(shown);
  const contact = store["/api/profile"]?.profile?.contact || {};
  const account = store["/api/auth/me"].user;
  const allProjects = [];

  const experiences = list("experiences").map((item) => {
    const projects = (item.projects || []).filter(shown);
    projects.forEach((project) => allProjects.push(nestedProject(project, `${item.jobTitle} · ${item.organization}`)));
    return {
      id: item._id,
      title: item.jobTitle,
      organization: item.organization,
      location: item.location || "",
      employmentType: item.employmentType || "",
      start: when(item.startMonth, item.startYear),
      end: item.currentlyWorking ? null : when(item.endMonth, item.endYear),
      current: Boolean(item.currentlyWorking),
      summary: item.summary || "",
      highlights: item.highlights || "",
      bullets: byOrder(item.tasks).map((task) => task.description),
      skills: byOrder(item.skills).map((skill) => skill.name),
      projects: projects.map((project) => ({ title: project.title, description: project.description || "", tasks: byOrder(project.tasks).map((task) => task.description) }))
    };
  }).sort(newestFirst);

  const educations = list("educations").map((item) => {
    (item.projects || []).filter(shown).forEach((project) => allProjects.push(nestedProject(project, `${item.degree || "Education"} · ${item.institution}`)));
    return {
      id: item._id,
      institution: item.institution,
      degree: item.degree || "",
      fieldOfStudy: item.fieldOfStudy || "",
      location: item.location || "",
      start: when(item.startMonth, item.startYear),
      end: item.currentlyStudying ? null : when(item.endMonth, item.endYear),
      current: Boolean(item.currentlyStudying),
      grade: item.grade || "",
      description: item.description || "",
      bullets: byOrder(item.tasks).map((task) => task.description),
      courses: byOrder(item.courses).map((course) => course.name)
    };
  }).sort(newestFirst);

  list("projects").forEach((project) => {
    const links = byOrder(project.links);
    allProjects.push({
      id: project._id,
      title: project.title,
      role: project.role || "Creator/Developer",
      source: `${project.projectType || "Personal"} project`,
      start: when(project.startMonth, project.startYear),
      end: project.ongoing ? null : when(project.endMonth, project.endYear),
      current: Boolean(project.ongoing),
      description: project.description || "",
      bullets: byOrder(project.tasks).map((task) => task.description),
      skills: [],
      link: (links.find((link) => ["GitHub", "Demo"].includes(link.linkType)) || links[0])?.url || "",
      featured: Boolean(project.featured)
    });
  });

  return {
    contact: {
      name: [contact.firstName, contact.middleName, contact.lastName, contact.suffix].filter(Boolean).join(" ") || account.username,
      email: contact.email || account.email,
      phone: contact.phoneNumber || "",
      location: [contact.city, contact.stateProvince, contact.country].filter(Boolean).join(", "),
      linkedin: contact.linkedinUrl || "",
      github: contact.githubUrl || "",
      portfolio: contact.portfolioUrl || ""
    },
    summary: store["/api/summary"]?.summary?.content || "",
    experiences,
    educations,
    projects: allProjects.sort((a, b) => (Boolean(b.featured) - Boolean(a.featured)) || newestFirst(a, b)),
    skills: list("skills")
      .sort((a, b) => (Boolean(b.isImportant) - Boolean(a.isImportant)) || ((a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)) || (b.rating - a.rating))
      .map((skill) => ({ id: skill._id, name: skill.name, skillType: skill.skillType, rating: skill.rating, isImportant: Boolean(skill.isImportant) })),
    certifications: list("certifications").map((item) => ({ id: item._id, title: item.name, subtitle: item.issuingOrganization || "", date: when(item.issueMonth, item.issueYear), detail: item.credentialId ? `Credential ID ${item.credentialId}` : "" })).sort(newestDateFirst),
    achievements: list("achievements").map((item) => ({ id: item._id, title: item.title, subtitle: [item.issuer, item.result].filter(Boolean).join(", "), date: when(item.month, item.year), description: item.description || "", featured: Boolean(item.featured) })).sort((a, b) => (b.featured - a.featured) || newestDateFirst(a, b)),
    volunteering: list("volunteering").map((item) => ({ id: item._id, title: item.role, subtitle: item.organization, cause: item.cause || "", start: when(item.startMonth, item.startYear), end: item.currentlyVolunteering ? null : when(item.endMonth, item.endYear), current: Boolean(item.currentlyVolunteering), description: item.description || "" })).sort(newestFirst),
    publications: list("publications").map((item) => ({ id: item._id, title: item.title, subtitle: item.publisher || "", date: fromCalendar(item.publishedOn), detail: item.url || "" })).sort(newestDateFirst),
    patents: list("patents").map((item) => ({ id: item._id, title: item.title, subtitle: [item.patentNumber, item.status].filter(Boolean).join(", "), date: fromCalendar(item.date), detail: item.url || "" })).sort(newestDateFirst),
    interests: list("interests").map((item) => ({ id: item._id, title: item.name, subtitle: item.category || "" }))
  };
}

function derivedHeroSummaries(store) {
  const recorded = store["/api/portfolio/showcase"].portfolio.heroSummaries || {};
  const merged = { ...recorded, ...store.heroSummaries };
  return Object.fromEntries(Object.entries(merged).filter(([, value]) => value));
}

function showcase(store, audience) {
  const portfolio = gather(store, audience);
  const roles = store["/api/profile"]?.profile?.roleDetails || {};
  const contact = store["/api/profile"]?.profile?.contact || {};
  const shown = (item) => (audience === "portfolio" ? item.showInPortfolio !== false : item.showInResume !== false);

  return {
    success: true,
    portfolio: {
      ...portfolio,
      hasProfile: Boolean(contact.firstName || contact.lastName || contact.phoneNumber || contact.city || contact.linkedinUrl || contact.githubUrl || contact.portfolioUrl),
      headline: roles.headline?.trim() || portfolio.experiences[0]?.title || "",
      heroSummaries: derivedHeroSummaries(store),
      openTo: {
        roleTargeting: roles.roleTargeting || "",
        employmentTypes: roles.employmentTypes || [],
        workplaceTypes: roles.workplaceTypes || [],
        industries: roles.industries || [],
        services: roles.services || [],
        locations: roles.locations || []
      },
      recommendations: (store["/api/recommendations"]?.recommendations || [])
        .filter((item) => item.visibility !== "Private" && shown(item))
        .map((item) => ({
          id: item._id,
          kind: item.kind,
          name: [item.firstName, item.lastName].filter(Boolean).join(" "),
          relationship: item.relationship,
          title: item.recommenderTitle || "",
          organization: item.recommenderOrganization || "",
          text: item.text || "",
          date: item.year ? { month: item.month || null, year: item.year } : null,
          featured: Boolean(item.featured)
        }))
        .sort((a, b) => (b.featured - a.featured) || ((b.date?.year || 0) - (a.date?.year || 0)))
    }
  };
}

function overview(store) {
  const count = (name) => store[`/api/${name}`]?.[name]?.length || 0;
  const profile = store["/api/profile"]?.profile;
  const hasValue = (value) => (value && typeof value === "object" ? Object.values(value).some(hasValue) : Boolean(value));
  const sections = {
    experience: count("experiences"),
    education: count("educations"),
    projects: count("projects"),
    skills: count("skills"),
    certifications: count("certifications"),
    recommendations: count("recommendations"),
    volunteering: count("volunteering"),
    achievements: count("achievements"),
    interests: count("interests"),
    publications: count("publications"),
    patents: count("patents"),
    profile: hasValue({ contact: profile?.contact, personal: profile?.personal }) ? 1 : 0,
    summary: store["/api/summary"]?.summary?.content?.trim() ? 1 : 0
  };
  const core = ["profile", "summary", "experience", "education", "skills", "projects"];
  const filled = core.filter((key) => sections[key] > 0);
  return { success: true, sections, completeness: { filled: filled.length, total: core.length, missing: core.filter((key) => !sections[key]) } };
}

// A GET: a combined view, a list or entry from the store, or a recorded reply
export function readReply(store, path, search) {
  if (store["/api/portfolio/overview"]) {
    if (path === "/api/portfolio/overview") return overview(store);
    if (path === "/api/portfolio/showcase") return showcase(store, search.includes("for=resume") ? "resume" : "portfolio");
    if (path === "/api/resume/sources") return { ...store[path], sources: gather(store, "resume") };

    const found = locate(store, path);
    if (found && !isId(path.split("/").at(-1))) return { ...store[path], success: true, [found.listName]: found.list };
    if (found?.entry) return { success: true, [singular(found.listName)]: found.entry };
  }
  return store[`${path}${search}`] ?? store[path];
}
