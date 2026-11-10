const { DESIGNS, FIXED_LAYOUT, FONTS, SECTIONS, CORE_SECTIONS, SECTION_WORDS, COLORS, designById, designFromText } = require("./designCatalog");

// The design agent's brain: turns "make a dark green Slate called Forest and
// hide projects" into a plan the server applies:
//   { action: "create" | "update" | "delete" | "list" | "none",
//     targetId, baseId, changes: { name, accent, font, headingFont, corners,
//     mode, hide, show, order, titles, heroSummary }, notes }
//
// Rules read the common requests exactly (colours, fonts, sections, names);
// the language model (when there is one) handles wording the rules miss.
// Either way the plan is checked against the catalog before it's used.

const PLAN_PROMPT = [
  "You turn a request about the user's custom portfolio designs into a plan.",
  "designs lists the built-in designs to start from; custom lists the user's own designs; currentId is the one they're looking at.",
  "- action: create (a new design from baseId), update (targetId, default currentId), delete (targetId), list, or none.",
  "- changes may set: name, accent (#rrggbb), font and headingFont (only names from fonts), corners (sharp, soft, round),",
  "  mode (light, dark), hide and show (section ids from sections), order (section ids, first to last),",
  "  titles ({ sectionId: new title }), heroSummary (short line under the name),",
  "  limits ({ sectionId: how many items to show, or null for all }).",
  "- Only include what the request asks for.",
  'Reply with JSON only: {"action": string, "targetId": string, "baseId": string, "changes": object}'
].join("\n");

const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i;
const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();

function expandHex(hex) {
  const value = hex.toLowerCase();
  return value.length === 4 ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : value;
}

function colorFrom(text) {
  const hex = text.match(HEX);
  if (hex) return expandHex(hex[0]);
  const lower = text.toLowerCase();
  const name = Object.keys(COLORS).sort((a, b) => b.length - a.length).find((color) => new RegExp(`\\b${color}\\b`).test(lower));
  return name ? COLORS[name] : "";
}

const sectionsIn = (text) => SECTIONS.filter((id) => SECTION_WORDS[id].test(text));

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, single: 1, couple: 2, few: 3 };
const SECTION_NOUN = "(projects?|experiences?|jobs?|positions?|roles?|educations?|schools?|degrees?|skills?|certifications?|certificates?|achievements?|awards?|recommendations?|references?|volunteering|volunteer roles?|publications?|papers?|patents?|interests?|hobbies)";
// "only the first two projects", "1 experience", "top 5 skills", "max 3 papers"
const COUNT = new RegExp(`\\b(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})\\s+(?:of\\s+(?:my\\s+|the\\s+)?)?(?:latest\\s+|recent\\s+|most recent\\s+|newest\\s+|top\\s+|main\\s+)?([a-z]{3,})\\b`, "gi");
const NOUN_WORDS = { project: "projects", experience: "experience", job: "experience", position: "experience", role: "experience",
  education: "education", school: "education", degree: "education", skill: "skills", certification: "certifications",
  certificate: "certifications", achievement: "achievements", award: "achievements", recommendation: "recommendations",
  reference: "recommendations", volunteering: "volunteering", publication: "publications", paper: "publications",
  patent: "patents", interest: "interests", hobbies: "interests" };

// "projects", "experiuence", "certifcations": the section a noun means,
// allowing a typo or two
function sectionForNoun(word) {
  const { editDistance } = require("../../utils/skillSimilarity");
  const base = word.toLowerCase().replace(/(ies)$/, "y").replace(/s$/, "");
  if (NOUN_WORDS[base]) return NOUN_WORDS[base];
  let best = null;
  for (const [noun, id] of Object.entries(NOUN_WORDS)) {
    const distance = editDistance(base, noun);
    if (distance <= (noun.length > 7 ? 2 : 1) && (!best || distance < best.distance)) best = { id, distance };
  }
  return best?.id || null;
}
const ALL = new RegExp(`\\b(?:show|include|display)\\s+(?:all|every|all of)\\s+(?:my\\s+|the\\s+)?${SECTION_NOUN}\\b|\\b(?:no|remove the|without a)\\s+limit\\s+(?:on|for)\\s+(?:my\\s+|the\\s+)?${SECTION_NOUN}\\b`, "gi");

const LATEST_ONLY = new RegExp(`\\b(?:only|just)\\s+(?:show\\s+)?(?:my|the)\\s+(?:latest|most recent|newest|current|last)\\s+${SECTION_NOUN}\\b`, "gi");

// { projects: 2, experience: 1 }; null removes a limit ("show all projects")
function limitsIn(text) {
  const limits = {};
  for (const match of text.matchAll(COUNT)) {
    const id = sectionForNoun(match[2]);
    const count = /^\d+$/.test(match[1]) ? Number(match[1]) : NUMBER_WORDS[match[1].toLowerCase()];
    if (id && count > 0 && count <= 50) limits[id] = count;
  }
  for (const match of text.matchAll(ALL)) {
    const id = sectionsIn(match[1] || match[2])[0];
    if (id) limits[id] = null;
  }
  // "only my latest school": entries are newest first, so that's one
  for (const match of text.matchAll(LATEST_ONLY)) {
    const id = sectionForNoun(match[1]);
    if (id) limits[id] = 1;
  }
  return limits;
}

// The rules: what a request clearly says
function ruleChanges(request) {
  const text = clean(request);
  const lower = text.toLowerCase();
  const changes = {};

  const name = text.match(/\b(?:call(?:ed)? it|name(?:d)? it|rename it to|named|called)\s+["“']?([\w][\w &'.-]{1,39}?)["”']?(?=[,.!]|\s+and\b|\s+with\b|$)/i);
  if (name) changes.name = clean(name[1]);

  // Section names aren't colours or fonts ("interests" isn't Inter)
  const styleText = text.replace(/\b(dark|light) (mode|theme)\b/gi, "");
  const color = colorFrom(styleText);
  if (color) changes.accent = color;

  for (const font of [...FONTS].sort((a, b) => b.length - a.length)) {
    const match = new RegExp(`\\b${font.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).exec(lower);
    if (!match) continue;
    // "Playfair for headings and Inter for text": the words right after a
    // font say what it's for; otherwise the words before it
    const after = lower.slice(match.index + font.length, match.index + font.length + 22);
    const before = lower.slice(Math.max(0, match.index - 22), match.index);
    const forHeadings = /^\W*(for |on |as )?(the )?(heading|title|headline)/.test(after) ||
      (!/^\W*(for |on |as )?(the )?(text|body|paragraph)/.test(after) && /(heading|title|headline)s?( font)?( to| in| with)?\s*$/.test(before));
    if (forHeadings) changes.headingFont ||= font;
    else changes.font ||= font;
  }

  if (/\b(sharp|square)\b/i.test(text)) changes.corners = "sharp";
  else if (/\b(round(ed)?|pill)\b/i.test(text)) changes.corners = "round";
  else if (/\bsoft\b/i.test(text)) changes.corners = "soft";

  if (/\b(dark mode|always dark|dark theme|make it dark)\b/i.test(text)) changes.mode = "dark";
  else if (/\b(light mode|always light|light theme|make it light)\b/i.test(text)) changes.mode = "light";

  // "hide projects and interests", "remove the volunteering section"
  const hidePart = text.match(/\b(?:hide|remove|drop|without|don'?t show|do not show|take out|get rid of)\b(.*?)(?=\b(?:show|add|include|bring back|put|move|call|rename|make)\b|$)/i);
  if (hidePart && !/\b(design|portfolio)\b/i.test(hidePart[1])) {
    const ids = sectionsIn(hidePart[1]);
    if (ids.length) changes.hide = ids;
  }
  // "only the first two projects and 1 experience", "show all projects"
  const limits = limitsIn(text);
  if (Object.keys(limits).length) changes.limits = limits;

  const showPart = text.match(/\b(?:show|add|include|bring back|unhide)\b(.*?)(?=\b(?:hide|remove|drop|put|move|call|rename|make)\b|$)/i);
  if (showPart) {
    // A section given a count is limited, not just shown
    const ids = sectionsIn(showPart[1]).filter((id) => !(id in limits) || limits[id] === null);
    if (ids.length) changes.show = ids;
  }

  // "put projects first", "move skills before education", "order: a, b, c"
  const first = text.match(/\b(?:put|move|show)\s+(?:the\s+)?(\w+)(?:\s+section)?\s+(?:first|at the top|on top)\b/i);
  const relative = text.match(/\bmove\s+(?:the\s+)?(\w+)(?:\s+section)?\s+(before|after|above|below)\s+(?:the\s+)?(\w+)/i);
  const list = text.match(/\border\s*(?:is|to|:)?\s*([\w ,]+(?:,\s*[\w ]+)+)/i);
  if (list) changes.order = list[1].split(/,|\band\b/).map((part) => sectionsIn(part)[0]).filter(Boolean);
  else if (first && sectionsIn(first[1]).length) changes.order = [sectionsIn(first[1])[0], "*"];
  else if (relative && sectionsIn(relative[1]).length && sectionsIn(relative[3]).length) {
    changes.order = [sectionsIn(relative[1])[0], /before|above/i.test(relative[2]) ? "<" : ">", sectionsIn(relative[3])[0]];
  }

  // "rename projects to Things I built"
  const rename = text.match(/\brename\s+(?:the\s+)?(\w+)(?:\s+section)?\s+to\s+["“']?(.+?)["”']?$/i);
  if (rename && sectionsIn(rename[1]).length) changes.titles = { [sectionsIn(rename[1])[0]]: clean(rename[2]).slice(0, 40) };
  // "rename Forest to Pine": not a section, so the design itself
  const renamed = text.match(/\brename\s+(?:the\s+|my\s+)?["“']?(.+?)["”']?(?:\s+design)?\s+to\s+["“']?([\w][\w &'.-]{1,39}?)["”']?[.!]?$/i);
  if (renamed && !sectionsIn(renamed[1]).length && !/^it$/i.test(renamed[1])) changes.name = clean(renamed[2]);

  const tagline = text.match(/\b(?:tagline|summary line|hero (?:text|summary|line)|subtitle)\s*(?:to|:|as|=)\s*["“']?(.+?)["”']?$/i);
  if (tagline) changes.heroSummary = clean(tagline[1]).slice(0, 400);

  return changes;
}

function ruleAction(request, custom, currentId) {
  const lower = request.toLowerCase();
  if (/\b(list|show me|what are)\b.*\b(my )?(custom )?designs\b/.test(lower)) return "list";
  if (/\b(delete|remove|get rid of)\b.*\b(this|the|my)?\s*(custom )?design\b/.test(lower)) return "delete";
  if (/\b(create|make|new|build|start|design me|give me)\b/.test(lower) && (/\b(design|portfolio|theme|version|copy)\b/.test(lower) || designFromText(lower))) {
    return currentId && !designFromText(lower) && !/\bnew\b/.test(lower) ? "update" : "create";
  }
  return currentId || custom.length ? "update" : "create";
}

// Applies "*", "<", ">" order shorthands to a real order
function resolveOrder(order, current) {
  const base = current.length ? [...current] : [...SECTIONS];
  if (order[1] === "*") return [order[0], ...base.filter((id) => id !== order[0])];
  if (order[1] === "<" || order[1] === ">") {
    const [moving, , anchor] = order;
    const rest = base.filter((id) => id !== moving);
    const at = rest.indexOf(anchor);
    if (at < 0) return base;
    rest.splice(order[1] === "<" ? at : at + 1, 0, moving);
    return rest;
  }
  return [...new Set([...order, ...base.filter((id) => !order.includes(id))])];
}

// Keeps only values the catalog allows; notes say what was dropped
function sanitizePlan(plan, custom, currentId) {
  const notes = [];
  const action = ["create", "update", "delete", "list", "none"].includes(plan.action) ? plan.action : "none";
  // The design asked for, the one on screen, the user's design built on the
  // named base ("… in Mono"), then their latest
  const targetId = custom.some((design) => design.id === plan.targetId) ? plan.targetId
    : custom.some((design) => design.id === currentId) ? currentId
      : custom.find((design) => design.baseId === plan.baseId)?.id || custom[0]?.id || "";
  const target = custom.find((design) => design.id === targetId);
  const baseId = designById(plan.baseId) ? plan.baseId : target?.baseId || "slate";
  const raw = plan.changes || {};
  const changes = {};

  if (typeof raw.name === "string" && clean(raw.name)) changes.name = clean(raw.name).slice(0, 60);
  if (typeof raw.accent === "string" && HEX.test(raw.accent)) changes.accent = expandHex(raw.accent.match(HEX)[0]);
  for (const key of ["font", "headingFont"]) {
    if (typeof raw[key] !== "string" || !raw[key]) continue;
    const font = FONTS.find((name) => name.toLowerCase() === raw[key].toLowerCase());
    if (font) changes[key] = font;
    else notes.push(`The font "${raw[key]}" isn't available; try ${FONTS.slice(0, 6).join(", ")}…`);
  }
  if (["sharp", "soft", "round", ""].includes(raw.corners)) changes.corners = raw.corners;
  if (["light", "dark", ""].includes(raw.mode)) changes.mode = raw.mode;

  const fixed = FIXED_LAYOUT.includes(baseId);
  if (Array.isArray(raw.hide)) {
    const hide = raw.hide.filter((id) => SECTIONS.includes(id));
    const blocked = fixed ? hide.filter((id) => CORE_SECTIONS.includes(id)) : [];
    if (blocked.length) notes.push(`${designById(baseId).name} lays out ${blocked.join(", ")} by hand, so ${blocked.length > 1 ? "they" : "it"} can't be hidden there.`);
    changes.hide = hide.filter((id) => !blocked.includes(id));
  }
  if (Array.isArray(raw.show)) changes.show = raw.show.filter((id) => SECTIONS.includes(id));
  if (raw.limits && typeof raw.limits === "object") {
    const limits = Object.fromEntries(Object.entries(raw.limits)
      .filter(([id, count]) => SECTIONS.includes(id) && id !== "about" && (count === null || (Number.isInteger(count) && count >= 1 && count <= 50))));
    if (Object.keys(limits).length) changes.limits = limits;
  }
  if (Array.isArray(raw.order) && raw.order.length) {
    if (fixed) notes.push(`${designById(baseId).name} keeps its own section order.`);
    else changes.order = resolveOrder(raw.order.filter((id) => SECTIONS.includes(id) || ["*", "<", ">"].includes(id)), target?.order || []);
  }
  if (raw.titles && typeof raw.titles === "object") {
    const titles = Object.fromEntries(Object.entries(raw.titles)
      .filter(([id, title]) => SECTIONS.includes(id) && typeof title === "string" && clean(title))
      .map(([id, title]) => [id, clean(title).slice(0, 40)]));
    if (Object.keys(titles).length) changes.titles = titles;
  }
  if (typeof raw.heroSummary === "string") changes.heroSummary = clean(raw.heroSummary).slice(0, 400);

  return { action, targetId: action === "create" ? "" : targetId, baseId, changes, notes };
}

const isEmpty = (changes) => !Object.keys(changes).length;

// request: what the user said; custom: their designs [{ id, name, baseId,
// order }]; currentId: the custom design on screen, if any
async function planDesign({ request, custom = [], currentId = "", llm = null, signal }) {
  const changes = ruleChanges(request);
  let plan = { action: ruleAction(request, custom, currentId), baseId: designFromText(request), changes };
  // A design named in the request is the one to change: "use round corners on Forest"
  const named = custom.find((design) => new RegExp(`(?<![\\w])${design.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`, "i").test(request));
  if (named && ["update", "delete"].includes(plan.action)) plan.targetId = named.id;
  let by = "rules";

  // Wording the rules didn't understand goes to the model
  if (isEmpty(changes) && !["list", "delete"].includes(plan.action) && llm) {
    try {
      const reply = await llm.invokeJson(PLAN_PROMPT, {
        request,
        designs: DESIGNS,
        custom: custom.map(({ id, name, baseId }) => ({ id, name, baseId })),
        currentId,
        fonts: FONTS,
        sections: SECTIONS
      }, signal);
      plan = { action: reply.action, targetId: reply.targetId, baseId: reply.baseId || plan.baseId, changes: reply.changes || {} };
      by = "language model";
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  const result = sanitizePlan(plan, custom, currentId);
  // A new design needs a base; "update" with nothing to update and no
  // custom designs means they want a new one
  if (result.action === "update" && !custom.length) result.action = "create";
  if (result.action === "update" && isEmpty(result.changes)) result.action = "none";
  return { ...result, plannedBy: by };
}

// ---- Resumes ---------------------------------------------------------------

const RESUME_WORDS = /\b(r[eé]sum[eé]s?|cvs?)\b/i;
const MORE = new RegExp(`\\b(?:add|include|put|show|list|display|bring in|use)\\s+(?:all|every|the rest of|remaining|my other|the other|more of|the remaining)\\s+(?:of\\s+)?(?:my\\s+|the\\s+)?([a-z]+)`, "gi");
const EXTRA_IDS = ["achievements", "volunteering", "publications", "patents", "interests", "recommendations"];
const LIMIT_IDS = ["experience", "education", "projects", "certifications"];

// Is this about what the resumes include (not about a portfolio design)?
const isResumeRequest = (text) => RESUME_WORDS.test(text) && !/\b(portfolio|website)\b/i.test(text);

// "show all my projects on my resume", "3 jobs", "add interests", "all skills"
// -> { limits: { projects: null, experience: 3 }, show: ["interests"], hide, allSkills }
function planResume(request) {
  const text = clean(request);
  const changes = {};
  const limits = {};
  for (const [id, count] of Object.entries(limitsIn(text))) if (LIMIT_IDS.includes(id)) limits[id] = count;
  for (const match of text.matchAll(MORE)) {
    const id = sectionForNoun(match[1]);
    if (LIMIT_IDS.includes(id)) limits[id] = null;
  }
  // "all projects", "all experience included", unless they're being removed
  if (!/\b(?:hide|remove|drop|without|delete|exclude|don'?t|take|leave out|get rid)\b/i.test(text)) {
    for (const match of text.matchAll(new RegExp(`\\ball\\s+(?:of\\s+)?(?:my\\s+|the\\s+)?${SECTION_NOUN}\\b`, "gi"))) {
      const id = sectionForNoun(match[1].toLowerCase());
      if (LIMIT_IDS.includes(id)) limits[id] = null;
    }
  }
  if (/\b(?:back to|reset(?: to)?|the) default\b|\breset (?:my )?r[eé]sum[eé]/i.test(text)) for (const id of LIMIT_IDS) if (!(id in limits)) limits[id] = "default";
  if (Object.keys(limits).length) changes.limits = limits;

  const hidePart = text.match(/\b(?:hide|remove|drop|without|don'?t show|do not show|take out|leave out)\b(.*?)(?=\b(?:show|add|include|put)\b|$)/i);
  const showPart = text.match(/\b(?:show|add|include|put|bring back|list)\b(.*?)(?=\b(?:hide|remove|drop|leave out)\b|$)/i);
  const extrasIn = (part) => (part ? sectionsIn(part).filter((id) => EXTRA_IDS.includes(id)) : []);
  if (extrasIn(showPart?.[1]).length) changes.show = extrasIn(showPart[1]);
  if (extrasIn(hidePart?.[1]).length) changes.hide = extrasIn(hidePart[1]);

  if (/\b(?:all|every|other|remaining|the rest of)\s+(?:of\s+)?(?:my\s+|the\s+)?skills\b/i.test(text)) changes.allSkills = true;
  if (/\b(?:only|just)\s+(?:my\s+|the\s+)?(?:key|important|top|main)\s+skills\b/i.test(text)) changes.allSkills = false;
  return changes;
}

module.exports = { planDesign, ruleChanges, sanitizePlan, resolveOrder, planResume, isResumeRequest, prompts: { PLAN_PROMPT } };
