const { StateGraph, Annotation, START, END } = require("@langchain/langgraph");
const {
  specOf, allSpecs, coerce, coerceAll, missingFields, questionFor, choicesFor, sectionFromText, dateProblem, toYear, toMonth, MONTHS
} = require("./sectionSpecs");
const { splitRequest, answerValue, optionMentioned, isGenericValue } = require("./textUnderstanding");
const { scoreSections, readLabelled } = require("./messageReader");

// The data entry agent, as a LangGraph workflow. It turns "I did my MS in
// CS at UNT from 2021 to 2023" into an Education entry:
//
//   understand → check ─┬─→ ask (a required field is missing) → END
//                       └─→ dedupe → buffer ─┬─→ check (next entry, if any)
//                                            └─→ END
//
// understand picks the section from the model of each section (keywords
// first, the language model when unclear) and extracts the fields that
// section's schema has (from the MCP tool list_section_schemas). check asks
// for required fields one at a time; answers are read in the field's own
// type. dedupe asks the knowledge graph (GraphRAG, find_existing_entry)
// whether it's already there; buffer puts it in the buffer zone
// (add_to_buffer) for the user to confirm on the section's page. Nothing in
// the portfolio itself changes here.

const CANCEL = /^\s*(cancel|stop|never ?mind|forget it|quit|abort)\b/i;

// What to put in one message, per section
const HINTS = {
  education: "the degree, field, school and years",
  experience: "your title, the company and the dates",
  projects: "its name, what it does, your role, dates and links",
  certifications: "its name, who issued it and when",
  achievements: "what it was, who gave it and when",
  volunteering: "your role, the organization and the dates",
  publications: "the title, where it was published and when",
  patents: "the title, the patent number and its status",
  interests: "the interest and a few words about it"
};
const SKIP = /^\s*(skip|don'?t know|not sure|n\/a|none)\b/i;

const SECTION_PROMPT = [
  "Which portfolio section does the user's text add to?",
  "sections lists them with their fields. Reply \"none\" if the text isn't adding something to a portfolio.",
  'Reply with JSON only: {"section": string}'
].join("\n");

const EXTRACT_PROMPT = [
  "You fill in portfolio entries from what the user wrote.",
  "schema lists the section's fields: name, type, whether required and the allowed options.",
  "- Use ONLY what the text states. Never guess or invent a value; leave a field out when the text doesn't say it.",
  "- Copy names (schools, companies, titles) as the user wrote them.",
  "- month: 1 to 12. year: four digits. boolean: true or false. date: YYYY-MM-DD. options: one of the given values.",
  "- If the text describes more than one entry (two degrees, two jobs), return one object per entry.",
  "- If asked is given, the text answers that field; fill it, plus anything else the text says.",
  'Reply with JSON only: {"entries": [{"<field>": value}]}'
].join("\n");

const State = Annotation.Root({
  text: Annotation(),
  pending: Annotation(),
  section: Annotation(),
  current: Annotation(),
  queue: Annotation({ reducer: (_, next) => next, default: () => [] }),
  reply: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] }),
  links: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] }),
  choices: Annotation({ reducer: (_, next) => next, default: () => [] }),
  steps: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] }),
  sourceText: Annotation(),
  restart: Annotation({ reducer: (_, next) => next, default: () => false }),
  answer: Annotation({ reducer: (_, next) => next, default: () => false }),
  added: Annotation({ reducer: (_, next) => next, default: () => [] }),
  skipped: Annotation({ reducer: (_, next) => next, default: () => [] }),
  done: Annotation({ reducer: (_, next) => next, default: () => false })
});

const words = (text) => String(text || "").toLowerCase().match(/[a-z0-9+#.]+/g) || [];

// A name the model gave must come from what the user wrote
function grounded(value, source) {
  const said = new Set(words(source));
  const parts = words(value).filter((word) => word.length > 1);
  if (!parts.length) return false;
  return parts.filter((word) => said.has(word)).length / parts.length >= 0.6;
}

// Keeps the model's values that fit the schema and, for names and other
// text, appear in what the user wrote
function groundedValues(spec, raw, source) {
  const values = coerceAll(spec, raw);
  for (const field of spec.fieldSpecs) {
    const value = values[field.name];
    if (value === undefined) continue;
    if (field.type === "text" && !/description|summary/i.test(field.name) && !grounded(value, source)) delete values[field.name];
    // "at Verizon" as a title is a fragment of the sentence, not a value
    if (field.type === "text" && !/description|summary|text|content/i.test(field.name) && /^(at|from|by|in|for|with|of|to)\s/i.test(String(values[field.name] || ""))) delete values[field.name];
    // A choice only when the words point at it ("finished" -> Completed)
    if (field.type === "enum" && !optionMentioned(value, source)) delete values[field.name];
    // A description is the user's details, never their request repeated
    if (/description|summary/i.test(field.name)) {
      const { content, requestOnly } = splitRequest(value);
      if (requestOnly || content.split(/\s+/).length < 3 || !grounded(content, source)) delete values[field.name];
      else values[field.name] = content.replace(/^\w/, (letter) => letter.toUpperCase());
    }
    if ((field.type === "year") && !String(source).includes(String(value))) delete values[field.name];
    // A month only when one is written ("March", "03/2024")
    if (field.type === "month" && !new RegExp(`\\b(${MONTHS[value - 1].slice(0, 3)}\\w*|0?${value}\\s*/\\s*(?:19|20)\\d{2})\\b`, "i").test(source)) delete values[field.name];
    // Yes/no only when the wording says so ("still", "until 2022"), never a guess
    if (field.type === "boolean" && !/\b(current\w*|present|now|still|since|ongoing|ended|left|until|finished|completed|graduated|to (?:19|20)\d{2}|(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2})\b/i.test(source)) delete values[field.name];
  }
  return values;
}

// ---- Reading text without a language model ---------------------------------

const DEGREE = /\b(ph\.?\s?d|doctorate|m\.?\s?s\.?(?=\s|$|,)|m\.?\s?sc|m\.?\s?tech|m\.?\s?eng|mba|m\.?\s?a\.?(?=\s|$|,)|master'?s?(?: of [a-z ]+?)?(?= in| at| from|,|$)|b\.?\s?s\.?(?=\s|$|,)|b\.?\s?sc|b\.?\s?tech|b\.?\s?e\.?(?=\s|$|,)|b\.?\s?a\.?(?=\s|$|,)|bachelor'?s?(?: of [a-z ]+?)?(?= in| at| from|,|$)|associate'?s?|diploma|high school)/i;

function yearsIn(text) {
  return [...String(text).matchAll(/\b(?:(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\.?\s+)?(19\d{2}|20\d{2})\b/gi)]
    .map((match) => ({ month: match[1] ? toMonth(match[1]) : undefined, year: Number(match[2]) }));
}

const PLACE = "([A-Z][\\w&.'-]*(?:\\s+(?:of|at|for|and|&|[A-Z][\\w&.'-]*))*)";

// One entry per skill in "add Python, SQL and RAG to my skills"; one entry
// otherwise
function ruleEntries(sectionId, text, { answer = false } = {}) {
  if (sectionId !== "skills") return [ruleExtract(sectionId, text)];
  // An answer to "Which skills?" is the list itself
  const list = answer && !/\b(add|skills?)\b/i.test(text) ? text : text.match(/\b(?:skills?\s*(?:are|is|:|-|like|such as)?|add|know|proficient (?:in|with)|experienced (?:in|with)|good at)\s+(.+?)(?:\s+(?:to|in|into|under)\s+my\s+skills?|\s+as\s+(?:a\s+)?(?:key|soft|technical)?\s*skills?|[.!?]?$)/i)?.[1] || "";
  const level = /\b(expert|advanced)\b/i.test(text) ? (/expert/i.test(text) ? 5 : 4) : /\bintermediate\b/i.test(text) ? 3 : /\b(beginner|basic)\b/i.test(text) ? 2 : undefined;
  const names = list.split(/,|;|\band\b|&|\//).map((item) => item.replace(/^\s*(?:my|the|a|an|skills?)\s+/i, "").replace(/\s*\((?:expert|advanced|intermediate|beginner|basic)\)\s*$/i, "").trim())
    .filter((item) => item && item.split(/\s+/).length <= 4 && !isGenericValue(item) && !/^(skills?|key|soft|technical)$/i.test(item));
  if (!names.length) return [{}];
  return names.slice(0, 15).map((name) => ({
    name,
    ...(level ? { rating: level } : {}),
    ...(/\bsoft skills?\b/i.test(text) ? { skillType: "soft" } : {}),
    ...(/\b(key|important|main|top)\s+skills?\b/i.test(text) ? { isImportant: true } : {})
  }));
}

// The fields rules can read reliably; the rest is asked for
function ruleExtract(sectionId, text) {
  const data = {};
  const dates = yearsIn(text);
  const present = /\b(present|now|current(?:ly)?|ongoing|still|since)\b/i.test(text);
  if (dates[0]) Object.assign(data, { startYear: dates[0].year, ...(dates[0].month ? { startMonth: dates[0].month } : {}) });
  if (dates[1]) Object.assign(data, { endYear: dates[1].year, ...(dates[1].month ? { endMonth: dates[1].month } : {}) });

  if (sectionId === "education") {
    const degree = text.match(DEGREE);
    if (degree) data.degree = degree[0].replace(/\s+/g, " ").trim();
    const school = text.match(new RegExp(`\\b(?:at|from)\\s+(?:the\\s+)?${PLACE}`));
    if (school) data.institution = school[1].trim();
    const field = text.match(/\bin\s+([A-Za-z][A-Za-z &/-]{2,60}?)(?=\s+(?:at|from|in \d|with|,|\.|\(|$)|,|\.|$)/);
    const studied = text.match(/\bstud(?:ied|ying)\s+([A-Z][\w &/-]{2,60}?)\s+(?:at|in|from)\b/);
    if (field && !/^\d/.test(field[1])) data.fieldOfStudy = field[1].trim();
    else if (studied) data.fieldOfStudy = studied[1].trim();
    const gpa = text.match(/\b(?:c?gpa|grade)\s*(?:of|:)?\s*([\d.]+(?:\s*\/\s*[\d.]+)?)/i);
    if (gpa) data.grade = gpa[1].replace(/\s+/g, "");
    if (present && !dates[1]) data.currentlyStudying = true;
  }
  if (sectionId === "experience" || sectionId === "volunteering") {
    const role = text.match(/\bas\s+(?:an?\s+)?([A-Za-z][\w /&-]{2,60}?)(?=\s+(?:at|for|with|in|from)\b|,|\.|$)/i);
    const org = text.match(new RegExp(`\\b(?:at|for|with)\\s+${PLACE}`));
    if (role) data[sectionId === "experience" ? "jobTitle" : "role"] = role[1].trim();
    if (org) data.organization = org[1].trim();
    if (present && !dates[1]) data[sectionId === "experience" ? "currentlyWorking" : "currentlyVolunteering"] = true;
  }
  if (["projects", "achievements", "publications", "patents"].includes(sectionId)) {
    const quoted = text.match(/["“']([^"”']{2,120})["”']/);
    const called = text.match(/\b(?:called|named|titled)\s+([A-Z][\w &.:'-]{1,100}?)(?=[,.]|\s+(?:using|with|in|at|for|that|which|to)\b|$)/);
    if (quoted || called) {
      data.title = (quoted || called)[1].trim();
      // What follows the name, if it describes it: ", a RAG assistant that…"
      const after = text.slice(text.indexOf(data.title) + data.title.length).replace(/^["”'\s,:;–-]+|^(that|which|is|it'?s)\s+/gi, "").trim();
      if (sectionId === "projects" && after.split(/\s+/).length >= 3) data.description = after.replace(/^\w/, (letter) => letter.toUpperCase()).replace(/[^.!?]$/, "$&.");
    }
    if (sectionId === "projects" && present) data.ongoing = true;
  }
  if (sectionId === "certifications") {
    const name = text.match(/\b(?:certified|certification|certificate)\s+(?:in|as|for)?\s*(?:an?\s+|the\s+)?([A-Z][\w &.:+-]{1,100}?)(?=\s+(?:from|by|in \d)|[,.]|$)/);
    const quoted = text.match(/["“']([^"”']{2,120})["”']/);
    if (quoted || name) data.name = (quoted || name)[1].trim();
    const issuer = text.match(new RegExp(`\\b(?:from|by)\\s+${PLACE}`));
    if (issuer) data.issuingOrganization = issuer[1].trim();
    if (dates[0]) Object.assign(data, { issueYear: dates[0].year, ...(dates[0].month ? { issueMonth: dates[0].month } : {}) });
    delete data.startYear; delete data.startMonth; delete data.endYear; delete data.endMonth;
  }
  if (sectionId === "summary") {
    const content = text.match(/\b(?:summary|bio|about me)\b\s*(?:to|as|is|should be|should say|:|-)?\s*[:"“]?\s*([\s\S]{20,})$/i)?.[1];
    return content ? { content: content.replace(/["”]\s*$/, "").trim() } : {};
  }
  if (sectionId === "profile") {
    const profile = {};
    const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
    if (email) profile.email = email[0];
    const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
    if (phone && !/^(19|20)\d{2}$/.test(phone[0].trim())) profile.phoneNumber = phone[0].trim();
    const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,]+/i);
    if (linkedin) profile.linkedinUrl = linkedin[0];
    const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s,]+/i);
    if (github) profile.githubUrl = github[0];
    const site = [...text.matchAll(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:com|io|dev|me|net|org|app|ai|co)(?:\/[^\s,]*)?/gi)].map((match) => match[0]).find((url) => !/linkedin|github|@/i.test(url) && !email?.[0].includes(url));
    if (site && /\bportfolio|website|site\b/i.test(text)) profile.portfolioUrl = site;
    const name = text.match(/\bmy name is\s+([A-Z][\w'-]+)(?:\s+([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?))?/);
    if (name) Object.assign(profile, { firstName: name[1], ...(name[2] ? { lastName: name[2] } : {}) });
    const place = text.match(/\b(?:i live in|i'?m based in|based in|located in|my city is)\s+([A-Z][\w .'-]+?)(?:,\s*([A-Z][\w .'-]+?))?(?:,\s*([A-Z][\w .'-]+?))?(?=[.!?]|$|\s+and\b)/);
    if (place) Object.assign(profile, { city: place[1].trim(), ...(place[2] ? { stateProvince: place[2].trim() } : {}), ...(place[3] ? { country: place[3].trim() } : {}) });
    const headline = text.match(/\bheadline\s*(?:to|is|as|should be|:|-)\s*["“]?(.+?)["”]?\s*$/im);
    if (headline) profile.headline = headline[1].trim();
    const role = text.match(/\b(?:role targeting|target(?:ing)? role)\s*(?:is|to|as|should be|:|-)\s*["“]?(.+?)["”]?\s*$/im);
    if (role) profile.roleTargeting = role[1].trim();
    const roles = !role && text.match(/\b(?:looking for|target roles?(?: are| is|:)?|open to)\s+(?:a |an )?(.+?)\s*(?:roles?|positions?|jobs?)?\s*$/im);
    if (roles) profile.targetRoles = roles[1].split(/,|\bor\b|\band\b/).map((role) => role.trim()).filter(Boolean);
    return profile;
  }
  if (sectionId === "recommendations") {
    const rec = {};
    const person = text.match(/\b(?:from|by)\s+([A-Z][\w'-]+)(?:\s+([A-Z][\w'-]+))?/) || text.match(/^\s*([A-Z][\w'-]+)\s+([A-Z][\w'-]+),?\s+(?:my|who|wrote|gave|recommended)/);
    if (person) Object.assign(rec, { firstName: person[1], ...(person[2] ? { lastName: person[2] } : {}) });
    const relation = text.match(/\bmy\s+(former\s+)?(manager|boss|colleague|co-?worker|teammate|team lead|lead|professor|mentor|supervisor|client|advisor|classmate|director|peer)\b/i);
    if (relation) rec.relationship = relation[2].replace(/^\w/, (letter) => letter.toUpperCase());
    const org = relation && text.slice(relation.index).match(new RegExp(`\\bat\\s+${PLACE}`));
    if (org) rec.recommenderOrganization = org[1].trim();
    const quote = text.match(/["“]([^"”]{20,})["”]/);
    if (quote) rec.text = quote[1].trim();
    if (/\breference\b/i.test(text) && !/\brecommend/i.test(text)) rec.kind = "Reference";
    return rec;
  }
  if (sectionId === "interests") {
    const interest = text.match(/\b(?:interested in|hobb(?:y|ies)(?: is| are|:)?|enjoy|love)\s+([A-Za-z][\w &-]{1,50}?)(?=[,.]|$)/i);
    if (interest) data.name = interest[1].trim();
  }
  return data;
}

// An answer to one question, read in the field's type
function answerFor(field, text) {
  if (field.type === "year") return toYear(text);
  if (field.type === "month") return toMonth(text);
  const value = coerce(field, field.type === "text" ? answerValue(text) : text);
  if (value !== undefined) return value;
  return undefined;
}

// ---- Which section --------------------------------------------------------

const percent = (p) => `${Math.round(p * 100)}%`;

// Weighs every signal (what you asked for, labels, keywords, the Naive
// Bayes classifier); see messageReader.js. Returns { section, ranked, steps };
// section is null when it isn't confident.
async function pickSection(text) {
  const result = await scoreSections(text);
  const total = result.scores.reduce((sum, [, score]) => sum + score, 0) || 1;
  const ranked = result.scores.map(([label, score]) => ({ label, p: score / total }));
  const why = result.reasons.filter((reason) => reason.includes(`→ ${specOf(result.section || "projects").label}`)).slice(0, 3);
  if (result.section && result.confident) {
    return { section: result.section, ranked, steps: [`Picked ${specOf(result.section).label}: ${why.join("; ")}`] };
  }
  return { section: null, ranked, steps: [`Not sure which section: ${result.scores.slice(0, 3).map(([id, score]) => `${specOf(id).label} ${score.toFixed(1)}`).join(", ")}`] };
}

// "Projects", "a job", "the education one" -> a section id
function sectionFromAnswer(text) {
  const lower = text.toLowerCase();
  const byName = allSpecs().find((spec) => lower.includes(spec.label.toLowerCase()) || lower.includes(spec.id) || lower.includes(spec.singular));
  return byName?.id || sectionFromText(text);
}

// ---- Nodes -----------------------------------------------------------------

async function understand(state, config) {
  const { llm, tools, signal } = config.configurable;
  const text = String(state.text || "").trim();
  const pending = state.pending;

  if (pending && CANCEL.test(text)) {
    return { done: true, pending: null, reply: [`Okay, I've dropped that ${specOf(pending.section)?.singular || "entry"}. Nothing was added.`], steps: ["Cancelled the unfinished entry"] };
  }

  // A message that clearly starts something new sets the waiting entry aside
  const starting = /\b(add|i (?:did|got|earned|completed|worked|joined|built|made|won|received|studied|graduated|volunteer\w*|published))\b/i;
  const otherSection = sectionFromText(text);
  const setAside = pending?.asked && pending.asked !== "__any" && pending.data && text.split(/\s+/).length > 4 &&
    (starting.test(text) || (otherSection && otherSection !== pending.section));
  if (setAside) {
    const dropped = specOf(pending.section);
    return {
      pending: null,
      section: otherSection,
      text,
      steps: [`That reads like a new entry, so I set the unfinished ${dropped.singular} aside`],
      reply: [`(I set aside the unfinished ${dropped.singular}${dropped.describe(pending.data) ? ` "${dropped.describe(pending.data)}"` : ""}; tell me again if you still want it.)`],
      restart: true
    };
  }

  // Answering "which section?": then read the original message for it
  if (pending?.clarify === "section") {
    const chosen = sectionFromAnswer(text);
    if (chosen) {
      return understand({ ...state, text: pending.sourceText, section: chosen, pending: null }, config)
        .then((update) => ({ ...update, pending: null, steps: [`You chose ${specOf(chosen).label}`, ...(update.steps || [])] }));
    }
  }

  // An open question's answer is read like a new message for that section
  if (pending?.asked === "__any") {
    if (pending.section === "summary" && text.split(/\s+/).length >= 5) {
      return { section: "summary", current: { data: { content: text } }, queue: [], sourceText: text, pending: null, steps: ["Took your answer as the summary, word for word"] };
    }
    return understand({ ...state, text, section: pending.section, pending: null, answer: true }, config)
      .then((update) => ({ ...update, pending: null, steps: [`Read your answer for ${specOf(pending.section).label}`, ...(update.steps || [])] }));
  }

  // Answering the question asked last time
  if (pending?.asked) {
    const spec = specOf(pending.section);
    const field = spec.fieldSpecs.find((item) => item.name === pending.asked);
    const data = { ...pending.data };
    const steps = [`Read your answer as the ${field.label}`];
    if (SKIP.test(text) && !field.required) {
      steps.push(`Skipped ${field.label}`);
    } else {
      let value = answerFor(field, text);
      // The answer may say more ("AWS Solutions Architect from Amazon",
      // "2021, and I'm still there"): the rules and the model read the rest
      const extra = coerceAll(spec, ruleExtract(pending.section, text));
      if (llm && text.split(/\s+/).length > 3) {
        try {
          const reply = await llm.invokeJson(EXTRACT_PROMPT, { schema: schemaFor(spec), text, asked: field.name }, signal);
          Object.assign(extra, groundedValues(spec, reply.entries?.[0] || {}, `${pending.sourceText}\n${text}`));
        } catch (error) {
          if (signal?.aborted) throw error;
        }
      }
      delete extra[field.name];
      for (const [key, value2] of Object.entries(extra)) {
        if (data[key] !== undefined) continue;
        data[key] = value2;
        // Those words aren't part of the answer itself
        if (typeof value === "string" && typeof value2 === "string" && value.includes(value2) && value !== value2) {
          value = value.replace(new RegExp(`[\\s,]*(?:from|at|by|with|for|in)?\\s*${value2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), "").trim() || value;
          steps.push(`Read "${value2}" from your answer as the ${spec.fieldSpecs.find((item) => item.name === key)?.label || key}`);
        }
      }
      // Dates read into their own fields leave the answer too ("… in 2024")
      if (typeof value === "string" && Object.keys(extra).some((key) => /year$/i.test(key))) {
        value = value.replace(/[\s,]*(?:in|on|since|from|during)?\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+)?(?:19|20)\d{2}\b/gi, "").trim() || value;
      }
      if (value !== undefined) data[field.name] = value;
      else steps.push(`Couldn't read "${text}" as a ${field.type === "enum" ? "choice" : field.type}`);
    }
    return {
      section: pending.section,
      current: { data, retries: value0(data, field) ? 0 : (pending.retries || 0) + 1 },
      queue: pending.queue || [],
      sourceText: `${pending.sourceText}\n${text}`,
      steps
    };
  }

  // A new entry: which section, then which fields
  const steps = [];
  let section = state.section && specOf(state.section) ? state.section : null;
  let ranked = [];
  if (!section) {
    const picked = await pickSection(text);
    section = picked.section;
    ranked = picked.ranked;
    steps.push(...picked.steps);
  }
  if (!section && llm) {
    try {
      const { sections } = await tools.call("list_section_schemas");
      const reply = await llm.invokeJson(SECTION_PROMPT, { text, sections }, signal);
      if (specOf(reply.section)) {
        section = reply.section;
        steps.push(`The language model matched your text to ${specOf(section).label}`);
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  if (!section) {
    // Ask, offering the classifier's best guesses first
    const guesses = ranked.slice(0, 3).map((item) => specOf(item.label).label);
    const choices = [...new Set([...guesses, "Education", "Experience", "Projects", "Certifications"])].slice(0, 5);
    return {
      done: true,
      reply: [guesses.length
        ? `Just to be sure, which section is this for? It sounds most like ${guesses.slice(0, 2).join(" or ")}.`
        : "Which section should that go in? I can add to Education, Experience, Projects, Certifications, Achievements, Volunteering, Publications, Patents and Interests."],
      choices: [...choices, "Cancel"],
      pending: { clarify: "section", sourceText: text },
      steps: ["Not sure which section this is for, so asked you"]
    };
  }

  const spec = specOf(section);
  // NLP: "I want to add a project" is only a request; there's nothing to fill
  const { requestOnly } = splitRequest(text);
  if (requestOnly) {
    steps.push(`NLP: your message asks to add a ${spec.singular} but gives no details yet, so nothing was filled in`);
    return { section, current: { data: {}, retries: 0, requestOnly: true }, queue: [], sourceText: text, steps };
  }

  const labelled = readLabelled(spec, text);
  const fromLabels = coerceAll(spec, labelled.data);
  let entries = ruleEntries(section, text, { answer: state.answer });
  const required = spec.fieldSpecs.filter((field) => field.required).map((field) => field.label);
  steps.push(`Read the ${spec.label} fields from its model${required.length ? `: ${required.join(", ")} required` : ""}`);
  if (Object.keys(fromLabels).length) {
    steps.push(`Read ${Object.keys(fromLabels).length} labelled field${Object.keys(fromLabels).length === 1 ? "" : "s"} as written (${Object.keys(fromLabels).join(", ")})${labelled.extras.length ? `; kept ${labelled.extras.map((item) => item.label).join(", ")} in the description` : ""}`);
  }
  if (llm) {
    try {
      const { sections: [schema] } = await tools.call("list_section_schemas", { sections: [section] });
      const reply = await llm.invokeJson(EXTRACT_PROMPT, { schema: schema.fields, text }, signal);
      // In a labelled message, what you didn't label stays empty: the model
      // may only add dates and links, never text
      const structured = Object.keys(fromLabels).length >= 2;
      const allowed = (name) => !structured || ["year", "month", "date", "url"].includes(spec.fieldSpecs.find((field) => field.name === name)?.type);
      const found = (Array.isArray(reply.entries) ? reply.entries : []).slice(0, 5)
        .map((entry) => groundedValues(spec, entry, text))
        .map((entry) => Object.fromEntries(Object.entries(entry).filter(([name]) => allowed(name))));
      if (found.some((entry) => Object.keys(entry).length)) {
        // The model's reading, with what the rules read filling its gaps
        entries = section === "skills" && entries.length > found.length
          ? entries
          : found.map((entry, index) => ({ ...(entries[index] ? coerceAll(spec, entries[index]) : {}), ...entry }));
        steps.push(`The language model filled ${Object.keys(entries[0]).length} field${Object.keys(entries[0]).length === 1 ? "" : "s"}${entries.length > 1 ? ` across ${entries.length} entries` : ""}; every name was checked against your words`);
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      steps.push("The language model didn't answer; used the rules' reading");
    }
  } else {
    steps.push("No language model running; read the fields with rules");
  }
  // What you labelled yourself wins over any reading
  entries = entries.map((entry, index) => coerceAll(spec, index === 0 ? { ...entry, ...fromLabels } : entry));

  const [first, ...rest] = entries;
  return {
    section,
    current: { data: first, retries: 0 },
    queue: rest.map((data) => ({ section, data })),
    sourceText: text,
    steps
  };
}

const value0 = (data, field) => data[field.name] !== undefined;

const schemaFor = (spec) => spec.fieldSpecs.map((field) => ({
  name: field.name, type: field.type, required: field.required, ...(field.enum.length ? { options: field.enum } : {})
}));

async function check(state, config) {
  if (state.done) return {};
  const spec = specOf(state.section);
  let exists = state.current.exists;
  if (spec.singleton && exists === undefined) {
    exists = (await config.configurable.tools.call("get_section_record", { section: spec.id })).exists;
  }
  const missing = missingFields(spec, state.current.data, { exists });
  const empty = spec.singleton && !Object.keys(state.current.data).length;
  const problem = dateProblem(state.current.data);
  return {
    current: { ...state.current, exists, empty },
    steps: [
      ...(spec.singleton && state.current.exists === undefined ? [`Your ${spec.label} ${exists ? "exists, so this updates it" : "isn't set up yet"} (MCP get_section_record)`] : []),
      missing.length ? `Still needed: ${missing.map((field) => field.label).join(", ")}` : empty ? `Nothing to change in your ${spec.label} yet` : `All required ${spec.label} fields are filled${problem ? `, but ${problem}` : ""}`
    ]
  };
}

const needsAsking = (state) => missingFields(specOf(state.section), state.current.data, { exists: state.current.exists }).length > 0 || state.current.empty;

// For Profile, Skills and Summary with nothing to go on: an open question
// whose answer is read like a new message for that section
const OPEN_QUESTIONS = {
  profile: "What should I update in your profile? For example your phone, email, city, LinkedIn, GitHub, portfolio site, headline or the roles you're looking for.",
  summary: "What should your professional summary say? Paste it or write it here.",
  skills: "Which skills should I add? You can list several, like \"Python, LangGraph and RAG\"."
};

function ask(state) {
  const spec = specOf(state.section);
  const missing = missingFields(spec, state.current.data, { exists: state.current.exists });
  const open = OPEN_QUESTIONS[spec.id];
  // Nothing to go on yet: an open question beats asking field by field
  // (except a new profile, which needs its contact details one by one)
  const openNow = open && ((!missing.length && (state.current.empty || state.current.requestOnly)) || (state.current.requestOnly && spec.id !== "profile"));
  if (openNow) {
    return {
      done: true,
      choices: ["Cancel"],
      reply: [`${state.current.requestOnly ? `Sure. ` : ""}${OPEN_QUESTIONS[spec.id]}`],
      pending: { section: state.section, data: state.current.data, asked: "__any", queue: state.queue, sourceText: state.sourceText },
      steps: ["Asked an open question"]
    };
  }
  const field = missing[0];
  const known = spec.describe(state.current.data).replace(/\.+$/, "");
  const retry = state.current.retries > 0 && state.pending?.asked === field.name;
  const question = `${retry ? "Sorry, I couldn't read that. " : ""}${questionFor(spec, field)}`;
  const intro = state.current.requestOnly
    ? `Sure, let's add a ${spec.singular}. `
    : !state.pending && known ? `Got it: ${known}. ` : "";
  const hint = state.current.requestOnly ? ` (You can also tell me everything in one message: ${HINTS[spec.id] || "the name, dates and details"}.)` : "";

  return {
    done: true,
    choices: [...choicesFor(field), "Cancel"],
    reply: [`${intro}${question}${hint}`],
    pending: {
      section: state.section,
      data: state.current.data,
      asked: field.name,
      retries: state.current.retries || 0,
      queue: state.queue,
      sourceText: state.sourceText
    },
    steps: [`Asked for: ${field.label}`]
  };
}

async function dedupe(state, config) {
  const { tools } = config.configurable;

  // Skills: compared like the Skills page does, ignoring case and spacing
  if (state.section === "skills") {
    const check = await tools.call("check_skill", { name: state.current.data.name });
    const sameInMessage = (state.added || []).some((item) => item.section === "skills" && item.summary.toLowerCase().replace(/\s+/g, " ") === check.name.toLowerCase());
    const data = { ...state.current.data };
    const steps = [];
    if (check.canonical && check.canonical !== data.name) {
      steps.push(`Used the catalog's spelling "${check.canonical}" for "${data.name}"`);
      data.name = check.canonical;
    }
    if (check.skillType && !data.skillType) data.skillType = check.skillType;
    const skip = check.existing ? `you already have it as "${check.existing.name}"`
      : check.inBuffer ? `"${check.inBuffer.name}" is already waiting in the buffer`
        : sameInMessage ? "it was in your message twice" : null;
    return {
      current: { ...state.current, data, skip, existing: check.similar.length ? { label: check.similar[0] } : null },
      steps: [...steps, skip ? `Skipped "${data.name}": ${skip} (check_skill, case-insensitive)` : check.similar.length ? `"${data.name}" looks like "${check.similar[0]}" you already have` : `"${data.name}" isn't in your skills yet (check_skill, case-insensitive)`]
    };
  }

  const { match } = await tools.call("find_existing_entry", { section: state.section, data: state.current.data });
  return {
    current: { ...state.current, existing: match },
    steps: [match ? `GraphRAG found a similar entry already in your portfolio: ${match.label}` : "GraphRAG found nothing similar in your portfolio"]
  };
}

async function buffer(state, config) {
  const { tools } = config.configurable;
  const spec = specOf(state.section);
  const { data, existing } = state.current;
  const next = state.queue[0];
  const moveOn = next ? { section: next.section, current: { data: next.data, retries: 0 }, queue: state.queue.slice(1) } : { done: true };

  // Already there: nothing goes in the buffer
  if (state.current.skip) {
    const skipped = [...(state.skipped || []), { section: state.section, summary: spec.describe(data), why: state.current.skip }];
    return {
      skipped,
      reply: next ? [] : [bufferReply(state.added || [], skipped)],
      links: next ? [] : linksFor(state.added || []),
      pending: null,
      ...moveOn
    };
  }
  const problem = dateProblem(data);
  const notes = [
    existing && `You already have "${existing.label}"${existing.when ? ` (${existing.when})` : ""}; check this isn't a repeat.`,
    problem && `Check the dates: ${problem}.`
  ].filter(Boolean);

  const { draft } = await tools.call("add_to_buffer", { section: state.section, data, sourceText: state.sourceText, notes });
  const filled = spec.fieldSpecs.filter((field) => data[field.name] !== undefined && data[field.name] !== "").map((field) => field.label);
  const added = [...(state.added || []), { section: state.section, summary: draft.summary, filled, notes }];

  return {
    added,
    reply: next ? [] : [bufferReply(added, state.skipped || [])],
    links: next ? [] : linksFor(added),
    steps: [`Saved "${draft.summary}" to the buffer zone with the MCP tool add_to_buffer`],
    pending: null,
    ...moveOn
  };
}

const linksFor = (added) => [...new Set(added.map((item) => item.section))].map((id) => ({ label: `Review in ${specOf(id).label}`, to: specOf(id).route }));

const listText = (items) => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

// One reply for everything this message added, and what it left out
function bufferReply(added, skipped = []) {
  const skippedText = skipped.length
    ? `${added.length ? " " : ""}I didn't add ${listText(skipped.map((item) => `"${item.summary}"`))}: ${[...new Set(skipped.map((item) => item.why))].length === 1 ? skipped[0].why : skipped.map((item) => `${item.summary} (${item.why})`).join("; ")}.`
    : "";
  if (!added.length) return `Nothing new to add. ${skippedText.trim()}`;
  return addedReply(added) + skippedText;
}

function addedReply(added) {
  const spec = specOf(added[0].section);
  const notes = added.flatMap((item) => item.notes);
  const tail = `${notes.length ? ` ${notes.join(" ")}` : ""}`;
  if (spec.singleton) {
    return `I've prepared an update to your ${spec.label} (${added[0].filled.join(", ")}).${tail} Check it on the ${spec.label} page and confirm it to apply it.`;
  }
  if (added.length > 1) {
    return `I've put ${listText(added.map((item) => `"${item.summary}"`))} in your ${spec.label} buffer.${tail} Check them on the ${spec.label} page and confirm each one to add it to your portfolio.`;
  }
  return `I've put "${added[0].summary}" in your ${spec.label} buffer (${added[0].filled.join(", ")}).${tail} Check it on the ${spec.label} page and confirm it to add it to your portfolio.`;
}

const dataEntryGraph = new StateGraph(State)
  .addNode("understand", understand)
  .addNode("check", check)
  .addNode("ask", ask)
  .addNode("dedupe", dedupe)
  .addNode("buffer", buffer)
  .addEdge(START, "understand")
  .addNode("fresh", (state, config) => understand({ ...state, pending: null, restart: false }, config).then((update) => ({ ...update, restart: false })))
  .addConditionalEdges("understand", (state) => (state.done ? END : state.restart ? "fresh" : "check"))
  .addConditionalEdges("fresh", (state) => (state.done ? END : "check"))
  .addConditionalEdges("check", (state) => {
    if (state.done) return END;
    return needsAsking(state) ? "ask" : "dedupe";
  })
  .addEdge("dedupe", "buffer")
  .addConditionalEdges("buffer", (state) => (state.done ? END : "check"))
  .addEdge("ask", END)
  .compile();

// Returns { reply, choices, links, steps, pending } for the chat
async function runDataEntry({ text, pending = null, section = null, llm = null, tools, signal }) {
  const state = await dataEntryGraph.invoke(
    { text, pending, section },
    { configurable: { llm, tools, signal }, signal, recursionLimit: 40 }
  );
  return {
    reply: state.reply.join("\n\n"),
    choices: state.choices,
    links: state.links,
    steps: state.steps,
    pending: state.pending === undefined ? pending : state.pending
  };
}

module.exports = { runDataEntry, dataEntryGraph, ruleExtract, grounded, groundedValues, MONTHS };
