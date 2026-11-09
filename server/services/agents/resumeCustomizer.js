const { StateGraph, Annotation, START, END } = require("@langchain/langgraph");
const { readLayoutAsks, layoutChanges } = require("./resumeLayout");
const { planResume, ruleChanges } = require("./designPlanner");
const { planViaA2A } = require("../../a2a/designerClient");
const { effectiveResumeSettings } = require("./resumeSettingsRules");
const { analyze, describeCorrections, fixCommandWords, isKnownWord } = require("../nlp/wordAnalyzer");
const { predict } = require("../nlp/trainedModels");

// The resume customizer: the AI chat on each designed resume, as a LangGraph
// workflow:
//
//   understand → find entries → apply → reply
//
// understand  the word analyzer fixes typos and shorthand (NLTK dictionary plus
//             the user's own entry names); then rules (the same resume planner
//             the main chat uses, plus entry and colour wording); then the
//             trained models (ml/train.py) say what kind of request it is; only
//             if those find nothing and Ollama is running, the language model
//             reads the message as JSON, checked field by field. A colour goes to the Portfolio Designer
//             agent over A2A, or the same rules in-process.
// find        names like "the Blood Bank project" are found with the MCP
//             tools list_entries (labels) and search_portfolio (hybrid RAG
//             plus GraphRAG facts), so "projects that use LangGraph" works too.
// apply       MCP tools only: update_resume_settings (this resume, or all of
//             them) and set_entry_visibility (every resume, or the portfolio).
// reply       says what changed, and how it was understood.
//
// Every step has a fallback: no model -> rules; no A2A agent -> in-process
// colours; no embedding model -> keyword search.

const SECTION_WORDS = {
  experience: /\b(jobs?|experiences?|roles?|positions?|work)\b/i,
  education: /\b(schools?|educations?|degrees?|universit(?:y|ies)|colleges?)\b/i,
  projects: /\bprojects?\b/i,
  certifications: /\b(certifications?|certificates?|certs?)\b/i,
  achievements: /\b(achievements?|awards?)\b/i,
  volunteering: /\bvolunteer(?:ing)?\b/i,
  publications: /\b(publications?|papers?)\b/i,
  patents: /\bpatents?\b/i,
  interests: /\b(interests?|hobb(?:y|ies))\b/i,
  recommendations: /\b(recommendations?|testimonials?|references?)\b/i,
  skills: /\bskills?\b/i
};
// Search document ids ("project:<id>") -> entry sections
const DOC_SECTION = { experience: "experience", education: "education", project: "projects", certifications: "certifications", achievements: "achievements", volunteering: "volunteering", publications: "publications", patents: "patents", interests: "interests" };

const HIDE = /\b(?:hide|remove|drop|delete|kill|erase|scrap|strip|tak(?:e|en) (?:off|out|away)|leave (?:off|out)|get rid of|ditch|lose|omit|skip|cut|no need for|don'?t (?:show|include|want|need)|do not (?:show|include|want|need)|exclude|without)\b/i;
const SHOW = /\b(?:show|add (?:back)?|include|bring back|put back|unhide|restore)\b/i;
const EVERY_RESUME = /\b(?:all|every|each)\s+(?:of\s+)?(?:my\s+)?r[eé]sum[eé]s?\b|\beverywhere\b|\bon all\b/i;
const PORTFOLIO = /\b(?:portfolio|website|site)\b/i;
const RESET = /\b(?:reset|start over|undo all|back to (?:the )?default)\b/i;
const STATUS = /^\s*(?:what(?:'s| is)|show me|list)\b.*\b(?:on|in)\s+(?:this|my)\s+r[eé]sum[eé]\b|\bsettings\b|\bwhat (?:did|have) i (?:hide|hidden|change|changed|remove|removed)\b|\bwhat(?:'s| is) (?:hidden|left off)\b/i;
const SMALL_TALK = /^\s*(?:hello|hi|hey|hiya|good (?:morning|afternoon|evening|night)|thanks|thank you|bye|goodbye|ok|okay|cool|great|nice)\b[\s!.]*(?:there|a lot|so much)?[\s!.]*$/i;
const asksColour = (text) => /\b(?:make|change|use|recolou?r|turn|set|switch|colou?r|accent|paint|can it be|want it)\b/i.test(text) || text.trim().split(/\s+/).length <= 2;
const COLOUR_WORDS = /\b(colou?r|accent|navy|blue|green|red|teal|purple|violet|pink|orange|amber|gold|black|gr[ae]y|brown|maroon|crimson|#[0-9a-f]{3,6})\b/i;
// Moving a section between columns: "move Education to the right column"
const COLUMN_SECTIONS = { ...SECTION_WORDS, summary: /\b(?:summary|profile|objective)\b/i };
const SECTIONS_NAMED = new RegExp(Object.values(COLUMN_SECTIONS).map((words) => words.source).join("|"), "i");
const COLUMN_PLACE = /\b(to|in|into|on|onto|at)?\s*(?:the\s+|my\s+)?(left|right|sidebar|side|main|narrower|narrow|smaller|small|wider|wide|bigger|big|larger|large)(?:[- ]?hand)?(\s+(?:column|col|side|sidebar|bar|panel|part|area))?\b/i;
const MOVE_VERB = /\b(?:move|shift|put|place|keep|send|show|have|want|make|switch|add|like)\b/gi;
const STAYS_THERE = /\b(?:(?:should|must|can|could|needs? to|has to|have to)\s+)?(?:be|go|goes|stay|stays|sit|sits)\s*$/i;
const NOT_A_NAME = new Set("section sections whole both can you please also then just back summary profile objective details detail info information".split(" "));
const PLACE_NAMES = { left: "the left column", right: "the right column", side: "the sidebar", main: "the main column" };
const placeOf = (word) => (/left/i.test(word) ? "left" : /right/i.test(word) ? "right" : /side|narrow|small/i.test(word) ? "side" : "main");
const MODEL_PLACE_WORDS = { left: /left/, right: /right/, side: /side|narrow|small/, main: /main|wide|big|large/ };
const OPTIONAL_SECTIONS = ["achievements", "volunteering", "publications", "patents", "interests", "recommendations"];
const titleOf = (id) => id[0].toUpperCase() + id.slice(1);
// One detail of an entry: "remove the grade in MS" keeps the degree. Every detail
// a resume shows, by section. clear: words that can't also mean a whole section.
const FIELD_LIST = {
  grade: { name: "the grade", sections: ["education"], clear: ["grades?", "c?gpas?", "marks?", "percentages?", "scores?", "cpi"] },
  location: { name: "the location", sections: ["experience", "education"], clear: ["locations?", "city", "cities", "places?"] },
  dates: { name: "the dates", sections: ["experience", "education", "projects", "certifications", "achievements", "volunteering", "publications", "patents", "recommendations"], clear: ["dates?", "years?", "durations?", "timelines?", "time periods?", "periods?", "start and end dates?"] },
  description: { name: "the description", sections: ["experience", "projects", "achievements", "volunteering", "recommendations"], clear: ["descriptions?", "overviews?", "recommendation text", "quotes?", "job summar(?:y|ies)", "project summar(?:y|ies)"], unclear: ["text", "about"] },
  bullets: { name: "the bullet points", sections: ["experience", "projects"], clear: ["bullet points?", "bullets?", "points", "tasks?", "responsibilit(?:y|ies)", "duties"] },
  role: { name: "the role", sections: ["experience", "projects", "volunteering", "recommendations"], clear: ["job titles?", "role names?", "designations?", "recommender titles?"], unclear: ["roles?", "positions?", "titles?"] },
  issuer: { name: "the organization name", sections: ["experience", "education", "certifications", "achievements", "volunteering", "publications", "patents", "recommendations"], clear: ["issuers?", "issuing (?:organi[sz]ation|authority|company)", "organi[sz]ations?(?: names?)?", "org(?: names?)?", "providers?", "authority", "company names?", "employer names?", "publishers?", "university names?", "college names?", "school names?", "institution names?", "patent numbers?", "patent nos?", "patent status"], unclear: ["compan(?:y|ies)", "employers?", "universit(?:y|ies)", "colleges?", "schools?", "institutions?", "institutes?", "status"] },
  degree: { name: "the degree name", sections: ["education"], clear: ["degree names?"], unclear: ["degrees?", "qualifications?"] },
  field: { name: "the field of study", sections: ["education"], clear: ["fields? of study", "majors?", "speciali[sz]ations?"], unclear: ["subjects?", "branch(?:es)?", "streams?"] },
  source: { name: "the project label", sections: ["projects"], clear: ["project labels?", "project types?", "personal project label"], unclear: ["source", "label", "type"] }
};
const FIELDS = Object.fromEntries(Object.entries(FIELD_LIST).map(([id, field]) => [id, { ...field, words: new RegExp(`^(?:${[...field.clear, ...(field.unclear || [])].join("|")})$`, "i") }]));
const byLength = (list) => [...list].sort((a, b) => b.length - a.length).join("|");
// Certain to be a detail, wherever it's said
const FIELD_WORD = byLength(Object.values(FIELD_LIST).flatMap((field) => field.clear));
// A detail only when an entry or section is named: "remove the role in Oracle",
// while "remove my degrees" is still the whole section
const NAMED_FIELD_WORD = byLength(Object.values(FIELD_LIST).flatMap((field) => field.unclear || []));
const isUnclearWord = (word) => new RegExp(`^(?:${NAMED_FIELD_WORD})$`, "i").test(word);
// What each section can lose, in words
const detailsOf = (section) => Object.values(FIELD_LIST).filter((field) => field.sections.includes(section)).map((field) => field.name);
const listOfWords = (list) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0] || "");
// Words that already say which section: "remove publisher" is Publications only
const WORD_SECTIONS = [
  [/^(?:publishers?)$/i, ["publications"]],
  [/^patent/i, ["patents"]],
  [/^(?:status)$/i, ["patents"]],
  [/^(?:compan|employer|job title|designation)/i, ["experience"]],
  [/^(?:universit|college|school|institut|grades?|c?gpa|marks|percentage|degree|major|speciali|fields? of study)/i, ["education"]],
  [/^(?:issu|providers?|authority)/i, ["certifications", "achievements"]],
  [/^(?:project)/i, ["projects"]],
  [/^(?:recommendation text|quotes?|recommender)/i, ["recommendations"]]
];
const sectionsSaidBy = (words) => {
  const lists = words.map((word) => WORD_SECTIONS.find(([pattern]) => pattern.test(word))?.[1]);
  return lists.every(Boolean) ? [...new Set(lists.flat())] : null;
};
// Details that can't come off one by one yet: named, these still mustn't hide the entry
const OTHER_PART = "links?|urls?";
const ALL_ENTRIES = /^(?:everything|everywhere|all|all entries|all of them|every entry|every one|each one|the whole resume)$/i;
const partList = (words) => `(?:${words})(?:\\s*(?:,|and|&)\\s*(?:the\\s+)?(?:${words}))*`;
const ACT = `${HIDE.source}|\\bno\\b|\\b(?:show|add(?:\\s+back)?|include|bring back|put back|unhide|restore)\\b`;
// "the grade part", "the grade section": the same detail
const PART_FILLER = "part|portion|section|field|line|info|information|details?|value|text|entry|names?";
const PART_THEN_NAME = new RegExp(`(${ACT})\\s+(?:(?:only|just|the|my|all|every|of)\\s+)*(${partList(`${FIELD_WORD}|${NAMED_FIELD_WORD}|${OTHER_PART}`)})\\b(?:\\s+(?:${PART_FILLER})\\b)?(?:\\s+back)?(\\s+(?:from|form|in|of|for|on|at|under|to)\\s+.*)?$`, "i");
const NAME_THEN_PART = new RegExp(`(${ACT})\\s+(?:(?:only|just)\\s+)?(.+?)\\s+(${partList(FIELD_WORD)})(?:\\s+(?:${PART_FILLER}))?(?:\\s+back)?$`, "i");
// How skills are drawn: "put my skills in boxes side by side"
const SKILL_STYLES = [
  ["boxes", /\b(?:box(?:es|ed)?|tags?|chips?|pills?|badges?|side by side|padding)\b/i, "as boxes side by side"],
  ["list", /\b(?:list|one per line|one by one)\b/i, "as a list"],
  ["bars", /\b(?:bars?|progress)\b/i, "as rating bars"],
  ["dots", /\b(?:dots?)\b/i, "as rating dots"],
  ["inline", /\b(?:commas?|inline|plain text|one line|single line)\b/i, "as one line of text"]
];
const skillStyleIn = (text) => (/\bskills?\b/i.test(text) && !HIDE.test(text) ? SKILL_STYLES.find(([, words]) => words.test(text))?.[0] : undefined);
// Rewording an entry: this chat chooses what a resume shows, it never rewrites
const EDIT_WORDING = /\b(?:change|rename|replace|edit|update|reword|rewrite)\b.*\b(?:to|with|as)\b/i;
// Other names for sections: read as the section before anything else
const OPTIONAL_LIST = "achievements, volunteering, publications, patents, interests and recommendations";
const sameSections = (text) => String(text || "")
  .replace(/\b(?:honou?rs?|awards?)(?=\s+(?:section|details?)\b|\s*$)/gi, "achievements")
  .replace(/\bhobby\b/gi, "hobbies")
  .replace(/\b(?:social (?:work|service)|ngo work)\b/gi, "volunteering")
  .replace(/\bresearch(?: papers?)?(?=\s*(?:section|details?)?\s*$)/gi, "publications")
  .replace(/\bcommunity (?:work|volunteering)\b/gi, "volunteering")
  .replace(/\b(?:lors?|letters? of recommendation|recommendation letters?)\b/gi, "recommendations")
  .replace(/\bvolunteer\s+part\b/gi, "volunteering")
  .replace(/\b(patent|publication|achievement|interest|recommendation)(?:s)?\s+(?:section|details?|info(?:rmation)?|part)\b/gi, "$1s")
  .replace(/\bvolunteer(?:ing)?(?:\s+(?:experiences?|details?|work|info(?:rmation)?|history|sections?))+\b/gi, "volunteering")
  .replace(/\bcommunity service\b/gi, "volunteering")
  .replace(/\bwork (?:experiences?|history)\b/gi, "experience")
  .replace(/\b(?:(?:all|the|my)\s+)*(?:other|remaining|extra|optional|additional)\s+sections?\b|\b(?:all|every|each)(?:\s+of)?\s+(?:the\s+|my\s+)?sections?\b/gi, OPTIONAL_LIST);

// Parts of the page itself, not of an entry
const PAGE_PARTS = [
  [/^(?:phone|mobile|cell|telephone|contact number|number)(?: numbers?| nos?)?$/, ["contact:phone"], "your phone number"],
  [/^(?:e-?mails?|mail)(?: address(?:es)?| ids?)?$/, ["contact:email"], "your email"],
  [/^linked ?in(?: links?| urls?| profiles?| ids?)?$/, ["contact:linkedin"], "your LinkedIn"],
  [/^git(?: ?hub)?(?: links?| urls?| profiles?| ids?)?$/, ["contact:github"], "your GitHub"],
  [/^(?:address|home address|my location|city and state|current location)$/, ["contact:location"], "your location"],
  [/^(?:portfolio|personal website|website)(?: links?| urls?| address)$|^(?:personal )?website$/, ["contact:portfolio"], "your website link"],
  [/^contact(?: details?| info(?:rmation)?| sections?)?$/, ["contact:phone", "contact:email", "contact:linkedin", "contact:github", "contact:location", "contact:portfolio"], "your contact details"],
  [/^(?:professional )?summary(?: sections?)?$|^(?:about me|objective)(?: sections?)?$/, ["page:summary"], "the Summary"],
  [/^(?:headline|tagline|head ?tag|target(?:ing)? roles?|role targeting|roles? under my name|line under my name)$/, ["page:line"], "the line under your name"]
];
const pagePartOf = (phrase) => {
  const said = String(phrase).toLowerCase().replace(/^(?:a|an|the|my)\s+/, "").trim();
  return PAGE_PARTS.find(([words]) => words.test(said));
};

// Section order: the same order the resume starts with
const DEFAULT_ORDER = ["summary", "skills", "experience", "education", "certifications", "projects", ...OPTIONAL_SECTIONS];
const sectionIn = (text) => {
  const found = Object.keys(COLUMN_SECTIONS).filter((id) => COLUMN_SECTIONS[id].test(text));
  return found.length === 1 ? found[0] : null;
};
// "put projects before experience", "move skills to the top", "swap education and experience"
function readOrder(text) {
  const swap = text.match(/\b(?:swap|switch|exchange|flip)\s+(.+?)\s+(?:and|with|for)\s+(.+)$/i);
  if (swap && sectionIn(swap[1]) && sectionIn(swap[2]) && !/\bcolumns?\b/i.test(text)) return { swap: [sectionIn(swap[1]), sectionIn(swap[2])] };
  const pair = text.match(/(.+?)\s+(before|above|ahead of|in front of|after|below|under|beneath)\s+(.+)$/i);
  if (pair && sectionIn(pair[1]) && sectionIn(pair[3]) && sectionIn(pair[1]) !== sectionIn(pair[3]) && !HIDE.test(pair[1])) {
    return { place: sectionIn(pair[1]), [/after|below|under|beneath/i.test(pair[2]) ? "after" : "before"]: sectionIn(pair[3]) };
  }
  const end = text.match(/(.+?)\s+(?:(?:to|at|on)\s+(?:the\s+|very\s+)*)?(top|first|start|beginning|bottom|last|end)\b(?:\s+of\b.*)?\s*(?:please)?\s*$/i);
  if (end && sectionIn(end[1]) && !HIDE.test(end[1]) && !/\b(?:\d+|only|latest|recent)\b/i.test(end[1])) return { place: sectionIn(end[1]), [/top|first|start|beginning/i.test(end[2]) ? "first" : "last"]: true };
  return null;
}
function reordered(current, ask) {
  const order = [...new Set([...current, ...DEFAULT_ORDER])];
  if (ask.swap) {
    const [a, b] = ask.swap.map((id) => order.indexOf(id));
    [order[a], order[b]] = [order[b], order[a]];
    return order;
  }
  const rest = order.filter((id) => id !== ask.place);
  if (ask.first) return [ask.place, ...rest];
  if (ask.last) return [...rest, ask.place];
  const at = rest.indexOf(ask.before || ask.after);
  rest.splice(ask.before ? at : at + 1, 0, ask.place);
  return rest;
}
const orderText = (ask) => (ask.swap ? `swapped ${titleOf(ask.swap[0])} and ${titleOf(ask.swap[1])}`
  : ask.first ? `${titleOf(ask.place)} first` : ask.last ? `${titleOf(ask.place)} last`
    : `${titleOf(ask.place)} ${ask.before ? `before ${titleOf(ask.before)}` : `after ${titleOf(ask.after)}`}`);

// What this chat can't do, with what can. Checked only when nothing real was
// done, so an entry that's really called "Photo Gallery" is still found first.
const SECTIONS_AVAILABLE = "Achievements, Volunteering, Publications, Patents, Interests and Recommendations";
const CANT_DO = [
  [/^\W*(?:remove|hide|delete|drop)\s+(?:my\s+|the\s+)?(?:full\s+)?name\W*$/i, () => `A resume needs your name, so I won't remove it. To change it: "change my name to ...".`],
  [/\b(?:section (?:headings?|titles?|names?)|headings?)\b.*\b(?:remove|hide)\b|\b(?:remove|hide)\b.*\b(?:section (?:headings?|titles?)|headings?)\b/i, () => `I can't remove a section's heading yet, but I can rename it: "rename Experience to Work History".`],
  [/\b(?:order|sequence|arrangement|rearrange|re-?order)\b/i, () => `Tell me which section goes where, like "put Projects before Experience", "move Skills to the top" or "swap Education and Experience".`],
  [/\b(?:languages?|courses?|coursework)\b/i, () => `Resumes don't have that section yet. The ones I can add are ${SECTIONS_AVAILABLE}.`],
  [/\b(?:photos?|pictures?|headshot|avatar|profile pic)\b/i, () => "I can't add or remove a photo here. Some designs include a picture spot: pick one from the resume gallery."],
  [/\b(?:fonts?|typeface|serif|bold|italics?|underline|text size|font size|name bigger|bigger name|name smaller)\b/i, () => `I can't change the font itself yet: each design has its own, so another design from the gallery is the way to change it. I can change its size: "make the text bigger" or "font smaller by 5%".`],
  [/\b(?:one|1|single|two|2)[- ]pages?\b|\b(?:shorter|too long|so long|fewer pages)\b/i, () => `I can't force a page count, but I can shorten it: try "only 1 project", "only 2 jobs", or "remove the description from" an entry.`],
  [/\b(?:spacing|margins?|padding|gaps?|sidebar (?:wider|narrower|bigger|smaller)|(?:wider|narrower) sidebar)\b/i, () => `Tell me how it should change: "make the right column wider by 5%", "wider margins", "tighter spacing" or "more gap between the columns".`],
  [/\b(?:one|1|single|two|2) columns?\b|\b(?:remove|without|no) (?:the )?sidebar\b|\b(?:different|another|other|new|change) (?:the )?(?:template|design|layout)\b/i, () => "This resume keeps its design's layout. Pick a one-column or two-column design from the resume gallery."],
  [/\b(?:dark mode|black and white|grayscale|greyscale)\b/i, () => `Resumes print on white, so there's no dark mode. I can change the accent colour: try "make it navy", or "default colour".`],
  [/\b(?:translate|spanish|french|german|hindi|telugu|chinese|japanese)\b/i, () => "I can't translate a resume yet. It uses the wording in your portfolio."],
  [/\b(?:download|pdf|docx?|print|export|save (?:it|this))\b/i, () => "Use the Download button at the top of this resume. It saves the page as you see it."],
  [/\b(?:e-?mail|send|share|post|upload|apply)\b.*\b(?:this|it|resume|boss|recruiter|job|hr|company|linkedin)\b/i, () => "I can't send or post anything. Download the resume and send it yourself."],
  [/\b(?:tailor|customi[sz]e .* for|target .* job|for (?:a|an|the) .* (?:job|role|position))\b/i, () => "I can't tailor it to a job here. Job Match scores your resume against a job, and the CV Maker builds a version for it. Here, I can hide what doesn't fit."],
  [/\b(?:skills?\b.*\b(?:rated|rating|below|above|low|high|soft|technical|ai)\b|(?:soft|technical|low[- ]rated) skills?|second|third|first|oldest|newest|latest|recent|last|older)\b/i, () => `I can't pick by rating, type or position yet. Name it instead, like "hide Docker", or use a count, like "only 2 jobs".`],
  [/\b(?:add|put)\b.*\b(?:to|in|into) my (?:skills|experience|education|projects|certifications|portfolio)\b|\badd\s+(?:a\s+)?skill\b|\bmy (?:job|role|degree|project)\b.*\b(?:ended|started|finished|changed)\b/i, () => "This chat only chooses what a resume shows. To add or change your information, tell the main assistant or use your Dashboard."],
  [/\b(?:delete|remove|close)\b.*\b(?:my )?(?:account|profile|resume)\b$|\bdrop table\b|\bdelete (?:everything|all)\b|\bremove (?:everything|all)\b|\bhide (?:everything|all)\b|\bclear (?:it )?all\b/i, () => `I won't remove everything from one sentence, and nothing changed. Name what should go, or say "reset this resume" to undo this resume's changes.`],
  [/^\s*(?:undo(?: that| it| this)?|go back|revert(?: that| it)?|put it back|bring it back|hide (?:it|that)|remove (?:it|that|this|that one|this one)|do it|do that|yes|yeah|yep|no|nope|never mind|nevermind|cancel|same|again|that one|why did you do that)\s*[.!?]*\s*$/i, () => `I don't remember earlier messages, so tell me exactly what you mean, like "put back Blood Bank", or "reset this resume" to undo all of this resume's changes. Nothing changed.`],
  [/\b(?:show (?:more|less)|make it (?:better|pop|nicer|prettier|cleaner|modern|professional|good)|look (?:better|modern|professional|good|nice)|more modern|more professional|ugly|bad|hate|not good|feels? off|boring|plain)\b/i, () => `Tell me what to change and I'll do it. A few ideas: "make it navy", "skills in boxes", "only 2 projects", "move Education to the right column".`],
  [/^\s*(?:who are you|what are you|are you (?:an? )?(?:ai|bot|human|real)|what can you do|help|how does this work|how do i use this)\b/i, () => `I'm the agent for this one resume. I can hide or bring back entries, remove details like a grade or your phone number, change how many jobs and projects it shows, add sections, move and reorder them, change how skills look, recolour it, and answer questions about your portfolio.`],
  [/\b(?:pathetic|useless|stupid|dumb|idiot|sucks?|trash|garbage|wtf|worst)\b/i, () => `Sorry about that. Tell me what went wrong and what you wanted, for example "remove the dates from Patents" or "add Recommendations". Nothing changed.`],
  [/^\s*(?:add|remove|hide|show|delete|fix(?: it)?|add (?:something|all|stuff)|remove (?:something|stuff)|help(?: me)?|bro|pls|please|details|fields|hmm+ ok)\s*[.!?]*\s*$/i, () => `What should I change? For example "add Patents", "remove the dates from Volunteer Details", or "skills in boxes". Nothing changed.`],
  [/^\s*(?:lol|haha+|hmm+|ok+|okay|cool|nice|great|wow|tell me a joke)\b/i, () => `I'm better at resumes than jokes. Tell me what to change, or ask "what's on this resume?".`]
];
const cantDoReply = (text) => CANT_DO.find(([words]) => words.test(text))?.[1]();
const QUESTION = /^\s*(?:what|what's|whats|where|when|why|who|whom|how|which|do|does|did|is|are|am|was|were|will|would|should|could|can i|can this|has|have i)\b|\?\s*$/i;
const ANSWER_PROMPT = [
  "You answer one question about the user's resume, in at most three plain sentences.",
  "Use only the facts in the JSON you are given (portfolio entries found, and what this resume shows). Never invent a fact.",
  "If the facts don't answer it, say you couldn't find that in their portfolio. Advice about the resume is fine; other topics aren't: say you only help with this resume.",
  'Reply with JSON only: {"answer": "..."}'
].join("\n");
// ---- Resume-only wording: never touches the portfolio ----
const clip = (value) => String(value || "").replace(/^[\s"'“”‘’]+|[\s"'“”‘’.,!]+$/g, "");
const untilResume = (value) => clip(String(value).replace(/\s+(?:on|in|for|from)\s+(?:(?:this|my|the|all|every|each|of)\s+)*(?:r[eé]sum[eé]s?|cv)\b.*$/i, "").replace(/\s+(?:only|please|thanks)\s*$/i, ""));
const RESTORE_WORDING = /\b(?:restore|revert|undo|remove|clear|bring back|put back|back to)\b.*\b(?:original|rewrites?|rewordings?|wordings?|my edits?)\b|\boriginal (?:wording|text)\b/i;
const CONTACT_WORDS = [["phone", /^(?:phone|mobile|cell|contact)(?: number)?$/i], ["email", /^e-?mail(?: address| id)?$/i], ["name", /^(?:full )?name$/i], ["location", /^(?:location|address|city)$/i], ["linkedin", /^linked ?in(?: link| url)?$/i], ["github", /^git ?hub(?: link| url)?$/i]];
const CHANGE_VERB = "change|changing|rename|replace|update|edit|correct|fix|make|set|rewrite|reword|switch";
const AS_NEW = "to say|to read|to|with|into|as";

// "change X to Y", "X change it to Y", "X should read Y", "rewrite my summary".
// Reads the user's own words, so the new text stays exactly as typed.
function readRewrite(message) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (RESTORE_WORDING.test(text)) return { clear: true };

  const summaryTo = text.match(new RegExp(`\\b(?:${CHANGE_VERB})\\s+(?:my |the )?(?:professional )?summary\\s+(?:${AS_NEW})[:\\s]+(.+)$`, "i"));
  if (summaryTo) return { summary: untilResume(summaryTo[1]) };
  const lineTo = text.match(new RegExp(`\\b(?:${CHANGE_VERB})\\s+(?:my |the )?(?:headline|tagline|head ?tag|target roles?|line under my name)\\s+(?:${AS_NEW})[:\\s]+(.+)$`, "i"));
  if (lineTo) return { line: untilResume(lineTo[1]) };

  const write = /\b(?:rewrite|re-?word|re-?phrase|improve|polish|tighten|shorten|enhance|write (?:a )?(?:better|new|stronger|shorter)|make (?:my |the )?summary (?:better|stronger|shorter|sound)|better)\b/i;
  if (write.test(text) && /\bsummary\b/i.test(text) && !/\b(?:to|as)\s+say\b/i.test(text)) return { generate: "summary" };

  // "X change it to Y" before "change X to Y", or X would read as "it"
  const calledSection = text.match(/\bcall\s+(?:the\s+|my\s+)?(\w+)(?:\s+section)?\s+(?:as\s+)?(.+)$/i);
  if (calledSection && sectionIn(calledSection[1]) && !/^something\b/i.test(calledSection[2])) return { titles: { [sectionIn(calledSection[1])]: untilResume(calledSection[2]) } };

  const pair = text.match(new RegExp(`^(?:.*?\\b(?:like|in \\w+)\\s+)?(.+?)\\s+(?:(?:please\\s+)?(?:change|make|rename|replace)\\s+(?:it|that|this)\\s+(?:${AS_NEW})|should\\s+(?:say|read|be|look like)|must\\s+(?:say|read))[:\\s]+(.+)$`, "i"))
    || text.match(new RegExp(`\\b(?:${CHANGE_VERB})\\s+(.+?)\\s+(?:${AS_NEW})[:\\s]+(.+)$`, "i"));
  if (!pair) {
    const entry = text.match(/\b(?:rewrite|re-?word|re-?phrase|improve|polish|tighten|shorten)\s+(?:the\s+|my\s+)?(?:(?:description|bullets?|points?|text|wording)\s+(?:of|for|in|on)\s+(?:the\s+|my\s+)?)?(.+)$/i);
    return entry && !/^(?:it|this|that|everything|all)\b/i.test(entry[1]) ? { generate: "entry", phrase: untilResume(entry[1]) } : null;
  }
  const from = clip(pair[1].replace(/^(?:(?:the|my)\s+)?(?:(?:title|name|wording|text|heading)\s+(?:of|for)\s+)?(?:(?:the|my)\s+)?/i, "").replace(/\s+(?:heading|title|section)$/i, ""));
  const to = untilResume(pair[2]);
  if (!to || /^(?:it|this|that)$/i.test(from) || /^something\b/i.test(to)) return { unclear: true };
  const contact = CONTACT_WORDS.find(([, words]) => words.test(from));
  if (contact) return { contact: { [contact[0]]: to } };
  const section = Object.keys(COLUMN_SECTIONS).find((id) => COLUMN_SECTIONS[id].test(from) && !keywordsOf(from).filter((word) => !NOT_A_NAME.has(word)).length);
  if (section) return { titles: { [section]: to } };
  return { replace: { from, to } };
}

const escapeForRegExp = (value) => String(value).replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
const wholeWords = (value) => new RegExp(`(?<![\\w])${escapeForRegExp(value)}(?![\\w])`, "gi");
// Every piece of text a resume is filled from
const allText = (value) => (typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(allText) : value && typeof value === "object" ? Object.entries(value).filter(([key]) => !["id", "_id"].includes(key)).flatMap(([, item]) => allText(item)) : []);
const placesOf = (source, from) => allText(source).reduce((count, text) => count + (text.match(wholeWords(from)) || []).length, 0);

// New text from the language model keeps only facts that were there: a number
// or a name that isn't in the source means it made something up
function inventedIn(written, source) {
  // Whole numbers and words: "12" isn't there just because a phone number has it
  const known = allText(source).join(" ");
  const numbers = written.match(/\d+(?:[.,]\d+)*/g) || [];
  // A capital on a plain English word is only style ("Reduced"), unless it follows
  // a word that introduces a name ("at Apple")
  const introduced = [...written.matchAll(/\b(?:at|for|with|using|from|by|in)\s+([A-Z][\w+#-]*)/g)].map((match) => match[1]);
  const capitals = (written.match(/(?<=[a-z,] )[A-Z][\w+#.-]*/g) || []).map((word) => word.replace(/[.,]+$/, "")).filter((word) => !isKnownWord(word.toLowerCase()));
  const names = [...introduced, ...capitals];
  return [...numbers, ...names].filter((word) => !new RegExp(`(?<![\\w.-])${escapeForRegExp(word)}(?![\\w-])`, "i").test(known));
}
const WRITE_PROMPT = [
  "You rewrite text for one person's resume, following \"instruction\". Use only what each line in \"rewrite\" already says. Never add a number, employer, tool, degree, name or claim, and don't bring in anything else.",
  "Be concise, direct and professional, with no first person and no filler.",
  'Reply with JSON only: {"lines": ["..."]}, one rewritten line for each line in "rewrite", in the same order.'
].join("\n");

async function applyRewrite(plan, config, steps) {
  const { tools, llm, signal, designId } = config.configurable;
  const ask = plan.rewrite;
  const everywhere = plan.scope === "all" || !designId;
  const onWhere = everywhere ? "on every resume" : "on this resume only";
  const kept = "Your portfolio keeps the original. Say \"restore the original wording\" to undo it.";
  if (plan.scope === "portfolio") return { answer: "I only reword resumes here, so your portfolio stays as it is. Edit portfolio text on your Dashboard. Nothing changed." };
  if (ask.unclear) return { answer: `Tell me the exact old text and the new text, like "change AWS Solutions Architect to AWS Architect". Nothing changed.` };
  const save = async (rewrite) => {
    await tools.call("update_resume_settings", { ...(everywhere ? {} : { designId }), rewrite });
    steps.push(`Saved ${everywhere ? "for every resume" : "for this resume only"} with the MCP tool update_resume_settings; the portfolio wasn't touched`);
  };
  if (ask.clear) {
    await save({ clear: true });
    return { done: [`back to your original wording ${everywhere ? "on every resume" : "on this resume"}`] };
  }
  if (ask.contact) {
    await save({ contact: ask.contact });
    const [[id, value]] = Object.entries(ask.contact);
    return { done: [`your ${id} now reads "${value}" ${onWhere}`], note: ` ${kept}` };
  }
  if (ask.titles) {
    await save({ titles: ask.titles });
    const [[id, value]] = Object.entries(ask.titles);
    return { done: [`the ${titleOf(id)} heading now reads "${value}" ${onWhere}`], note: ` ${kept}` };
  }
  if (ask.summary || ask.line) {
    await save(ask.summary ? { summary: ask.summary } : { line: ask.line });
    return { done: [`${ask.summary ? "your summary" : "the line under your name"} now reads "${ask.summary || ask.line}" ${onWhere}`], note: ` ${kept}` };
  }

  const source = await tools.call("get_resume_text");
  steps.push("Read your resume text with the MCP tool get_resume_text");

  if (ask.generate) {
    if (!llm) return { answer: `Writing new text needs the language model, which isn't running (start Ollama). You can give me the text yourself: "change my summary to ...". Nothing changed.` };
    const { entries } = await tools.call("list_entries");
    const named = ask.generate === "entry" && entries.filter((entry) => nameScore(entry.label, keywordsOf(ask.phrase).join(" ")) > 0.5).sort((a, b) => nameScore(b.label, ask.phrase) - nameScore(a.label, ask.phrase))[0];
    if (ask.generate === "entry" && !named) return { answer: `I couldn't find "${ask.phrase}" on your resume, so nothing changed.` };
    const lists = { experience: source.experiences, projects: source.projects, education: source.educations };
    const item = named && [...(lists[named.section] || []), ...(source.experiences || []).flatMap((job) => job.projects || [])].find((row) => String(row.id) === String(named.id));
    const original = ask.generate === "summary" ? [source.summary] : [item?.summary, item?.description, ...(item?.bullets || [])].filter(Boolean);
    if (!original.filter(Boolean).length) return { answer: "There's no text there to rewrite yet, so nothing changed. Tell me the words to use instead." };
    let lines;
    try {
      lines = (await llm.invokeJson(WRITE_PROMPT, { instruction: plan.said, rewrite: original }, signal))?.lines;
    } catch (error) {
      if (signal?.aborted) throw error;
    }
    // A summary is one text, however many lines the model split it into
    if (ask.generate === "summary" && Array.isArray(lines)) lines = [lines.filter((line) => typeof line === "string").join(" ")];
    const good = Array.isArray(lines) && lines.length === original.length && lines.every((line) => typeof line === "string" && line.trim());
    const invented = good ? inventedIn(lines.join(" "), source) : [];
    // It should be about as long as what it replaces, and shorter when asked
    const wordCount = (list) => list.join(" ").split(/\s+/).filter(Boolean).length;
    const limit = /\b(?:short|shorter|shorten|tighten|brief|concise)\b/i.test(plan.said) ? wordCount(original) - 1 : wordCount(original) * 1.3 + 8;
    if (good && !invented.length && wordCount(lines) > limit) {
      steps.push("The language model's text was too long, so it was thrown away");
      return { answer: "The language model's text came out longer than it should be, so I threw it away and changed nothing. Try again, or give me the words yourself." };
    }
    if (!good || invented.length) {
      steps.push(good ? `The language model added facts that aren't yours (${invented.slice(0, 4).join(", ")}), so its text was thrown away` : "The language model didn't return usable text");
      return { answer: good ? `The language model added things that aren't in your portfolio (${invented.slice(0, 4).join(", ")}), so I threw that text away and changed nothing. Try again, or give me the words yourself.` : "I couldn't get usable text from the language model, so nothing changed. Try again, or give me the words yourself." };
    }
    steps.push("Written by the language model (LangChain + Ollama), checked for invented numbers and names");
    if (ask.generate === "summary") {
      await save({ summary: lines[0].trim() });
      return { done: [`your summary now reads "${lines[0].trim()}" ${onWhere}`], note: ` ${kept}` };
    }
    for (const [index, line] of lines.entries()) if (line.trim() !== original[index]) await save({ replace: { from: original[index], to: line.trim() } });
    return { done: [`rewrote ${named.label} ${onWhere}`], note: ` ${kept}` };
  }

  // "change X to Y": X has to really be there
  const { from, to } = ask.replace;
  // "Certificate Microsoft" -> "Certificate": dropping what's after a title is
  // its organization name coming off, not a change to the title
  if (to.length < from.length && from.toLowerCase().startsWith(to.toLowerCase())) {
    const rest = from.slice(to.length).trim().toLowerCase();
    const certificate = (source.certifications || []).find((item) => String(item.title).toLowerCase() === to.toLowerCase() && String(item.subtitle || "").toLowerCase() === rest);
    if (certificate) {
      await tools.call("update_resume_settings", { ...(everywhere ? {} : { designId }), hideFields: [`certifications:${certificate.id}:issuer`] });
      return { done: [`removed the organization name from ${to} ${onWhere}`] };
    }
  }
  const candidates = [from, analyze(from, { vocabulary: allText(source).slice(0, 400) }).corrected];
  const found = candidates.find((text) => placesOf(source, text));
  if (!found) return { answer: `I couldn't find "${from}" on your resume, so nothing changed. Use the exact words as they appear.` };
  const places = placesOf(source, found);
  await save({ replace: { from: found, to } });
  return { done: [`"${found}" now reads "${to}"${places > 1 ? ` in ${places} places` : ""} ${onWhere}`], note: ` ${kept}` };
}

// Is this question about the user, this resume or something in their portfolio?
const aboutThem = (text, vocabulary) => /\b(?:i|i'm|im|me|my|mine|this|it|resume|cv|portfolio|ats|recruiters?|interview)\b/i.test(text)
  || Object.values(COLUMN_SECTIONS).some((words) => words.test(text))
  || (vocabulary || []).some((label) => keywordsOf(label).some((word) => word.length > 2 && new RegExp(`\\b${word.replace(/[^a-z0-9]/g, "")}\\b`, "i").test(text)));
const FIELD_SECTION_NAMES = { experience: "Experience", education: "Education", projects: "Projects", certifications: "Certifications", achievements: "Achievements", volunteering: "Volunteering", publications: "Publications", patents: "Patents", recommendations: "Recommendations" };
const inPlaces = (columns) => Object.entries(columns).map(([id, place]) => `${titleOf(id)} in ${PLACE_NAMES[place]}`);

const MODEL_PROMPT = [
  "You turn a request about ONE resume into JSON. Only use what the message says.",
  "Fields (all optional): limits {experience|education|projects|certifications: number, 0 for all},",
  "show / hide: optional sections (achievements, volunteering, publications, patents, interests),",
  "allSkills (boolean), hideEntries / showEntries: names of specific entries as the user wrote them,",
  "scope: \"this\" (this resume, default), \"all\" (every resume) or \"portfolio\" (the portfolio website),",
  "colour: a colour word or #hex for the resume, reset: true to undo this resume's changes,",
  "skillStyle: how skills are drawn, \"boxes\", \"list\", \"bars\", \"dots\" or \"inline\" (\"side by side\" means boxes, never a column),",
  "columns: the column a whole section should sit in, {sectionId: \"left\"|\"right\"|\"side\"|\"main\"}, section ids summary, skills, experience, education, projects, certifications or an optional section.",
  'Reply with JSON only, e.g. {"hideEntries": ["Blood Bank Management System"], "scope": "this"}'
].join("\n");

// Projects inside a job or school show in the resume's Projects section
const isProject = (entry) => ["projects", "experience_project", "education_project"].includes(entry.section);
const inSection = (entry, section) => (section === "projects" ? isProject(entry) : entry.section === section);

const State = Annotation.Root({
  text: Annotation(),
  readAs: Annotation(),
  plan: Annotation(),
  modelRead: Annotation(),
  targets: Annotation({ reducer: (_, next) => next, default: () => ({ hide: [], show: [], missing: [] }) }),
  result: Annotation(),
  reply: Annotation(),
  steps: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] })
});

const CORE_SECTIONS = ["experience", "education", "projects", "certifications", "skills"];

// The words that name something: "the Zorblax project" -> ["zorblax"]
const FILLER = new Set("the my a an all every each of this that these those from on in and with using use used".split(" "));
const keywordsOf = (phrase) => String(phrase).toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(" ")
  .filter((word) => word.length > 1 && !FILLER.has(word) && !Object.values(SECTION_WORDS).some((pattern) => pattern.test(word)));

// Nothing here but colour talk: "the colour", "dark red", "make it navy". "Red Cross" has a name in it
const noNameIn = (phrase) => keywordsOf(String(phrase).replace(new RegExp(COLOUR_WORDS.source, "gi"), " ")).every((word) => /^(?:it|make|turn|set|change|paint|switch|dark|light|deep|bright|pale|resume|cv|theme|please)$/.test(word));
const isColourTalk = (phrase) => COLOUR_WORDS.test(phrase) && noNameIn(phrase);
// "change it to red" recolours; "change Red Cross to American Red Cross" rewords
const saysRecolour = (said) => {
  const asked = said.match(/\b(?:change|rename|replace|edit|update|reword|rewrite)\b(.*?)\b(?:to|with|as)\b(.*)$/i);
  return Boolean(asked) && COLOUR_WORDS.test(`${asked[1]} ${asked[2]}`) && noNameIn(asked[1]) && noNameIn(asked[2]);
};

// "hide the Blood Bank project and the AWS certification" -> ["the Blood Bank project", "the AWS certification"]
function entryPhrases(part) {
  return String(part || "")
    .replace(/\s*(?:,|\b(?:and|but)\b)?\s*\b(?:keep|remaining|the rest)\b.*$/i, "")
    .replace(/\b(?:(?:from|on|in)\s+(?:here|this one|it)|here)\b.*$/i, "")
    .replace(/\b(?:from|on|off|in|to)\s+(?:(?:this|my|the|all|every|each|of)\s+)*(?:r[eé]sum[eé]s?|portfolio|website|site|cv)\b.*$/i, "")
    .split(/\s*(?:,|\band\b|&)\s*/i)
    .map((phrase) => phrase.replace(/^\s*(?:(?:please|my|the|this|that|these|those|all|of|every)\s+)+/i, "").trim())
    // Asides aren't names: "I don't want those on here"
    .filter((phrase) => phrase.length >= 2 && !/^(?:it|them|this|that|those|these|i|we|i'm|please|thanks)\b/i.test(phrase));
}

// "move Education and Skills to the right column" -> the sections and the place,
// plus the rest of the message. moveAsk: a move, but not of a whole section.
function readMove(said) {
  // "side by side" is how things sit together, not a column
  const message = said.replace(/\bside by side\b/gi, " ");
  const match = message.match(COLUMN_PLACE);
  // "left" alone is a word ("left off"): it takes a preposition or the word column
  if (!match || (!match[1] && !match[3])) return null;
  const before = message.slice(0, match.index);
  const stays = STAYS_THERE.test(before);
  const asked = before.replace(STAYS_THERE, "");
  const verb = [...asked.matchAll(MOVE_VERB)].pop();
  if (!verb && !stays && !match[3]) return null;
  const subject = verb ? asked.slice(verb.index + verb[0].length) : asked;
  if (HIDE.test(subject) || (!verb && HIDE.test(asked))) return null;

  const sections = Object.keys(COLUMN_SECTIONS).filter((id) => COLUMN_SECTIONS[id].test(subject));
  const names = keywordsOf(subject).filter((word) => !NOT_A_NAME.has(word));
  const rest = `${verb ? asked.slice(0, verb.index).replace(/\band\s*$/i, "") : ""} ${message.slice(match.index + match[0].length)}`.trim();
  if (!sections.length || names.length) {
    // "show Blood Bank on the right" may still be about something else
    return match[3] || /\b(?:move|shift)\b/i.test(verb?.[0] || "") ? { moveAsk: true, rest } : null;
  }
  return { columns: Object.fromEntries(sections.map((id) => [id, placeOf(match[2])])), rest };
}

// "in MS Education Section" -> "MS Education"
const nameOnly = (phrase) => phrase.replace(/^(?:from|form|in|of|for|on|at|under|to)\s+/i, "").replace(/\s+sections?$/i, "").trim();

// "remove only the grade in MS, keep the rest" -> the detail and where, plus
// the rest of the message. partAsk: a detail that can't come off on its own.
function readFieldAsk(message) {
  const next = message.match(/\s*(?:,|\band\b|\bbut\b)\s*(?=(?:only|make|hide|remove|show|add|put|reset|\d)\b)/i);
  const head = (next ? message.slice(0, next.index) : message).replace(/\s*(?:,|\b(?:and|but)\b)?\s*\b(?:remaining|the rest|rest|keep)\b.*$/i, "").trim();
  const rest = next ? message.slice(next.index + next[0].length) : "";
  const after = head.match(PART_THEN_NAME);
  // "volunteer role": a section and then a word that alone could mean a section
  const sectionFirst = after ? null : head.match(new RegExp(`(${ACT})\\s+(?:(?:only|just|the|my)\\s+)*(\\w+)\\s+(${partList(NAMED_FIELD_WORD)})$`, "i"));
  const before = after ? null : head.match(NAME_THEN_PART) || (sectionFirst && sectionIn(sectionFirst[2]) ? sectionFirst : null);
  if (!after && !before) return null;
  const hide = !/\b(?:show|add|include|bring back|put back|unhide|restore)\b/i.test(after ? after[1] : before[1]);
  const words = (after ? after[2] : before[3]).split(/\s*(?:,|\band\b|&)\s*/i).map((word) => word.replace(/^the\s+/i, ""));
  const fieldOf = (word) => Object.keys(FIELDS).find((id) => FIELDS[id].words.test(word));
  const fields = [...new Set(words.map(fieldOf).filter(Boolean))];
  // "from this resume" names nothing; "in MS" names MS; so does "in MS remove the grade"
  const named = entryPhrases(after ? after[3] : ` ${before[2]}`).map(nameOnly).filter((phrase) => phrase && !ALL_ENTRIES.test(phrase));
  const lead = after && head.slice(0, after.index).match(/\b(?:in|for|from|under)\s+(.+?)\s*$/i);
  const phrases = named.length || !lead ? named : entryPhrases(lead[1]);
  if (!words.every(fieldOf)) return hide && phrases.length ? { partAsk: true, rest } : null;
  // "remove my degrees", "hide my roles": the whole section, not a detail. A
  // company is only ever a detail
  if (!phrases.length && words.some((word) => isUnclearWord(word) && !/^(?:company|employer)$/i.test(word))) return null;
  return { fieldAsk: { hide, fields, phrases, onlyIn: phrases.length ? null : sectionsSaidBy(words) }, rest };
}

// "only the title in Certifications", "keep just the role and dates for Oracle"
function readKeepOnly(message) {
  const match = message.match(new RegExp(`\\b(?:only|just)\\s+(?:keep\\s+|show\\s+|leave\\s+)?(?:the\\s+|my\\s+)?(${partList(`titles?|names?|${FIELD_WORD}|${NAMED_FIELD_WORD}`)})\\s+(?:in|for|on|from|of|under)\\s+(.+)$`, "i"));
  // "remove only the grade in MS" removes it: the opposite of keeping only it
  if (!match || HIDE.test(message.slice(0, match.index))) return null;
  const kept = match[1].split(/\s*(?:,|\band\b|&)\s*/i).map((word) => word.replace(/^the\s+/i, ""));
  const keptFields = kept.map((word) => Object.keys(FIELDS).find((id) => FIELDS[id].words.test(word) && !/^titles?$/i.test(word))).filter(Boolean);
  const phrases = entryPhrases(match[2]).map(nameOnly).filter((phrase) => phrase && !ALL_ENTRIES.test(phrase));
  if (!phrases.length) return null;
  return { fieldAsk: { hide: true, fields: Object.keys(FIELDS).filter((id) => !keptFields.includes(id)), phrases, keepOnly: match[1].trim() }, rest: "" };
}

// Plain speech, in the word order people really type: "patent date remove",
// "no gpa", "grade not needed", "recommendations add", "patents should be there"
const NOT_A_SUBJECT = /^(?:i|i'd|i'm|we|you|can|could|would|should|please|pls|how|what|why|where|when|who|do|did|does|to|just|only|also|then|not|dont|don't|it|this|that)\b/i;
function plainOrder(text) {
  const said = String(text || "").trim()
    .replace(/^(?:(?:pls|plz|please|kindly|bro|hey|hi)[\s,]+)+/i, "")
    .replace(/[\s,.!]*\b(?:pls|plz|please|kindly|bro|thanks|thank you|sir|asap|karo|kar do|kardo)\b[\s.!]*$/i, "")
    .replace(/[\s.!]+$/, "");
  // The whole phrase has to be the section: "my housing work taken away" isn't
  const isSection = (words) => {
    const phrase = sameSections(words).replace(/^(?:(?:my|the)\s+)+/i, "").replace(/\s+(?:section|details?|part)$/i, "");
    return Boolean(sectionIn(phrase)) && !HIDE.test(phrase) && !keywordsOf(phrase).filter((word) => !NOT_A_NAME.has(word)).length;
  };
  const turnedOff = said.match(/^(?:turn\s+off|switch\s+off|disable|deactivate)\s+(.+)$/i);
  if (turnedOff) return `remove ${turnedOff[1]}`;
  const turnedOn = said.match(/^(?:turn\s+on|switch\s+on|enable|activate|bring|make\s+visible)\s+(.+)$/i) || said.match(/^make\s+(.+?)\s+visible$/i);
  if (turnedOn && isSection(turnedOn[1])) return `add ${turnedOn[1]}`;
  const noNeed = said.match(/^no need (?:of|for|to show)\s+(.+)$/i);
  if (noNeed) return `remove ${noNeed[1]}`;
  const notFor = said.match(/^(.+?)\s+not\s+(?:required|needed|necessary)\s+(?:for|in|on|from)\s+(.+)$/i);
  if (notFor && !NOT_A_SUBJECT.test(notFor[1])) return `remove ${notFor[1]} from ${notFor[2]}`;
  const shouldNot = said.match(/^(.+?)\s+(?:should\s*n[o']t|should not|must not|need not|does not need to|shouldnt)\s+(?:be\s+)?(?:there|here|shown?|appear|visible|included)$/i) || said.match(/^(.+?)\s+(?:is|are)\s+(?:unnecessary|unneeded|not necessary|useless)$/i);
  if (shouldNot && !NOT_A_SUBJECT.test(shouldNot[1])) return `remove ${shouldNot[1]}`;
  const badThenGo = said.match(/^(?:my\s+|the\s+)?([\w ]+?)\s+(?:is|are|looks?)\b.*\b(?:remove|hide|delete|drop)\s+(?:it|them|that)$/i);
  if (badThenGo) return `remove ${badThenGo[1]}`;
  const dislike = said.match(/^(?:i\s+)?(?:dont|don't|do not)\s+like\s+(.+)$/i);
  if (dislike && isSection(dislike[1])) return `remove ${dislike[1]}`;
  const outOfHere = said.match(/^(?:get|take|throw)\s+(.+?)\s+out(?:\s+of\s+(?:here|this|it))?$/i);
  if (outOfHere) return `remove ${outOfHere[1]}`;
  const dontWant = said.match(/^(?:i\s+)?(?:dont|don't|do not)\s+(?:want|need|show|include)\s+(.+)$/i);
  if (dontWant) return `remove ${dontWant[1]}`;
  const verbFirst = said.match(/^(.+?)\s+(?:dont|don't|do not)\s+(?:show|want|need|include)$/i);
  if (verbFirst && !NOT_A_SUBJECT.test(verbFirst[1])) return `remove ${verbFirst[1]}`;
  const wants = said.match(/^(?:i\s+)?(?:also\s+)?(?:want|need|would like|like)\s+(?:to\s+(?:add|see|have)\s+)?(.+)$/i);
  if (wants && isSection(wants[1])) return `add ${wants[1]}`;
  const missing = said.match(/^(.+?)\s+(?:(?:is|are)\s+)?(?:missing|not there|not showing|not visible)$/i);
  if (missing && isSection(missing[1])) return `add ${missing[1]}`;
  const offAfter = said.match(/^(?:take|get|put|throw)\s+(.+?)\s+(?:off|out|away)$/i);
  if (offAfter && !/\b(?:it|them)\b/i.test(offAfter[1])) return `remove ${offAfter[1]}`;
  const onlyTitle = said.match(/^(.+?)\s+(?:only|just)\s+(?:the\s+)?(titles?|names?)$/i);
  if (onlyTitle && !NOT_A_SUBJECT.test(onlyTitle[1])) return `only the title in ${onlyTitle[1]}`;
  const without = said.match(/^(.+?)\s+without\s+(?:the\s+|any\s+)?(.+)$/i);
  if (without && isSection(without[1])) return `remove ${without[2]} from ${without[1]}`;
  // Adding a core section means all of it
  const addCore = said.match(/^(?:add|show|include)\s+(?:my\s+|the\s+)?(certs?|certifications?|certificates?|projects?|jobs?|experiences?|educations?|schools?)(?:\s+(?:section|details?))?$/i);
  if (addCore) return `show all my ${addCore[1]}`;
  const verbLast = said.match(/^(.+?)\s+(?:remove|removed|delete|deleted|hide|drop|take out)(?:\s+(?:it|them|this|that))?$/i);
  if (verbLast && !NOT_A_SUBJECT.test(verbLast[1])) return `remove ${verbLast[1]}`;
  const coreLast = said.match(/^(certs?|certifications?|certificates?|projects?|jobs?|experiences?|educations?|schools?)\s+add$/i);
  if (coreLast) return `show all my ${coreLast[1]}`;
  const notNeeded = said.match(/^(.+?)\s+(?:(?:is|are)\s+)?(?:(?:not|no|never)\s+(?:needed|required|necessary|wanted|useful|important)|no need|can go|not want)$/i);
  if (notNeeded && !NOT_A_SUBJECT.test(notNeeded[1])) return `remove ${notNeeded[1]}`;
  const leadingNo = said.match(/^no\s+(.+)$/i);
  if (leadingNo && !/colou?r/i.test(leadingNo[1])) return `remove ${leadingNo[1]}`;
  const addLast = said.match(/^(.+?)\s+(?:add|include)(?:\s+(?:it|them))?$/i);
  if (addLast && !NOT_A_SUBJECT.test(addLast[1])) return `add ${addLast[1]}`;
  const shouldShow = said.match(/^(.+?)\s+(?:should|must|need to|needs to)\s+(?:be\s+)?(?:there|here|shown?|visible|included|added)$/i);
  if (shouldShow && !NOT_A_SUBJECT.test(shouldShow[1])) return `add ${shouldShow[1]}`;
  const whereIs = said.match(/^where(?:'s|s| is| are)\s+(.+?)[,\s]+add(?:\s+(?:it|them))?$/i);
  if (whereIs) return `add ${whereIs[1]}`;
  return said.replace(/^(show|add|bring back|put back|include)\s+(.+?)\s+again$/i, "$1 $2");
}

// A new fact for the portfolio, not a choice about this resume
const NEW_ENTRY = /^\s*how (?:do|can|should|to)\b.*\badd\b|\badd\s+(?:a|an)\s+\w+\s+(?:from|on|about|by|at)\b|\badd\b.*\b\d{2,}\b|^\W*new\s+\w+\W*$|\bgot (?:approved|granted|accepted)\b|\b(?:add|create|insert|enter)\s+(?:a\s+|an\s+|my\s+|one\s+|another\s+)?(?:new\s+)(?:\w+\s*){0,3}|\b(?:called|named|titled)\b|\bi\s+(?:got|have got|received|earned|won|filed|published|wrote|was granted|completed|finished)\b|\bfrom my (?:boss|manager|professor|colleague)\b/i;
const ASKS_TO_SHOW = /\b(?:add|show|include|put|bring|display|restore|unhide|want|need|keep|also|enable|back|visible)\b/i;
const SAYS_NO = /\b(?:off|out|not|no|never|without|dont|don't|disable|unnecessary|unneeded|hate|dislike|away)\b/i;
const BARE_SECTION = /^\W*(?:(?:the|my)\s+)?(?:section\s+)?([\w ]{3,40}?)(?:\s+(?:section|details?))?\W*$/i;

// "remove details from Volunteering", "what can i remove from Projects": which ones?
function readDetailsAsk(message) {
  const asks = /\b(?:remove|hide|drop|delete|take off)\s+(?:the\s+|all\s+|some\s+|its\s+|my\s+)*(?:details?|fields?(?! of study)|info(?:rmation)?|stuff|things?|parts?)\s+(?:from|in|of|for|on|under)\b|^\W*(?:remove|hide|delete)\s+(?:the\s+|all\s+|some\s+|my\s+)*(?:details?|fields?)\W*$|\b(?:what|which)\b.*\b(?:details?|fields?|info|parts?|can (?:i|you) (?:remove|hide))\b/i;
  if (!asks.test(message)) return null;
  return { section: Object.keys(FIELD_SECTION_NAMES).find((id) => COLUMN_SECTIONS[id]?.test(message)) || "" };
}

// An optional section moved to a column also has to be on the resume
function showMoved(plan) {
  const moved = Object.keys(plan.columns || {}).filter((id) => OPTIONAL_SECTIONS.includes(id));
  if (moved.length) plan.show = [...new Set([...(plan.show || []), ...moved])];
  return plan;
}

// Rules: the resume planner's limits, sections and skills, plus entries,
// columns, scope, reset and colour
// Sizes first ("increase the right column by 5%"), then whatever else was asked
function rulePlan(typed) {
  const sizes = readLayoutAsks(String(typed || ""), SECTIONS_NAMED);
  if (!sizes) return contentPlan(typed);
  const whole = String(typed);
  const others = sizes.rest && /[a-z]{3}/i.test(sizes.rest) ? contentPlan(sizes.rest) : {};
  return {
    ...others,
    layoutAsks: sizes.asks,
    scope: PORTFOLIO.test(whole) && !/r[eé]sum[eé]/i.test(whole) ? "portfolio" : EVERY_RESUME.test(whole) ? "all" : "this"
  };
}

function contentPlan(typed) {
  const said0 = plainOrder(typed);
  if (NEW_ENTRY.test(said0)) return { newEntry: true, scope: "this" };
  if (/^\s*how (?:do|can|should|to)\b/i.test(said0)) return { howTo: true, scope: "this" };
  const bare = said0.match(BARE_SECTION);
  const bareSection = bare && !/\s/.test(bare[1].trim()) ? Object.keys(COLUMN_SECTIONS).find((id) => COLUMN_SECTIONS[id].test(bare[1])) : null;
  // Only "X section please" with a polite word asks for it; alone it could mean either
  if (bareSection && /\b(?:please|pls|plz|kindly)\b/i.test(String(typed)) && OPTIONAL_SECTIONS.includes(bareSection)) return { show: [bareSection], scope: "this" };
  if (bareSection) return { bareAsk: bareSection, scope: "this" };
  // "from all sections" means every section that has it, not only the optional ones
  const message = sameSections(String(said0 || "").replace(/\b(?:all|every|each)(?: of)?(?: the| my)? sections?\b(?=.*$)/gi, (words, at, whole) => (new RegExp(`\\b(?:${FIELD_WORD})\\b`, "i").test(whole) ? "everything" : words)));
  const order = readOrder(message);
  if (order) return { order, scope: EVERY_RESUME.test(message) ? "all" : "this" };
  const move = readMove(String(message || ""));
  // "put the Blood Bank project back" -> "put back the Blood Bank project"
  const said = String(move ? move.rest : message || "").replace(/\b(put|bring|add)\s+(.+?)\s+back\b/i, "$1 back $2");
  const whole = String(message || "");
  const detailsAsk = readDetailsAsk(said);
  if (detailsAsk) return { detailsAsk, scope: "this" };
  // Skills lose their ratings by being drawn without them
  if (/\b(?:remove|hide|drop|delete|no|without)\b.*\b(?:ratings?|stars?|levels?|scores? (?:of|on|for) skills?)\b/i.test(said) && /\b(?:skills?|ratings?|stars?)\b/i.test(said)) return { skillStyle: "list", scope: EVERY_RESUME.test(said) ? "all" : "this" };
  const part = readKeepOnly(said) || readFieldAsk(said);
  const skillStyle = part ? undefined : skillStyleIn(said);
  const text = part ? part.rest : said;
  // Rewording isn't hiding: never guess an entry out of "change it to ..."
  if (!move && !part && !skillStyle && EDIT_WORDING.test(said) && !saysRecolour(said)) return { editAsk: true, scope: "this" };
  const plan = { ...planResume(text) };
  // The planner assumes a section named is a section wanted. It has to be asked
  // for: "patents should go" must never add them
  if (plan.show?.length && !move?.columns && !ASKS_TO_SHOW.test(text)) {
    if (SAYS_NO.test(text)) plan.hide = [...new Set([...(plan.hide || []), ...plan.show])];
    else plan.bareAsk = plan.show[0];
    delete plan.show;
  }
  if (move?.columns) plan.columns = move.columns;
  if (move?.moveAsk) plan.moveAsk = true;
  if (part?.fieldAsk) plan.fieldAsk = part.fieldAsk;
  if (part?.partAsk) plan.partAsk = true;
  if (skillStyle) plan.skillStyle = skillStyle;
  showMoved(plan);
  plan.scope = PORTFOLIO.test(whole) && !/r[eé]sum[eé]|\b(?:portfolio|website|site)\s+(?:links?|urls?|address)\b/i.test(whole) ? "portfolio" : EVERY_RESUME.test(whole) ? "all" : "this";
  if (RESET.test(text)) plan.reset = true;
  if (STATUS.test(text)) plan.status = true;

  // Section words alone ("hide interests") are handled by the planner;
  // anything else after hide/show names entries
  const sectionOnly = (phrase) => !keywordsOf(phrase).length;
  // A whole core section ("remove the certificates") is every entry in it;
  // the optional sections are the planner's
  const wholeSection = (phrase) => sectionOnly(phrase) && CORE_SECTIONS.some((id) => SECTION_WORDS[id].test(phrase));
  const hidePart = text.match(new RegExp(`${HIDE.source}(.*?)(?=${SHOW.source}|$)`, "i"));
  const showPart = text.match(new RegExp(`${SHOW.source}(.*?)(?=${HIDE.source}|$)`, "i"));
  const hideEntries = entryPhrases(hidePart?.[1]).filter((phrase) => (!sectionOnly(phrase) || wholeSection(phrase)) && !isColourTalk(phrase));
  const showEntries = entryPhrases(showPart?.[1]).filter((phrase) => !sectionOnly(phrase) && !/^all\b|\bskills\b/i.test(phrase) && !isColourTalk(phrase));
  if (hideEntries.length) plan.hideEntries = hideEntries;
  if (showEntries.length) plan.showEntries = showEntries;
  // Names aren't colours: "hide the Black Friday project" keeps its colour
  const colourText = [hidePart?.[0], showPart?.[0]].filter(Boolean).reduce((rest, part) => rest.replace(part, " "), text);
  // A colour needs asking for: "make it navy", "navy", not "purple monkey dishwasher"
  if (/\b(?:no|default|original|remove (?:the )?|reset (?:the )?)\s*colou?rs?\b|\bcolou?r back\b/i.test(text)) plan.clearAccent = true;
  else if (COLOUR_WORDS.test(colourText) && asksColour(colourText) && (!/\bcolou?r\b/i.test(colourText) || /\b(?:navy|blue|green|red|teal|purple|violet|pink|orange|amber|gold|black|gr[ae]y|brown|maroon|crimson)\b|#[0-9a-f]{3,6}/i.test(colourText))) plan.colour = colourText;
  // "add more skills" is every skill
  if (/\b(?:add|show|more|all)\b.*\bmore skills\b/i.test(text)) plan.allSkills = true;
  // "remove my phone number", "hide the summary": the page, not an entry
  const pageHide = [];
  const pageShow = [];
  for (const [key, list] of [["hideEntries", pageHide], ["showEntries", pageShow]]) {
    if (!plan[key]) continue;
    plan[key] = plan[key].filter((phrase) => {
      const part = pagePartOf(phrase);
      if (part) list.push(part);
      return !part;
    });
    if (!plan[key].length) delete plan[key];
  }
  if (/\bshow\b.*\bheadline\b.*\b(?:instead|not|rather)\b.*\broles?\b|\b(?:instead of|not)\b.*\broles?\b.*\bheadline\b/i.test(whole)) {
    delete plan.showEntries;
    pageHide.push([null, ["page:roles"], "your role targeting (your headline shows instead)"]);
  }
  // "remove my website" is the link on the resume, not a request about the portfolio site
  if ([...pageHide, ...pageShow].length && plan.scope === "portfolio") plan.scope = "this";
  if (pageHide.length) plan.pageHide = pageHide.map(([, keys, name]) => ({ keys, name }));
  if (pageShow.length) plan.pageShow = pageShow.map(([, keys, name]) => ({ keys, name }));
  if (SMALL_TALK.test(text)) plan.smallTalk = true;
  return plan;
}

// Words that only say what to do, left out when finding what it's about
const ACTION_WORDS = new Set("hide remove drop delete take taken off out away leave get rid ditch lose omit skip cut no need don't do not want show add include bring back put restore unhide return would like i i'd please can could you should be here it one on from want again".split(" "));

// The trained models' reading, when the rules found nothing
function trainedPlan(text, vocabulary) {
  const result = predict("action", text, { vocabulary });
  if (!result || result.known < 0.3 || result.p < 0.5 || result.ranked[0].p - result.ranked[1].p < 0.15) return null;
  const plan = { scope: PORTFOLIO.test(text) && !/r[eé]sum[eé]/i.test(text) ? "portfolio" : EVERY_RESUME.test(text) ? "all" : "this" };
  const subject = () => (text.toLowerCase().match(/[a-z0-9+#'’]+/g) || []).filter((word) => !ACTION_WORDS.has(word) && !FILLER.has(word)).join(" ");
  // Never a guess: resets and colours must say so in words
  if (result.top === "reset" && !RESET.test(text)) return null;
  if (result.top === "colour" && !COLOUR_WORDS.test(text)) return null;
  if (result.top === "edit_text" && !/\b(?:change|rename|replace|edit|update|re-?word|rewrite|fix|call|read|say)\b/i.test(text)) return null;
  if (result.top === "hide_entry" || result.top === "show_entry") {
    const phrase = subject();
    if (!phrase) return null;
    plan[result.top === "hide_entry" ? "hideEntries" : "showEntries"] = [phrase];
  } else if (result.top === "colour") {
    // Mostly unknown words around a colour isn't a request for one
    if (result.known < 0.5) return null;
    plan.colour = text;
  }
  // Understood, but the rules couldn't pin down what: say so, and never hide anything
  else if (result.top === "hide_detail" && new RegExp(`\\b(?:${FIELD_WORD})\\b`, "i").test(text)) plan.hideEntries = [subject()];
  else if (result.top === "hide_detail" || result.top === "show_detail") plan.partAsk = true;
  else if (result.top === "move_column") plan.moveAsk = true;
  else if (result.top === "skill_style") plan.styleAsk = true;
  else if (result.top === "edit_text") plan.editAsk = true;
  else if (result.top === "reset") plan.reset = true;
  else if (result.top === "status") plan.status = true;
  else if (result.top === "section") {
    const extras = ["achievements", "volunteering", "publications", "patents", "interests"].filter((id) => SECTION_WORDS[id].test(text));
    if (!extras.length) return null;
    // Naming a section isn't asking for anything: it has to say which way
    if (!HIDE.test(text) && !ASKS_TO_SHOW.test(text)) return null;
    plan[HIDE.test(text) ? "hide" : "show"] = extras;
  } else return null;
  return { plan, confidence: result.p, label: result.top };
}

const hasWork = (plan) => Boolean(plan.layoutAsks || plan.smallTalk || plan.limits || plan.show?.length || plan.hide?.length || typeof plan.allSkills === "boolean" ||
  plan.hideEntries?.length || plan.showEntries?.length || plan.colour || plan.reset || plan.status || plan.columns || plan.moveAsk || plan.fieldAsk || plan.partAsk || plan.skillStyle || plan.styleAsk || plan.editAsk || plan.order || plan.pageHide || plan.pageShow || plan.clearAccent || plan.offTopic || plan.rewrite || plan.detailsAsk || plan.newEntry || plan.bareAsk || plan.howTo);

const NUMBER_WORDS = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten" };

// The model's reading, kept only where it's well formed and where the message
// itself says so: a model can invent an entry or a section nobody mentioned
function checkedModelPlan(raw, message) {
  const asked = String(message || "");
  const lower = asked.toLowerCase();
  const says = (id) => SECTION_WORDS[id]?.test(asked);
  const plan = {};
  if (raw?.limits && typeof raw.limits === "object") {
    const limits = {};
    for (const id of ["experience", "education", "projects", "certifications"]) {
      const count = raw.limits[id];
      // A count must be in the message: "hide my oldest job" isn't "1 job"
      const statesIt = count === 0 ? /\b(?:all|every)\b/i.test(asked) : new RegExp(`\\b(?:${count}|${NUMBER_WORDS[count] || count})\\b`, "i").test(asked);
      if (says(id) && Number.isInteger(count) && count >= 0 && count <= 50 && statesIt) limits[id] = count === 0 ? null : count;
    }
    if (Object.keys(limits).length) plan.limits = limits;
  }
  const extras = ["achievements", "volunteering", "publications", "patents", "interests"];
  for (const key of ["show", "hide"]) if (Array.isArray(raw?.[key])) plan[key] = raw[key].filter((id) => extras.includes(id) && says(id));
  // "only AI skills" isn't "all skills": the message has to say so
  if (typeof raw?.allSkills === "boolean" && says("skills") && (raw.allSkills ? /\b(?:all|every|more)\b/i : /\b(?:key|important|top|only)\b/i).test(asked)) plan.allSkills = raw.allSkills;
  // Removing or restoring needs asking for, and most of the name must be in the
  // message: one shared word like "AI" must never take a job off a resume
  const said = new Set(lower.match(/[a-z0-9+#.]+/g) || []);
  for (const [key, asks] of [["hideEntries", HIDE], ["showEntries", /\b(?:show|add|include|bring|put|unhide|restore|back)\b/i]]) {
    if (!Array.isArray(raw?.[key]) || !asks.test(asked)) continue;
    plan[key] = raw[key].filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim().slice(0, 120))
      .filter((name) => {
        const words = keywordsOf(name);
        return words.length && words.filter((word) => said.has(word)).length / words.length >= 0.6;
      }).slice(0, 10);
  }
  plan.scope = ["this", "all", "portfolio"].includes(raw?.scope) && (raw.scope === "this" || PORTFOLIO.test(asked) || EVERY_RESUME.test(asked)) ? raw.scope : "this";
  if (typeof raw?.colour === "string" && raw.colour.trim() && COLOUR_WORDS.test(asked) && asksColour(asked)) plan.colour = raw.colour.slice(0, 40);
  if (raw?.reset === true && RESET.test(asked)) plan.reset = true;
  if (raw?.columns && typeof raw.columns === "object") {
    const columnText = lower.replace(/\bside by side\b/g, " ");
    const columns = Object.entries(raw.columns).filter(([id, place]) => COLUMN_SECTIONS[id]?.test(asked) && MODEL_PLACE_WORDS[place]?.test(columnText));
    if (columns.length) plan.columns = Object.fromEntries(columns);
  }
  if (raw?.skillStyle && raw.skillStyle === skillStyleIn(asked)) plan.skillStyle = raw.skillStyle;
  return showMoved(plan);
}

async function understand({ text: message }, config) {
  const { llm, signal, designId, tools } = config.configurable;
  const vocabulary = await tools.call("list_entries").then(({ entries }) => entries.map((entry) => entry.label)).catch(() => []);
  const reading = analyze(message, { vocabulary });
  const text = reading.corrected;
  let plan = rulePlan(text);
  // Rewording reads the user's own words, so the new text isn't "corrected"
  const rewrite = plan.editAsk || !hasWork(plan) || RESTORE_WORDING.test(message) ? readRewrite(message) || readRewrite(fixCommandWords(message)) : null;
  if (rewrite) plan = { rewrite, said: message, scope: PORTFOLIO.test(message) && !/r[eé]sum[eé]/i.test(message) ? "portfolio" : EVERY_RESUME.test(message) ? "all" : "this" };
  let modelRead = false;
  const steps = reading.corrections.length ? [`Read your words as: ${describeCorrections(reading.corrections)}`] : [];
  // Nothing to do from the rules: something this chat can't do, or a question,
  // before any model gets to guess a change
  const cantDo = !hasWork(plan) && Boolean(cantDoReply(text));
  const question = !hasWork(plan) && !cantDo && QUESTION.test(text) && /[a-z]{2}/i.test(text) && (predict("action", text, { vocabulary })?.known ?? 1) >= 0.3;
  // A question about something else altogether: not this agent's to answer
  const offTopic = question && !aboutThem(text, vocabulary);
  const trained = hasWork(plan) || cantDo || question ? null : trainedPlan(text, vocabulary);
  if (hasWork(plan)) steps.push("Understood with the rules (resume planner and entry wording)");
  else if (cantDo) steps.push("Read as something this chat can't do; nothing changed");
  else if (offTopic) {
    plan = { offTopic: true, scope: "this" };
    steps.push("A question about something other than this resume; nothing changed");
  } else if (question) {
    plan = { question: true, scope: "this" };
    steps.push("Read as a question, so nothing changes");
  } else if (trained) {
    plan = trained.plan;
    steps.push(`The trained models read it as "${trained.label.replace("_", " ")}" (${Math.round(trained.confidence * 100)}%)`);
  } else if (llm) {
    try {
      plan = checkedModelPlan(await llm.invokeJson(MODEL_PROMPT, { message: text }, signal), text);
      modelRead = true;
      steps.push("Understood by the language model (LangChain + Ollama), checked field by field");
    } catch (error) {
      if (signal?.aborted) throw error;
      steps.push("The language model couldn't read it; the rules found nothing either");
    }
  } else steps.push("No language model running and the rules found nothing to change");

  // A colour: the Portfolio Designer agent (A2A) turns words into a hex, else the same rules here
  if (plan.colour) {
    const a2a = await planViaA2A({ request: `Use ${plan.colour} as the accent`, custom: [], currentId: "" }, signal).catch(() => null);
    const accent = a2a?.changes?.accent || ruleChanges(plan.colour).accent || "";
    plan.accent = accent;
    steps.push(a2a?.changes?.accent ? `The Portfolio Designer agent picked the colour over A2A (${accent})` : accent ? `Colour read in-process (${accent}; the A2A agent wasn't reachable)` : "Couldn't tell which colour");
  }
  // From the main chat there's no one resume: changes go to all of them
  if (!designId && plan.scope === "this") plan.scope = "all";
  return { text, readAs: reading.corrections.length ? text : "", plan, modelRead, steps };
}

// How an entry is named on a resume ("projects:<id>"), nested projects included
const keyOf = (entry) => `${isProject(entry) ? "projects" : entry.section}:${entry.id}`;

// How well an entry's name matches what the user wrote (0 to 1)
function nameScore(label, phrase) {
  const words = (value) => new Set(String(value).toLowerCase().replace(/[^a-z0-9+#]+/g, " ").split(" ").filter((word) => word.length > 1 && !["the", "my", "project", "job", "at", "of", "in", "into", "and"].includes(word)));
  const asked = words(phrase);
  if (!asked.size) return 0;
  const have = words(label);
  // "Masters" still finds "Master of Science"
  return [...asked].filter((word) => have.has(word) || have.has(word.replace(/s$/, ""))).length / asked.size;
}

// Looks up each phrase: by name, then by meaning, and a whole section on one resume
async function resolvePhrases(plan, entries, config, steps) {
  const { tools, designId } = config.configurable;
  const phrases = [...(plan.hideEntries || []).map((phrase) => ["hide", phrase]), ...(plan.showEntries || []).map((phrase) => ["show", phrase])];
  const targets = { hide: [], show: [], missing: [] };

  for (const [action, phrase] of phrases) {
    const section = Object.entries(SECTION_WORDS).find(([, pattern]) => pattern.test(phrase))?.[0];
    const pool = section ? entries.filter((entry) => inSection(entry, section)) : entries;
    let found = [];
    if (!keywordsOf(phrase).length) {
      // Every entry of a section, on this resume only: the switches stay as they are
      if (section && (plan.anySection || (designId && plan.scope === "this"))) found = pool;
    } else {
      // 1. By name, on most of its words: "Food Bank" isn't "Blood Bank"
      const byName = (list) => list.map((entry) => ({ entry, score: nameScore(entry.label, keywordsOf(phrase).join(" ")) })).filter((item) => item.score > 0.5).sort((a, b) => b.score - a.score);
      // A section word is only a hint: "my UltraUnityVerse work" is still that project
      const inPool = byName(pool);
      const ranked = inPool.length ? inPool : byName(entries);
      found = ranked.length ? ranked.filter((item) => item.score === ranked[0].score).map((item) => item.entry) : [];
      // 2. By meaning: hybrid RAG and GraphRAG ("projects that use LangGraph")
      if (!found.length) {
        const search = await tools.call("search_portfolio", { query: phrase, k: 6 });
        // A match must mention most of the words asked for, so an unknown name
        // never hides whatever ranked first
        const asked = keywordsOf(phrase);
        const relevant = search.results.filter((doc) => asked.filter((word) => String(doc.text || "").toLowerCase().includes(word)).length > asked.length / 2);
        const ids = new Set(relevant.map((doc) => {
          const [kind, id] = String(doc.id || "").split(":");
          return DOC_SECTION[kind] && id ? `${DOC_SECTION[kind]}:${id}` : null;
        }).filter(Boolean));
        const matches = entries.filter((entry) => ids.has(keyOf(entry)) && (!section || inSection(entry, section)));
        // A plural ask ("projects that use LangGraph") takes every match; otherwise the best one
        found = /\b(all|every|projects|jobs|certifications|schools)\b/i.test(phrase) ? matches : matches.slice(0, 1);
        if (found.length) steps.push(`Found "${phrase}" with ${search.mode} search${search.graph?.facts?.length ? ` and ${search.graph.facts.length} GraphRAG facts` : ""}`);
      }
    }
    if (found.length) targets[action].push(...found);
    else targets.missing.push(phrase);
  }
  return targets;
}

// Which entries a detail comes off: those named, or all that have it
async function resolveFieldAsk(plan, entries, config, steps) {
  const { hide, fields, phrases } = plan.fieldAsk;
  const has = (entry, id) => FIELDS[id].sections.some((section) => inSection(entry, section) && (!plan.fieldAsk.onlyIn || plan.fieldAsk.onlyIn.includes(section)));
  const pool = entries.filter((entry) => fields.some((id) => has(entry, id)));
  const found = phrases.length ? await resolvePhrases({ hideEntries: phrases, anySection: true, scope: plan.scope }, pool, config, steps) : { hide: pool, missing: [] };
  // Named, but that entry doesn't have this detail: say so instead of "not found"
  const noDetail = found.missing.flatMap((phrase) => entries.filter((entry) => nameScore(entry.label, keywordsOf(phrase).join(" ")) > 0.5).slice(0, 1).map((entry) => entry.label));
  return {
    fieldChange: {
      hide,
      fields,
      entries: found.hide,
      keys: found.hide.flatMap((entry) => fields.filter((id) => has(entry, id)).map((id) => `${keyOf(entry)}:${id}`)),
      keepOnly: plan.fieldAsk.keepOnly,
      noDetail,
      // Named and left off this resume: "remaining keep it" brings it back
      restore: hide && phrases.some((phrase) => keywordsOf(phrase).length) ? found.hide : []
    },
    missing: found.missing.filter((phrase) => !entries.some((entry) => nameScore(entry.label, keywordsOf(phrase).join(" ")) > 0.5))
  };
}

// The last check before an entry comes off: a phrase with a detail's word in it
// ("grade stuff in MS") means that detail, unless an entry is really called
// that ("Grade Predictor"). Any wording that reaches here, from rules or models.
function detailsNotNames(plan, entries) {
  const fieldWord = new RegExp(`\\b(?:${FIELD_WORD})\\b`, "gi");
  const keep = [];
  const ask = { hide: true, fields: [], phrases: [] };
  for (const phrase of plan.hideEntries || []) {
    const said = phrase.match(fieldWord) || [];
    const fields = Object.keys(FIELDS).filter((id) => said.some((word) => FIELDS[id].words.test(word)));
    const isName = entries.some((entry) => said.some((word) => new RegExp(`\\b${word}\\b`, "i").test(entry.label)) && nameScore(entry.label, phrase) >= 0.5);
    if (!fields.length || isName) {
      keep.push(phrase);
      continue;
    }
    ask.fields.push(...fields);
    const rest = phrase.replace(fieldWord, " ").replace(new RegExp(`\\b(?:${PART_FILLER}|stuff|things?|bits?|in|of|for|from|form|on|at|under|and|the|my)\\b`, "gi"), " ").replace(/\s+/g, " ").trim();
    if (rest) ask.phrases.push(rest);
  }
  if (!ask.fields.length) return plan;
  return { ...plan, hideEntries: keep, fieldAsk: { ...ask, fields: [...new Set(ask.fields)] } };
}

async function findEntries({ text, plan: read, modelRead }, config) {
  const { tools, llm, signal } = config.configurable;
  if (!read.hideEntries?.length && !read.showEntries?.length && !read.fieldAsk) return {};
  const { entries } = await tools.call("list_entries");
  const plan = detailsNotNames(read, entries);
  const steps = [`Read your ${entries.length} entries with the MCP tool list_entries`];
  let targets = await resolvePhrases(plan, entries, config, steps);
  const asked = plan.fieldAsk ? await resolveFieldAsk(plan, entries, config, steps) : null;
  const withFields = (found) => (asked ? { ...found, fieldChange: asked.fieldChange, missing: [...found.missing, ...asked.missing] } : found);

  // The rules named something that isn't there: the model reads the whole
  // message (if it's running), and its reading replaces theirs when it helps
  if (targets.missing.length && llm && !modelRead && !cantDoReply(text)) {
    try {
      const reading = checkedModelPlan(await llm.invokeJson(MODEL_PROMPT, { message: text, entries: entries.slice(0, 80).map((entry) => entry.label) }, signal), text);
      if (hasWork(reading)) {
        const retried = await resolvePhrases(reading, entries, config, steps);
        if (retried.missing.length < targets.missing.length || retried.hide.length + retried.show.length > targets.hide.length + targets.show.length || reading.limits) {
          steps.push("The rules weren't sure, so the language model read it (LangChain + Ollama), checked field by field");
          return { plan: { ...reading, scope: reading.scope === "this" ? plan.scope : reading.scope, accent: plan.accent }, targets: withFields(retried), steps };
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
    steps.push("The language model couldn't place it either");
  }
  return { plan, targets: withFields(targets), steps };
}

const NOUNS = { experience: ["job", "jobs"], education: ["school", "schools"], projects: ["project", "projects"], certifications: ["certification", "certifications"] };

// "Blood Bank and UltraUnityVerse", or a count when it's a long list
function namesOf(list) {
  if (list.length > 3) return `${list.length} entries`;
  const names = list.map((entry) => entry.label);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
}

// What a settings change means, in words: "showing all projects", "added interests"
function describeChanges(changes) {
  const parts = Object.entries(changes.limits || {}).map(([id, count]) => (
    count === null ? `showing all ${NOUNS[id][1]}` : count === "default" ? `${NOUNS[id][1]} back to the default` : `showing ${count} ${NOUNS[id][count === 1 ? 0 : 1]}`
  ));
  if (changes.show?.length) parts.push(`added ${changes.show.join(", ")}`);
  if (changes.hide?.length) parts.push(`removed ${changes.hide.join(", ")}`);
  if (changes.allSkills === true) parts.push("showing every skill");
  if (changes.allSkills === false) parts.push("showing your key skills");
  if (changes.columns) parts.push(...inPlaces(changes.columns));
  if (changes.skillStyle) parts.push(`Skills ${SKILL_STYLES.find(([id]) => id === changes.skillStyle)[2]}`);
  return parts;
}

// A question: found with RAG, answered from those facts only by the language
// model, or from the entries themselves without one. Nothing changes.
async function answer(text, config) {
  const { tools, llm, signal, designId } = config.configurable;
  const [{ entries }, settings, search] = await Promise.all([tools.call("list_entries"), tools.call("get_resume_settings"), tools.call("search_portfolio", { query: text, k: 6 })]);
  const labels = Object.fromEntries(entries.map((entry) => [keyOf(entry), entry.label]));
  const steps = [`Looked it up with ${search.mode} search through MCP`];
  const shows = statusText(settings, labels, designId);
  if (llm) {
    try {
      const reply = await llm.invokeJson(ANSWER_PROMPT, { question: text, found: search.results.slice(0, 6).map((doc) => String(doc.text || "").slice(0, 400)), thisResume: shows, entries: entries.slice(0, 60).map((entry) => entry.label) }, signal);
      if (typeof reply?.answer === "string" && reply.answer.trim()) {
        steps.push("Answered by the language model from those facts only");
        return { result: { answer: reply.answer.trim().slice(0, 800) }, steps };
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  const section = Object.keys(SECTION_WORDS).find((id) => SECTION_WORDS[id].test(text));
  const listed = section ? entries.filter((entry) => inSection(entry, section)).map((entry) => entry.label) : [];
  if (listed.length) return { result: { answer: `In your portfolio: ${listed.slice(0, 8).join("; ")}${listed.length > 8 ? `, and ${listed.length - 8} more` : ""}.` }, steps };
  const words = (text.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || []).filter((word) => !/^(?:what|whats|what's|where|when|why|who|how|which|does|did|are|was|were|will|would|should|could|have|has|this|that|the|and|for|you|your|mine|good|best)$/.test(word));
  const facts = search.results.filter((doc) => words.some((word) => String(doc.text || "").toLowerCase().includes(word)));
  if (facts.length) return { result: { answer: `From your portfolio: ${String(facts[0].text).slice(0, 260)}` }, steps };
  return { result: { answer: `I couldn't answer that from your portfolio, and opinions need the language model (start Ollama). Job Match scores your resume against a job. ${shows}` }, steps };
}

async function apply({ text, plan, targets }, config) {
  const { tools, designId, layout, sideWidth } = config.configurable;
  if (plan.question) return answer(text, config);
  const steps = [];
  if (plan.rewrite) {
    const outcome = await applyRewrite(plan, config, steps);
    return { result: outcome.answer ? { answer: outcome.answer } : { done: outcome.done, emptyNote: outcome.note || "" }, steps };
  }
  const done = [];
  const settingsChanges = {};
  // A one-column design has nowhere to move a section to
  const oneColumn = Boolean(plan.columns) && plan.scope === "this" && layout === "single";
  for (const key of ["limits", "show", "hide", "allSkills", "columns", "skillStyle"]) if (plan[key] !== undefined && !(key === "columns" && oneColumn) && (!Array.isArray(plan[key]) || plan[key].length)) settingsChanges[key] = plan[key];
  if (oneColumn && settingsChanges.show) settingsChanges.show = settingsChanges.show.filter((id) => !plan.columns[id]);
  if (settingsChanges.show && !settingsChanges.show.length) delete settingsChanges.show;
  const fieldChange = targets.fieldChange?.keys.length && plan.scope !== "portfolio" ? targets.fieldChange : null;
  if (fieldChange) settingsChanges[fieldChange.hide ? "hideFields" : "showFields"] = fieldChange.keys;
  const pageKeys = (list) => (list || []).flatMap((part) => part.keys);
  if (plan.pageHide) settingsChanges.hideFields = [...(settingsChanges.hideFields || []), ...pageKeys(plan.pageHide)];
  if (plan.pageShow) settingsChanges.showFields = [...(settingsChanges.showFields || []), ...pageKeys(plan.pageShow)];
  const pageDone = [plan.pageHide && `removed ${plan.pageHide.map((part) => part.name).join(" and ")}`, plan.pageShow && `put back ${plan.pageShow.map((part) => part.name).join(" and ")}`].filter(Boolean);
  if (plan.order) {
    const shared = await tools.call("get_resume_settings");
    settingsChanges.order = reordered(shared.designs?.[designId]?.order || shared.order || [], plan.order);
  }
  const orderDone = plan.order ? [orderText(plan.order)] : [];
  // Sizes: each change builds on what this resume already has
  let layoutDone = [];
  let layoutNote = "";
  if (plan.layoutAsks) {
    const shared = await tools.call("get_resume_settings");
    const current = { ...(shared.tweaks || {}), ...(plan.scope === "this" ? shared.designs?.[designId]?.tweaks || {} : {}) };
    const sizes = layoutChanges(plan.layoutAsks, { current, base: sideWidth || 32, layout, scope: plan.scope });
    if (plan.scope !== "portfolio" && Object.keys(sizes.tweaks).length) settingsChanges.tweaks = sizes.tweaks;
    layoutDone = plan.scope === "portfolio" ? [] : sizes.done;
    layoutNote = sizes.notes.length ? ` ${sizes.notes.join(" ")}` : "";
    if (plan.scope === "portfolio" && sizes.done.length) layoutNote = " These sizes are only on resumes: ask for it on a resume instead of your portfolio.";
  }
  // Asked to show a section with nothing in it: it can't appear, so say so
  let emptyNote = "";
  if (settingsChanges.show?.length) {
    const { entries } = await tools.call("list_entries");
    const empty = settingsChanges.show.filter((id) => !entries.some((entry) => entry.section === id));
    if (empty.length) emptyNote = ` ${empty.map(titleOf).join(", ")} ${empty.length > 1 ? "have" : "has"} nothing in your portfolio yet, so ${empty.length > 1 ? "they" : "it"} won't appear until you add some.`;
  }
  const fieldDone = fieldChange && (fieldChange.keepOnly
    ? `kept only the ${fieldChange.keepOnly} on ${namesOf(fieldChange.entries)}`
    : `${fieldChange.hide ? "removed" : "put back"} ${listOfWords(fieldChange.fields.map((id) => FIELDS[id].name))} ${fieldChange.hide ? "from" : "on"} ${namesOf(fieldChange.entries)}`);

  if (plan.status && !plan.reset && !Object.keys(settingsChanges).length && !targets.hide.length && !targets.show.length && !plan.accent) {
    const { entries } = await tools.call("list_entries");
    return { result: { status: await tools.call("get_resume_settings"), labels: Object.fromEntries(entries.map((entry) => [keyOf(entry), entry.label])) }, steps: ["Read the settings with the MCP tool get_resume_settings"] };
  }

  if (plan.scope === "portfolio") {
    for (const [list, value] of [[targets.hide, false], [targets.show, true]]) {
      for (const entry of list) {
        await tools.call("set_entry_visibility", { section: entry.section, id: entry.id, showInPortfolio: value });
        done.push(`${value ? "showing" : "hid"} ${entry.label} on your portfolio`);
      }
    }
    if (done.length) steps.push("Saved with the MCP tool set_entry_visibility (Show in portfolio)");
    return { result: { done, layoutNote }, steps };
  }

  if (plan.scope === "all") {
    for (const [list, value] of [[targets.hide, false], [targets.show, true]]) {
      for (const entry of list) {
        await tools.call("set_entry_visibility", { section: entry.section, id: entry.id, showInResume: value });
        done.push(`${value ? "showing" : "hid"} ${entry.label} on every resume`);
      }
    }
    if (targets.hide.length || targets.show.length) steps.push("Saved with the MCP tool set_entry_visibility (Show in resume)");
    if (Object.keys(settingsChanges).length) {
      await tools.call("update_resume_settings", settingsChanges);
      const said = [...describeChanges(settingsChanges), fieldDone, ...pageDone, ...orderDone, ...layoutDone].filter(Boolean);
      done.push(`on every resume: ${said.join(", ")}`);
      steps.push("Saved for every resume with the MCP tool update_resume_settings");
    }
    if (plan.accent) {
      await tools.call("update_resume_settings", { designId, accent: plan.accent });
      done.push("recoloured this resume");
    }
    return { result: { done, emptyNote, layoutNote }, steps };
  }

  // This resume only. "All my certifications" also brings back any left off it
  const allAsked = Object.entries(plan.limits || {}).filter(([, count]) => count === null).map(([id]) => `${id}:`);
  const hiddenNow = allAsked.length || fieldChange?.restore.length ? (await tools.call("get_resume_settings")).designs?.[designId]?.hiddenEntries || [] : [];
  const restored = hiddenNow.filter((key) => allAsked.some((prefix) => key.startsWith(prefix)));
  const changes = { ...settingsChanges, designId };
  if (restored.length) changes.showEntries = restored;
  const broughtBack = (fieldChange?.restore || []).filter((entry) => hiddenNow.includes(keyOf(entry)));
  if (broughtBack.length) changes.showEntries = [...(changes.showEntries || []), ...broughtBack.map(keyOf)];
  if (plan.reset) changes.reset = true;
  if (targets.hide.length) changes.hideEntries = targets.hide.map(keyOf);
  if (targets.show.length) changes.showEntries = [...(changes.showEntries || []), ...targets.show.map(keyOf)];
  if (plan.accent) changes.accent = plan.accent;
  if (plan.clearAccent) changes.accent = "";
  if (Object.keys(changes).length > 1) {
    await tools.call("update_resume_settings", changes);
    steps.push("Saved for this resume only with the MCP tool update_resume_settings");
    if (plan.reset) done.push("reset this resume to the shared settings");
    if (targets.hide.length) done.push(`left ${namesOf(targets.hide)} off this resume`);
    if (targets.show.length) done.push(`put ${namesOf(targets.show)} back on this resume`);
    if (broughtBack.length) done.push(`put ${namesOf(broughtBack)} back on this resume`);
    if (fieldDone) done.push(fieldDone);
    done.push(...pageDone, ...orderDone, ...layoutDone);
    done.push(...describeChanges(settingsChanges));
    if (plan.accent) done.push("recoloured this resume");
    if (plan.clearAccent) done.push("back to this design's own colour");
  }
  return { result: { done, oneColumn, emptyNote, layoutNote }, steps };
}

const LABELS = { experience: "jobs", education: "schools", projects: "projects", certifications: "certifications" };

// What a resume shows, in words
function statusText(status, labels, designId) {
  const settings = designId ? effectiveResumeSettings(status, designId) : status;
  const parts = Object.entries(settings.limits).map(([id, count]) => `${count === 0 ? "all" : count} ${LABELS[id]}`);
  const hiddenNames = (settings.hiddenEntries || []).map((key) => labels?.[key]).filter(Boolean);
  const reworded = (settings.rewrites?.replace || []).map((item) => `"${item.from}" to "${item.to}"`);
  const wordingNote = reworded.length || settings.rewrites?.summary ? ` Reworded here only: ${[...reworded, settings.rewrites?.summary && "the summary"].filter(Boolean).join(", ")}.` : "";
  return `${designId ? "This resume shows" : "Your resumes show"} ${parts.join(", ")} and ${settings.allSkills ? "every skill" : "your 15 key skills"}${settings.extras.length ? `, plus ${settings.extras.join(", ")}` : ""}.${hiddenNames.length ? ` Left off it: ${hiddenNames.join(", ")}.` : designId ? " Nothing is left off it." : ""}${wordingNote}`;
}

function reply({ text, plan, targets, result }, config) {
  if (plan.smallTalk) return { reply: /thank|bye/i.test(text) ? "You're welcome! Tell me if anything else should change on this resume." : "Hi! Tell me what to change on this resume: hide or bring back an entry, remove a detail, how many jobs or projects it shows, extra sections, or its colour." };
  if (result?.answer) return { reply: result.answer };
  if (plan.newEntry) return { reply: "That's new information for your portfolio, so this chat doesn't add it. Tell the main assistant or use your Dashboard, and it can then appear here. To show a section you already have, say \"add Patents\". Nothing changed." };
  if (plan.howTo) return { reply: `Just tell me here, in your own words: "add Patents", "remove the dates from Patents", "remove Patents". Nothing changed yet.` };
  if (plan.bareAsk) return { reply: `What should I do with ${titleOf(plan.bareAsk)}? For example "add ${titleOf(plan.bareAsk)}", "remove ${titleOf(plan.bareAsk)}", or "remove the dates from ${titleOf(plan.bareAsk)}". Nothing changed yet.` };
  if (plan.detailsAsk) {
    const { section } = plan.detailsAsk;
    const name = FIELD_SECTION_NAMES[section];
    if (name) return { reply: `From ${name} I can remove ${listOfWords(detailsOf(section))}. For example "remove the dates from ${name}", or "only the title in ${name}". To take off the whole section, say "remove ${name}". Nothing changed yet.` };
    return { reply: `Which detail? ${Object.entries(FIELD_SECTION_NAMES).map(([id, title]) => `${title}: ${listOfWords(detailsOf(id).map((word) => word.replace(/^the /, "")))}`).join(". ")}. Also your phone, email, LinkedIn, GitHub, location, website, summary and the line under your name. Nothing changed yet.` };
  }
  if (plan.offTopic) return { reply: `I only help with this resume, so I can't answer that. Ask me about your portfolio, or tell me what to change.` };
  if (result?.status) return { reply: `${statusText(result.status, result.labels, config.configurable.designId)} Tell me what to change.` };
  const done = result?.done || [];
  if (!done.length && result?.layoutNote) return { reply: `${result.layoutNote.trim()}${result.layoutNote.includes("?") || result.layoutNote.includes("Try") ? "" : " Nothing changed."}` };
  const moveNote = result?.oneColumn
    ? " This design has one column, so there's no other column to move a section to. Open a two-column design to do that."
    : plan.columns && plan.scope === "portfolio"
      ? " Columns are only on resumes: ask for it on a resume instead of your portfolio."
      : plan.fieldAsk && plan.scope === "portfolio"
        ? " I can only remove a single detail on resumes, not on your portfolio yet. Nothing changed there."
      : plan.partAsk
        ? " I can remove the grade, location, dates, description or organization name from an entry, but not its other details yet, so I left it as it is."
      : plan.styleAsk
        ? ` Tell me how to draw your skills: "skills in boxes", "skills as a list", "skills as bars", "skills as dots" or "skills on one line".`
      : plan.editAsk
        ? ` Tell me the exact old text and the new text, like "change AWS Solutions Architect to AWS Architect". It only changes on this resume. Nothing changed yet.`
      : plan.moveAsk
        ? ` I can move whole sections between the columns, not single entries or your contact details. Try "move Education to the right column".`
        : "";
  const fc = targets.fieldChange;
  const noDetailNote = fc?.noDetail?.length ? ` ${namesOf(fc.noDetail.map((label) => ({ label })))} ${fc.noDetail.length > 1 ? "don't" : "doesn't"} show ${listOfWords(fc.fields.map((id) => FIELDS[id].name))} on a resume, so nothing changed there.` : "";
  const missing = `${noDetailNote}${targets.missing.length ? ` I couldn't find ${targets.missing.map((phrase) => `"${phrase}"`).join(", ")} in your portfolio.` : ""}${moveNote}`;
  if (!done.length) {
    const cantDo = cantDoReply(text);
    if (cantDo) return { reply: cantDo };
    if (moveNote && !targets.missing.length) return { reply: moveNote.trim() };
    return {
      reply: `${missing ? missing.trim() : "I couldn't tell what to change."} Try: "hide" and an entry's name, "change AWS to Amazon Web Services", "remove the grade in MS", "skills in boxes", "only 1 project", "show all my certifications", "add interests", "all skills", "move Education to the right column", "make it navy", "hide Docker from every resume" or "reset this resume".`
    };
  }
  return { reply: `Done: ${done.join("; ")}.${missing}${result?.emptyNote || ""}${result?.layoutNote || ""}` };
}

const customizerGraph = new StateGraph(State)
  .addNode("understand", understand)
  .addNode("find", findEntries)
  .addNode("apply", apply)
  .addNode("respond", reply)
  .addEdge(START, "understand")
  .addEdge("understand", "find")
  .addEdge("find", "apply")
  .addEdge("apply", "respond")
  .addEdge("respond", END)
  .compile();

// text: the user's message; designId: the resume it's about; tools: MCP client
async function runResumeCustomizer({ text, designId, layout = "", sideWidth = 0, llm = null, tools, signal }) {
  const state = await customizerGraph.invoke({ text }, { configurable: { llm, tools, signal, designId, layout, sideWidth }, signal });
  const changed = Boolean(state.result?.done?.length);
  return { reply: state.reply, steps: state.steps, changed, readAs: state.readAs || "" };
}

module.exports = { runResumeCustomizer, rulePlan, keywordsOf, customizerGraph };
