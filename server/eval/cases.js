// The evaluation set: chat messages and what the agent must do with each,
// on Alex Morgan's portfolio (eval/memoryTools.js). Written from what a
// person meant, not from what the agents happen to do, so some may fail;
// eval/baseline.json records how many pass.
//
// chat: "resume" (one resume's chat, the "navy" design) or "assistant".
// say: the message, or a list of messages in one conversation.
// expect (each part is checked; see runEval.js):
//   hidden / notHidden   entries left off this resume, by name
//   hiddenFields         details left off, as "<entry name>:<field>"
//   settings             this resume's settings (limits, extras, columns, accent...)
//   shared               the settings every resume shares
//   resume / portfolio   { "<entry name>": false } for Show in resume / portfolio
//   agent                which agent answered (assistant)
//   draft                an entry put in the buffer: { section, data }
//   pending              the question the agent is waiting on
//   design               a custom design created or changed
//   mentions             names the reply must include
//   reply                a pattern the reply must match
//   asks                 asks which one, changing nothing
//   nothing              changes nothing

const MS = "Master of Science, University of North Texas";
const BTECH = "B.Tech, JNTU Hyderabad";
const ORACLE = "AI Engineer at Oracle";
const PAYPAL = "Software Engineer at PayPal";
const INTERN = "Machine Learning Intern at Acme Labs";
const AWS = "AWS Solutions Architect";

// Exactly an empty list, or an empty object
const EMPTY = /^\[\]$/;
const NONE = /^\{\}$/;

const resume = (group, say, expect, extra = {}) => ({ chat: "resume", group, say, expect, ...extra });
const assistant = (group, say, expect, extra = {}) => ({ chat: "assistant", group, say, expect, ...extra });

module.exports = [
  // ---- One resume: entries on and off ---------------------------------------
  resume("hide", "hide the Blood Bank project", { hidden: ["Blood Bank Management System"] }),
  resume("hide", "remove blood bank from this resume", { hidden: ["Blood Bank Management System"] }),
  resume("hide", "hide teh blod bank projct", { hidden: ["Blood Bank Management System"] }),
  resume("hide", "hide internship", { hidden: [INTERN] }),
  resume("hide", "take my internship off", { hidden: [INTERN] }),
  resume("hide", "I don't want the Acme Labs job here", { hidden: [INTERN] }),
  resume("hide", "drop the PayPal job", { hidden: [PAYPAL] }),
  resume("hide", "hide the grade predictor and fraud lens projects", { hidden: ["Grade Predictor", "Fraud Lens"] }),
  resume("hide", "remove my bachelors", { hidden: [BTECH] }),
  resume("hide", "hide the AWS certification", { hidden: [AWS] }),
  resume("hide", "take the knowledge assistant project off", { hidden: ["Knowledge Assistant"] }),
  resume("hide", ["hide the Blood Bank project", "put blood bank back"], { notHidden: ["Blood Bank Management System"] }),
  resume("hide", ["hide the PayPal job", "bring back paypal"], { notHidden: [PAYPAL] }),
  resume("hide", "hide the Zorblax project", { nothing: true, reply: /couldn't find/i }),

  // ---- One resume: how much shows ------------------------------------------
  resume("limits", "only 1 project", { settings: { limits: { projects: 1 } } }),
  resume("limits", "show just 2 jobs", { settings: { limits: { experience: 2 } } }),
  resume("limits", "show all my projects", { settings: { limits: { projects: 0 } } }),
  resume("limits", "only my latest school", { settings: { limits: { education: 1 } } }),
  resume("limits", "show every certification", { settings: { limits: { certifications: 0 } } }),
  resume("limits", "all skills", { settings: { allSkills: true } }),
  resume("limits", "only 3 projcts pls", { settings: { limits: { projects: 3 } } }),

  // ---- One resume: sections -------------------------------------------------
  resume("sections", "add interests", { settings: { extras: ["interests"] } }),
  resume("sections", "add my volunteering", { settings: { extras: ["volunteering"] } }),
  resume("sections", "include publications and awards", { settings: { extras: ["publications", "achievements"] } }),
  resume("sections", "add hobbies", { settings: { extras: ["interests"] } }),
  resume("sections", ["add interests", "remove interests"], { settings: { extras: EMPTY } }),
  resume("sections", "hide the summary", { hiddenFields: ["page:summary"] }),
  resume("sections", "remove my headline", { hiddenFields: [/page:(headline|line)/] }),

  // ---- One resume: layout and look -----------------------------------------
  resume("layout", "move education to the right column", { settings: { columns: { education: "right" } } }),
  resume("layout", "put skills in the sidebar", { settings: { columns: { skills: "side" } } }),
  resume("layout", "put projects before experience", { settings: { order: /projects.*experience/ } }),
  resume("layout", "move skills to the top", { settings: { order: /^\["skills"/ } }),
  resume("layout", "skills as bars", { settings: { skillStyle: "bars" } }),
  resume("layout", "show skills in boxes", { settings: { skillStyle: "boxes" } }),
  resume("layout", "skills on one line", { settings: { skillStyle: "inline" } }),
  resume("layout", "make it navy", { settings: { accent: /^#[0-9a-f]{6}$/i } }),
  resume("layout", "change the colour to dark green", { settings: { accent: /^#[0-9a-f]{6}$/i } }),
  resume("layout", "make the sidebar 5% wider", { settings: { tweaks: { sideShift: 5 } } }),
  resume("layout", "tighter spacing", { settings: { tweaks: { spacing: /^-/ } } }),
  resume("layout", "move education to the right column", { nothing: true, reply: /one column/i }, { layout: "single" }),

  // ---- One resume: details --------------------------------------------------
  resume("details", "remove the grade in MS", { hiddenFields: [`${MS}:grade`] }),
  resume("details", "no gpa", { hiddenFields: [`${MS}:grade`, `${BTECH}:grade`] }),
  resume("details", "remove the location from Oracle", { hiddenFields: [`${ORACLE}:location`] }),
  resume("details", "remove the dates from blood bank", { hiddenFields: ["Blood Bank Management System:dates"] }),
  resume("details", "remove my phone number", { hiddenFields: ["contact:phone"] }),
  resume("details", "hide my linkedin", { hiddenFields: ["contact:linkedin"] }),
  resume("details", "certs without issuer", { hiddenFields: [`${AWS}:issuer`] }),
  resume("details", ["no gpa", "bring back gpa"], { settings: { hiddenFields: EMPTY } }),

  // ---- One resume: wording ---------------------------------------------------
  resume("wording", "rename Projects to Things I built", { settings: { rewrites: { titles: { projects: "Things I built" } } } }),
  resume("wording", "call experience Work History", { settings: { rewrites: { titles: { experience: "Work History" } } } }),
  resume("wording", "change AWS to Amazon Web Services", { settings: { rewrites: { replace: [{ from: /AWS/, to: "Amazon Web Services" }] } } }),
  resume("wording", ["rename Projects to Things I built", "restore the original wording"], { settings: { rewrites: { titles: NONE } } }),

  // ---- More than this resume -------------------------------------------------
  resume("scope", "hide Docker from every resume", { resume: { Docker: false } }),
  resume("scope", "hide blood bank from my portfolio", { portfolio: { "Blood Bank Management System": false } }),
  resume("scope", "remove the internship from all my resumes", { resume: { [INTERN]: false } }),
  resume("scope", "move education to the right column on all my resumes", { shared: { columns: { education: "right" } } }),
  resume("scope", "skills as a list on every resume", { shared: { skillStyle: "list" } }),

  // ---- Questions and starting over -----------------------------------------
  resume("questions", "what's on this resume?", { nothing: true, reply: /This resume shows/ }),
  resume("questions", ["hide the Blood Bank project", "what did I hide?"], { reply: /Blood Bank/ }),
  resume("questions", "which projects use LangGraph?", { nothing: true, mentions: ["UltraUnityVerse"] }),
  resume("questions", ["hide the PayPal job", "only 1 project", "reset this resume"], { settings: { hiddenEntries: EMPTY, limits: { projects: 2 } } }),

  // ---- Unclear or out of reach: ask or say so, change nothing ---------------
  resume("unclear", "hide the engineer job", { asks: true }),
  resume("unclear", "remove the computer science degree", { asks: true }),
  resume("unclear", "hide the project", { asks: true }),
  resume("unclear", "purple monkey dishwasher", { nothing: true }),
  resume("unclear", "change the font to Comic Sans", { nothing: true }),
  resume("unclear", "add a photo of me", { nothing: true }),
  resume("unclear", "make it fit on one page", { nothing: true }),
  resume("unclear", "translate my resume to French", { nothing: true }),
  resume("unclear", "remove", { nothing: true }),
  resume("unclear", "this is useless", { nothing: true }),

  // ---- Assistant: which agent ------------------------------------------------
  assistant("route", "I did my MS in Data Science at UT Dallas from 2019 to 2021", { agent: "data-entry" }),
  assistant("route", "Use Playfair Display for headings", { agent: "design" }),
  assistant("route", "Which projects used LangGraph?", { agent: "qa" }),
  assistant("route", "hi", { agent: "supervisor", nothing: true }),
  assistant("route", "what can you do?", { agent: "supervisor", nothing: true }),
  assistant("route", "where did I work before Oracle?", { agent: "qa" }),
  assistant("route", "make a dark version of Aurora", { agent: "design" }),
  assistant("route", "add Kubernetes to my skills", { agent: "data-entry" }),

  // ---- Assistant: adding to the portfolio ------------------------------------
  assistant("entry", "add Kubernetes to my skills", { draft: { section: "skills", data: { name: "Kubernetes" } } }),
  assistant("entry", "add python to my skills", { nothing: true, reply: /already/i }),
  assistant("entry", "I got the AWS Machine Learning Specialty certification from Amazon Web Services in March 2025", { draft: { section: "certifications", data: { name: /Machine Learning Specialty/, issuingOrganization: /Amazon Web Services/ } } }),
  assistant("entry", "I studied Data Science at UT Dallas from 2019 to 2021", { pending: { section: "education", asked: "degree" } }),
  assistant("entry", ["I studied Data Science at UT Dallas from 2019 to 2021", "M.S."], { draft: { section: "education", data: { degree: "M.S.", fieldOfStudy: "Data Science", startYear: 2019, endYear: 2021 } } }),
  assistant("entry", "I worked as a Data Scientist at Verizon from 2019", { pending: { section: "experience" }, reply: /still work there/i }),
  assistant("entry", "I won the Hackathon Grand Prize at HackTX in 2022", { pending: { section: "achievements", asked: "category" } }),
  assistant("entry", ["I won the Hackathon Grand Prize at HackTX in 2022", "Award"], { draft: { section: "achievements", data: { title: /Hackathon Grand Prize/, category: "Award", year: 2022 } } }),
  assistant("entry", "I volunteer as a tutor at Literacy Texas since 2023", { draft: { section: "volunteering", data: { organization: /Literacy Texas/ } } }),
  assistant("entry", "add rock climbing to my interests", { draft: { section: "interests", data: { name: /rock climbing/i } } }),
  assistant("entry", "Add my MS in Computer Science from University of North Texas", { reply: /already have/i }),
  assistant("entry", "add a project called Route Planner, a React app that plans delivery routes", { draft: { section: "projects", data: { title: /Route Planner/ } } }),

  // ---- Assistant: designs ----------------------------------------------------
  assistant("design", "Make a dark green Slate called Forest and hide projects", { design: { name: "Forest", baseId: "slate", accent: /^#/, hide: ["projects"] } }),
  assistant("design", "create a design from Aurora called Night Sky", { design: { name: "Night Sky", baseId: "aurora" } }),
  assistant("design", ["Make a Slate called Forest", "rename Forest to Pine"], { design: { name: "Pine" } }),
  assistant("design", ["Make a Slate called Forest", "use rounded corners on Forest"], { design: { name: "Forest", corners: /round/ } }),
  assistant("design", "Use Playfair Display for headings", { design: { headingFont: /Playfair/ } }),

  // ---- Assistant: questions ----------------------------------------------------
  assistant("qa", "Which projects used LangGraph?", { agent: "qa", nothing: true, mentions: ["UltraUnityVerse"] }),
  assistant("qa", "where did I study computer science?", { agent: "qa", mentions: ["University of North Texas"] }),
  assistant("qa", "what did I do at PayPal?", { agent: "qa", mentions: ["fraud"] }),
  assistant("qa", "which certifications do I have?", { agent: "qa", mentions: ["AWS Solutions Architect"] }),
  assistant("qa", "have I worked with XGBoost?", { agent: "qa", mentions: ["PayPal"] }),
  assistant("qa", "what is my current job?", { agent: "qa", mentions: ["Oracle"] })
];
