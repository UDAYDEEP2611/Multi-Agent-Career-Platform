const { test } = require("node:test");
const assert = require("node:assert/strict");

const { runResumeCustomizer, rulePlan } = require("../services/agents/resumeCustomizer");
const { analyze } = require("../services/nlp/wordAnalyzer");

const id = (letter) => letter.repeat(24);
const entries = [
  { section: "education", id: id("a"), label: "Master of Science (MS), UNIVERSITY OF MISSOURI KANSAS CITY" },
  { section: "education", id: id("b"), label: "B.Tech, JNTU Hyderabad" },
  { section: "experience", id: id("c"), label: "AI Engineer | Cloud Agentic AI (MCP, A2A) at Oracle" },
  { section: "projects", id: id("d"), label: "Grade Predictor" },
  { section: "certifications", id: id("e"), label: "Microsoft AI & ML Engineering Professional Certificate" },
  { section: "certifications", id: id("f"), label: "AWS Solutions Architect" }
];
const vocabulary = entries.map((entry) => entry.label);
const resumeText = {
  contact: { name: "Sai Uday", phone: "555-0123" },
  summary: "AI Engineer with 4 years of experience at Oracle building agents.",
  experiences: [{ id: id("c"), title: "AI Engineer", organization: "Oracle", summary: "", bullets: ["Built agents with LangGraph", "Cut costs by 27%"] }],
  educations: [{ id: id("a"), degree: "Master of Science (MS)", institution: "UNIVERSITY OF MISSOURI KANSAS CITY" }],
  projects: [{ id: id("d"), title: "Grade Predictor", description: "Predicts grades with PyTorch.", bullets: [] }],
  certifications: [{ id: id("e"), title: "Microsoft AI & ML Engineering Professional Certificate", subtitle: "Microsoft" }, { id: id("f"), title: "AWS Solutions Architect", subtitle: "Amazon Web Services" }]
};

// llm: what a language model would answer, if one is running
async function run(text, { hiddenEntries = [], llm = null, layout = "left" } = {}) {
  const calls = [];
  const tools = {
    call: async (name, args) => {
      calls.push([name, args]);
      if (name === "list_entries") return { entries };
      if (name === "get_resume_settings") return { limits: { experience: 0, education: 2, projects: 2, certifications: 0 }, extras: [], allSkills: false, designs: { navy: { hiddenEntries } } };
      if (name === "search_portfolio") return { results: [], mode: "keyword" };
      if (name === "get_resume_text") return resumeText;
      return {};
    }
  };
  const result = await runResumeCustomizer({ text, designId: "navy", layout, llm, tools });
  return { result, saved: calls.find(([name]) => name === "update_resume_settings")?.[1] };
}

test("the messages that went wrong now do what was asked", async () => {
  let { result, saved } = await run("remove grade in Education");
  assert.deepEqual(saved, { designId: "navy", hideFields: [`education:${id("a")}:grade`, `education:${id("b")}:grade`] });
  assert.match(result.reply, /removed the grade from/);

  ({ result, saved } = await run("remove only grade in MS remaining keep it", { hiddenEntries: [`education:${id("a")}`] }));
  assert.deepEqual(saved, { designId: "navy", hideFields: [`education:${id("a")}:grade`], showEntries: [`education:${id("a")}`] });
  assert.match(result.reply, /put Master of Science .* back on this resume; removed the grade/);

  ({ saved } = await run("In Certifications remove Organization name keep remaimning"));
  assert.deepEqual(saved, { designId: "navy", hideFields: [`certifications:${id("e")}:issuer`, `certifications:${id("f")}:issuer`] });

  ({ saved } = await run("In Certifications remove Organization name keep remaimning like Microsoft AI & ML Engineering Professional Certificate Microsoft change it to Microsoft AI & ML Engineering Professional Certificate"));
  assert.equal(saved.hideEntries, undefined, "nothing comes off the resume");
  assert.equal(saved.hideFields.length, 2);

  ({ result, saved } = await run("in skills u can put everything in box side by side"));
  assert.deepEqual(saved, { designId: "navy", skillStyle: "boxes" });
  assert.match(result.reply, /Skills as boxes side by side/);
  ({ saved } = await run("In Skills put everytghing Like side by side with a box inside and Padding side by side"));
  assert.deepEqual(saved, { designId: "navy", skillStyle: "boxes" });
  ({ saved } = await run("Can U move Education to right column"));
  assert.deepEqual(saved, { designId: "navy", columns: { education: "right" } });
});

test("a detail's word in the sentence never takes the entry off, however it's worded", async () => {
  const ms = `education:${id("a")}`;
  for (const text of [
    "remove the grade part in MS Education Section", "remove the grade section in MS", "remove grade field from MS", "remove the grade details of MS",
    "remove the MS grade part", "in MS remove the grade part", "remove the grade stuff in MS", "drop the grade thing for MS", "get rid of grade info from MS education",
    "take the gpa bit off MS", "hide MS gpa line", "remove grade portion in my MS", "delete the grade value for the MS"
  ]) {
    const { result, saved } = await run(text, { hiddenEntries: [ms] });
    assert.equal(saved?.hideEntries, undefined, `${text} -> ${result.reply}`);
    assert.deepEqual(saved?.hideFields, [`${ms}:grade`], `${text} -> ${result.reply}`);
    assert.deepEqual(saved?.showEntries, [ms], text);
  }
  // Really named that: still the entry
  const { saved } = await run("remove Grade Predictor");
  assert.deepEqual(saved.hideEntries, [`projects:${id("d")}`]);
});

test("a language model's guess can't hide an entry or move a section the message didn't ask for", async () => {
  const llm = (answer) => ({ invokeJson: async () => answer });
  // These answers are what went wrong: one shared word took a job off the resume
  let { saved } = await run("microsoft certificate wording looks odd to me", { llm: llm({ hideEntries: ["AI Engineer | Cloud Agentic AI (MCP, A2A) at Oracle"] }) });
  assert.equal(saved, undefined);
  ({ saved } = await run("these things look odd next to each other side by side", { llm: llm({ columns: { skills: "side" } }) }));
  assert.equal(saved, undefined);
  ({ saved } = await run("please tidy Oracle a little", { llm: llm({ hideEntries: ["Oracle"] }) }));
  assert.equal(saved, undefined, "no word asking to remove it");
  ({ saved } = await run("something about the Oracle job should go, get rid of it", { llm: llm({ hideEntries: ["Oracle"] }) }));
  assert.ok(saved === undefined || saved.hideEntries?.length === 1);
});

test("a language model's reading of skills, and of questions it shouldn't answer", async () => {
  const llm = (answer) => ({ invokeJson: async () => answer });
  assert.equal((await run("only ai skills", { llm: llm({ allSkills: true }) })).saved, undefined);
  // What the real model did: this would have cut the resume to one job
  assert.equal((await run("hide my oldest job", { llm: llm({ limits: { experience: 1 } }) })).saved, undefined);
  assert.equal((await run("jobs feel like too many here", { llm: llm({ limits: { experience: 1 } }) })).saved, undefined);
  assert.deepEqual((await run("keep just one job please thanks", { llm: llm({ limits: { experience: 1 } }) })).saved?.limits, { experience: 1 });
  for (const text of ["what is the weather", "who won the game?"]) {
    const { result, saved } = await run(text, { llm: llm({ answer: "This resume shows a Master's degree." }) });
    assert.equal(saved, undefined);
    assert.match(result.reply, /only help with this resume/, text);
  }
  const noAnswer = await run("???", { llm: llm({ answer: "It does not show any experience." }) });
  assert.doesNotMatch(noAnswer.result.reply, /does not show any experience/);
  // A real question gets the model's answer, and changes nothing
  const asked = await run("is my resume good", { llm: llm({ answer: "It covers your work well." }) });
  assert.equal(asked.result.reply, "It covers your work well.");
  assert.equal(asked.saved, undefined);
});

test("new text from the language model keeps to the facts", async () => {
  const llm = (lines) => ({ invokeJson: async () => ({ lines }) });
  let { result, saved } = await run("rewrite my summary", { llm: llm(["AI Engineer building agents at Oracle, with 4 years of experience."]) });
  assert.deepEqual(saved.rewrite, { summary: "AI Engineer building agents at Oracle, with 4 years of experience." });
  assert.match(result.reply, /on this resume only/);
  // Made-up facts are thrown away
  ({ result, saved } = await run("rewrite my summary", { llm: llm(["AI Engineer with 12 years of experience."]) }));
  assert.equal(saved, undefined);
  assert.match(result.reply, /threw that text away/);
  ({ result, saved } = await run("improve my summary", { llm: llm(["AI Engineer who worked at Google on agents."]) }));
  assert.equal(saved, undefined);
  assert.match(result.reply, /Google/);
  // Dumping more in, or longer when asked for shorter, is thrown away too
  ({ result, saved } = await run("make my summary shorter", { llm: llm(["AI Engineer with 4 years of experience at Oracle building agents, and Oracle agents and more agents."]) }));
  assert.equal(saved, undefined);
  assert.match(result.reply, /longer than it should be/);
  ({ saved } = await run("make my summary shorter", { llm: llm(["AI Engineer building agents at Oracle."]) }));
  assert.equal(saved.rewrite.summary, "AI Engineer building agents at Oracle.");
  // One entry
  ({ result, saved } = await run("rewrite the description of Grade Predictor", { llm: llm(["Forecasts grades using PyTorch."]) }));
  assert.deepEqual(saved.rewrite, { replace: { from: "Predicts grades with PyTorch.", to: "Forecasts grades using PyTorch." } });
  // No model running: says so, changes nothing
  ({ result, saved } = await run("rewrite my summary"));
  assert.equal(saved, undefined);
  assert.match(result.reply, /start Ollama/);
});

test("rewording changes this resume only, keeps the words as typed, and never hides anything", async () => {
  const replaced = {
    "change Microsoft AI & ML Engineering Professional Certificate to Microsoft Certificate": ["Microsoft AI & ML Engineering Professional Certificate", "Microsoft Certificate"],
    "rename Grade Predictor to Marks Predictor": ["Grade Predictor", "Marks Predictor"],
    "replace AWS Solutions Architect with AWS Developer": ["AWS Solutions Architect", "AWS Developer"],
    "Can U change AI Engineer to Senior AI Engineer": ["AI Engineer", "Senior AI Engineer"],
    "change the title of Grade Predictor to GradeNet on this resume": ["Grade Predictor", "GradeNet"],
    "AWS Solutions Architect should read AWS SA": ["AWS Solutions Architect", "AWS SA"],
    "AWS Solutions Architect change it to AWS Architect": ["AWS Solutions Architect", "AWS Architect"],
    "chnage Oracle to Oracle Corp": ["Oracle", "Oracle Corp"],
    "change AWS Solutions Architect to \"zOrBlx teh Certifed\"": ["AWS Solutions Architect", "zOrBlx teh Certifed"]
  };
  for (const [text, [from, to]] of Object.entries(replaced)) {
    const { result, saved } = await run(text);
    assert.deepEqual(saved, { designId: "navy", rewrite: { replace: { from, to } } }, `${text} -> ${result.reply}`);
    assert.equal(result.changed, true, text);
    assert.match(result.reply, /on this resume only/, text);
    assert.match(result.reply, /portfolio keeps the original/, text);
  }
  // The other kinds of wording
  assert.deepEqual((await run("change my phone number to 555-9999")).saved.rewrite, { contact: { phone: "555-9999" } });
  assert.deepEqual((await run("change my name to Sai Uday Reddy")).saved.rewrite, { contact: { name: "Sai Uday Reddy" } });
  assert.deepEqual((await run("rename Experience to Work History")).saved.rewrite, { titles: { experience: "Work History" } });
  assert.deepEqual((await run("change my summary to say I build agents")).saved.rewrite, { summary: "I build agents" });
  assert.deepEqual((await run("change my headline to AI Engineer")).saved.rewrite, { line: "AI Engineer" });
  assert.deepEqual((await run("restore the original wording")).saved.rewrite, { clear: true });
  // Everywhere, when asked; never the portfolio
  const all = await run("change AWS Solutions Architect to AWS SA on all my resumes");
  assert.deepEqual(all.saved, { rewrite: { replace: { from: "AWS Solutions Architect", to: "AWS SA" } } });
  assert.match(all.result.reply, /on every resume/);
  const site = await run("change AWS Solutions Architect to AWS SA on my portfolio");
  assert.equal(site.saved, undefined);
  assert.match(site.result.reply, /portfolio stays as it is/);

  // Not on the resume, or not clear: nothing changes
  const absent = await run("change Zorblx Inc to Zorblx");
  assert.equal(absent.saved, undefined);
  assert.match(absent.result.reply, /couldn't find "Zorblx Inc"/);
  assert.equal((await run("change it to something nicer")).saved, undefined);
  assert.equal((await run("call my project something different")).saved, undefined);

  // What was asked earlier: the title stays, the organization comes off
  const earlier = await run("Microsoft AI & ML Engineering Professional Certificate Microsoft change it to Microsoft AI & ML Engineering Professional Certificate");
  assert.deepEqual(earlier.saved, { designId: "navy", hideFields: [`certifications:${id("e")}:issuer`] });
  const { saved } = await run("change the colour to navy");
  assert.match(saved.accent, /^#/);
});

test("every detail of every section comes off on its own, and comes back", async () => {
  const rows = [...entries,
    { section: "achievements", id: id("1"), label: "Best Paper Award" }, { section: "volunteering", id: id("2"), label: "Food Bank Teacher" },
    { section: "publications", id: id("3"), label: "Agents in Practice" }, { section: "patents", id: id("4"), label: "Graph Retrieval Patent" }];
  const ask = async (text) => {
    const calls = [];
    const tools = { call: async (name, args) => {
      calls.push([name, args]);
      if (name === "list_entries") return { entries: rows };
      if (name === "get_resume_settings") return { limits: { experience: 0, education: 2, projects: 2, certifications: 0 }, extras: [], designs: { navy: { hiddenEntries: [] } } };
      if (name === "search_portfolio") return { results: [], mode: "keyword" };
      return {};
    } };
    const result = await runResumeCustomizer({ text, designId: "navy", layout: "left", tools });
    return { result, saved: calls.find(([name]) => name === "update_resume_settings")?.[1] };
  };
  const sections = { Experience: ["experience", "c"], Education: ["education", "a"], Projects: ["projects", "d"], Certifications: ["certifications", "e"], Achievements: ["achievements", "1"], "Volunteer Details": ["volunteering", "2"], Publications: ["publications", "3"], Patents: ["patents", "4"] };
  const words = {
    Experience: { "job title": "role", "the role": "role", "the company": "issuer", "company name": "issuer", employer: "issuer", location: "location", city: "location", dates: "dates", duration: "dates", description: "description", "bullet points": "bullets", responsibilities: "bullets" },
    Education: { degree: "degree", "degree name": "degree", "the university": "issuer", "school name": "issuer", college: "issuer", major: "field", "field of study": "field", location: "location", years: "dates", grade: "grade", gpa: "grade", percentage: "grade" },
    Projects: { "the role": "role", "project label": "source", dates: "dates", description: "description", tasks: "bullets", bullets: "bullets" },
    Certifications: { issuer: "issuer", "organization name": "issuer", provider: "issuer", dates: "dates", year: "dates" },
    Achievements: { issuer: "issuer", organization: "issuer", date: "dates", description: "description" },
    "Volunteer Details": { role: "role", organization: "issuer", "organization name": "issuer", dates: "dates", description: "description", duration: "dates" },
    Publications: { publisher: "issuer", date: "dates" },
    Patents: { "patent number": "issuer", status: "issuer", date: "dates" }
  };
  // Every entry in that section
  const keysOf = (section, field) => rows.filter((entry) => entry.section === section).map((entry) => `${section}:${entry.id}:${field}`);
  const forms = (word, name) => [`remove ${word} from ${name}`, `hide the ${word} in ${name}`, `In ${name} remove ${word} keep the rest`, `drop ${word} for ${name}`, `REMOVE ${word.toUpperCase()} FROM ${name.toUpperCase()}`];
  let checked = 0;
  for (const [name, list] of Object.entries(words)) {
    const [section] = sections[name];
    for (const [word, field] of Object.entries(list)) {
      for (const text of forms(word, name)) {
        const { result, saved } = await ask(text);
        assert.equal(saved?.hideEntries, undefined, `${text} hid an entry`);
        assert.deepEqual(saved?.hideFields, keysOf(section, field), `${text} -> ${result.reply}`);
        checked += 1;
      }
      assert.deepEqual((await ask(`show the ${word} in ${name}`)).saved?.showFields, keysOf(section, field), `show ${word} in ${name}`);
    }
  }
  assert.ok(checked >= 250, `${checked}`);

  // By entry, across sections, and everywhere
  assert.deepEqual((await ask("remove the dates from Food Bank Teacher")).saved.hideFields, [`volunteering:${id("2")}:dates`]);
  assert.equal((await ask("remove dates from everything")).saved.hideFields.length, 10);
  assert.equal((await ask("remove dates from all sections")).saved.hideFields.length, 10);
  assert.equal((await ask("remove dates from projects and patents")).saved.hideFields.length, 2);
  // Keep only
  const kept = (await ask("only the title in Volunteer Details")).saved.hideFields;
  assert.deepEqual(kept.sort(), ["description", "dates", "issuer", "role"].map((field) => `volunteering:${id("2")}:${field}`).sort());
  assert.ok(!(await ask("only role and dates for Food Bank Teacher")).saved.hideFields.some((key) => /:(?:role|dates)$/.test(key)));
  // "only" after a remove word is the opposite
  assert.deepEqual((await ask("remove only dates from Food Bank Teacher")).saved.hideFields, [`volunteering:${id("2")}:dates`]);
  assert.deepEqual((await ask("delete just the role from Food Bank Teacher")).saved.hideFields, [`volunteering:${id("2")}:role`]);
  // Which details? It lists them
  assert.match((await ask("remove details from Volunteer Details")).result.reply, /From Volunteering I can remove the dates, the description, the role and the organization name/);
  assert.match((await ask("what can i remove from certifications")).result.reply, /From Certifications I can remove/);
  // The detail isn't there: says so
  const none = await ask("remove the grade from Oracle");
  assert.equal(none.saved, undefined);
  assert.match(none.result.reply, /doesn't show the grade/);
  // Words that also mean a section still mean it alone
  assert.equal((await ask("remove my degrees")).saved?.hideFields, undefined);
  assert.deepEqual((await ask("hide the Grade Predictor project")).saved.hideEntries, [`projects:${id("d")}`]);
  assert.equal(rulePlan("hide my school project").fieldAsk, undefined);
  // Contact, page and skills
  assert.deepEqual((await ask("remove my portfolio link")).saved.hideFields, ["contact:portfolio"]);
  assert.equal((await ask("remove ratings from skills")).saved.skillStyle, "list");
  assert.match((await ask("remove my name")).result.reply, /needs your name/);
});

test("every way of asking to remove a detail keeps the entry", () => {
  const verbs = ["remove", "hide", "drop", "delete", "take off", "get rid of", "leave out", "omit", "no", "without"];
  const details = ["grade", "the grade", "my gpa", "cgpa", "marks", "percentage", "location", "the city", "dates", "the years", "description", "bullet points", "organization name", "the issuer", "provider"];
  const places = ["", " in Education", " from MS", " for my masters", " in Certifications", " from Oracle", " on this resume", " in MS remaining keep it", " keep the rest", " but keep everything else"];
  let checked = 0;
  for (const verb of verbs) for (const detail of details) for (const place of places) {
    const text = `${verb} ${detail}${place}`;
    const plan = rulePlan(text);
    assert.ok(plan.fieldAsk, `read as a detail: ${text} -> ${JSON.stringify(plan)}`);
    assert.equal(plan.hideEntries, undefined, text);
    checked += 1;
  }
  assert.equal(checked, 1500);
});

test("every way of asking to move a section moves it, and names with those words stay names", () => {
  const sections = [["education", "education"], ["my skills", "skills"], ["certs", "certifications"], ["the summary", "summary"], ["projects", "projects"]];
  const places = [["to the right column", "right"], ["to the left", "left"], ["on the right side", "right"], ["in the sidebar", "side"], ["to the main column", "main"], ["in the small column", "side"]];
  for (const verb of ["move", "shift", "put", "place", "send", "can you move", "please move"]) for (const [said, section] of sections) for (const [where, place] of places) {
    const text = `${verb} ${said} ${where}`;
    assert.deepEqual(rulePlan(text).columns, { [section]: place }, text);
  }
  assert.deepEqual(rulePlan("hide the Grade Predictor project").hideEntries, ["Grade Predictor project"]);
  assert.equal(rulePlan("hide the Grade Predictor project").fieldAsk, undefined);
  assert.equal(rulePlan("left off education").columns, undefined);
  assert.equal(rulePlan("make it side by side").columns, undefined);
  assert.equal(rulePlan("show all my certifications").fieldAsk, undefined);
  assert.equal(rulePlan("remove my degrees").partAsk, undefined);
  assert.equal(rulePlan("only 1 project").fieldAsk, undefined);
});

test("typos in these requests read the same as the clean sentence", () => {
  const cases = [
    ["remvoe grade in eduction", "fieldAsk"], ["remove gpa form MS", "fieldAsk"], ["REMOVE GRADE IN EDUCATION", "fieldAsk"],
    ["remove orgnization name in certifcations", "fieldAsk"], ["hide the locaton in experiance", "fieldAsk"],
    ["move eduction to rigth colum", "columns"], ["MOVE SKILLS TO THE LEFT COLUMN", "columns"], ["shfit certs to the sidebr", "columns"],
    ["put my skils in boxs", "skillStyle"], ["skils side by side", "skillStyle"], ["SKILLS IN BOXES", "skillStyle"]
  ];
  for (const [text, field] of cases) {
    const corrected = analyze(text, { vocabulary }).corrected;
    assert.ok(rulePlan(corrected)[field], `${text} -> ${corrected} -> ${JSON.stringify(rulePlan(corrected))}`);
  }
});

test("odd requests get a useful reply and never change anything they didn't ask for", async () => {
  const saves = {
    "Can U add Volunteer Details to right column": { show: ["volunteering"], columns: { volunteering: "right" } },
    "add volunteer experience to the left": { show: ["volunteering"], columns: { volunteering: "left" } },
    "add other sections": { show: ["achievements", "recommendations", "volunteering", "publications", "patents", "interests"] },
    "remove my phone number": { hideFields: ["contact:phone"] },
    "hide my email": { hideFields: ["contact:email"] },
    "remove linkedin": { hideFields: ["contact:linkedin"] },
    "remove summary": { hideFields: ["page:summary"] },
    "hide headline": { hideFields: ["page:line"] },
    "show my headline instead of roles": { hideFields: ["page:roles"] },
    "no colour": { accent: "" },
    "add more skills": { allSkills: true }
  };
  for (const [text, want] of Object.entries(saves)) {
    const { saved } = await run(text);
    assert.deepEqual(saved, { designId: "navy", ...want }, text);
  }
  const order = (await run("put projects before experience")).saved.order;
  assert.ok(order.indexOf("projects") < order.indexOf("experience"));
  assert.equal((await run("move experience to the top")).saved.order[0], "experience");
  const swapped = (await run("swap education and experience")).saved.order;
  assert.ok(swapped.indexOf("education") < swapped.indexOf("experience"));

  const nothing = ["make it one page", "make it pop", "undo", "undo that", "clear it all", "delete everything", "remove everything", "hide all", "remove all", "delete my account", "delete my resume", "drop table users",
    "go back", "yes", "no", "do it", "hide it", "put it back", "remove that one", "never mind", "this is ugly", "i hate this", "something feels off", "not good", "make it better", "make it look professional",
    "make the font bigger", "use a serif font", "reduce the spacing", "add a photo", "remove my photo", "add languages", "translate to spanish", "download this as pdf", "email this to my boss",
    "write a better summary", "tailor this to a data engineer job", "add python to my skills", "add a project called zorb", "my job at oracle ended in 2024", "remove the second project", "hide my oldest job", "remove soft skills", "hide skills below 3",
    "what's my gpa", "where did i work", "is this resume good", "what should i improve", "will this pass ATS", "do i know python", "why is education missing", "who are you", "what can you do", "what is the weather", "lol", "asdfghjkl", "???", "123", "<script>alert(1)</script>", "tell me a joke",
    "black and white", "dark mode", "make the sidebar wider", "remove the sidebar", "one column please", "use a different template", "change the order of sections", "show less", "show more"];
  for (const text of nothing) {
    const { result, saved } = await run(text);
    assert.equal(saved, undefined, `${text} changed something: ${JSON.stringify(saved)}`);
    assert.ok(result.reply.length > 10, text);
    assert.equal(result.changed, false, text);
  }
  assert.match((await run("where did i work")).result.reply, /Oracle/);
  assert.match((await run("undo that")).result.reply, /reset this resume/);
  // A section with nothing in it can't appear: it says so
  assert.match((await run("add patents")).result.reply, /Patents has nothing in your portfolio/);
});

test("badly worded messages do what they ask, and nothing else", async () => {
  const messages = require("./fixtures/resumeChatMessages");
  const rows = [
    ["education", "a", "Master of Science (MS), UNIVERSITY OF MISSOURI KANSAS CITY"], ["experience", "c", "AI Engineer at Oracle"], ["projects", "d", "Blood Bank Management System"],
    ["certifications", "e", "AWS Solutions Architect"], ["achievements", "1", "Best Paper Award"], ["volunteering", "2", "Teacher at Food Bank"], ["publications", "3", "Agents in Practice"],
    ["patents", "4", "Graph Retrieval"], ["interests", "5", "Chess"], ["recommendations", "6", "Jane Smith"], ["skills", "9", "Docker"]
  ].map(([section, letter, label]) => ({ section, id: id(letter), label }));
  const wrong = [];
  for (const [text, want] of messages) {
    const saved = [];
    const tools = { call: async (name, args) => {
      if (name === "update_resume_settings" || name === "set_entry_visibility") {
        const { designId, ...change } = args;
        saved.push(change);
      }
      if (name === "list_entries") return { entries: rows };
      if (name === "get_resume_settings") return { limits: { experience: 0, education: 2, projects: 2, certifications: 0 }, extras: [], designs: {} };
      if (name === "search_portfolio") return { results: [], mode: "keyword" };
      if (name === "get_resume_text") return { summary: "x", experiences: [], certifications: [] };
      return {};
    } };
    await runResumeCustomizer({ text, designId: "navy", layout: "left", tools });
    const json = JSON.stringify(saved).replace(/([0-9a-f])\1{23}/g, "$1");
    if (want === null ? saved.length : !want.test(json)) wrong.push(`${text} -> ${json}`);
  }
  assert.deepEqual(wrong, []);
});

test("names that share a word or a colour are still names, and details aren't the section", async () => {
  const rows = [
    { section: "projects", id: id("a"), label: "Blood Bank Management System" }, { section: "volunteering", id: id("b"), label: "Teacher at Food Bank" },
    { section: "volunteering", id: id("c"), label: "First Aid Volunteer at Red Cross" }
  ];
  const ask = async (text, list = rows) => {
    const calls = [];
    const tools = {
      call: async (name, args) => {
        calls.push([name, args]);
        if (name === "list_entries") return { entries: list };
        if (name === "get_resume_settings") return { limits: {}, extras: ["volunteering"], allSkills: false, designs: { navy: {} } };
        if (name === "search_portfolio") return { results: [{ id: `project:${id("a")}`, text: "Blood Bank Management System" }], mode: "keyword" };
        if (name === "get_resume_text") return { summary: "", volunteering: [{ id: id("c"), organization: "Red Cross" }] };
        return {};
      }
    };
    const result = await runResumeCustomizer({ text, designId: "navy", layout: "left", llm: null, tools });
    return { reply: result.reply, saved: calls.find(([name]) => name === "update_resume_settings")?.[1] };
  };
  const onlyProject = rows.slice(0, 1);

  // One shared word isn't a name: nothing else comes off instead
  assert.deepEqual((await ask("remove the dates from Food Bank")).saved.hideFields, [`volunteering:${id("b")}:dates`]);
  assert.deepEqual((await ask("remove the dates from Blood Bank")).saved.hideFields, [`projects:${id("a")}:dates`]);
  for (const text of ["remove the dates from Food Bank", "hide Food Bank", "put back Food Bank"]) assert.equal((await ask(text, onlyProject)).saved, undefined, text);
  assert.match((await ask("hide Food Bank", onlyProject)).reply, /Food Bank/);

  // Colour words inside names
  assert.deepEqual((await ask("hide Red Cross")).saved.hideEntries, [`volunteering:${id("c")}`]);
  assert.deepEqual((await ask("hide the Red Cross")).saved.hideEntries, [`volunteering:${id("c")}`]);
  assert.deepEqual((await ask("put back Red Cross")).saved.showEntries, [`volunteering:${id("c")}`]);
  const reworded = (await ask("change Red Cross to American Red Cross")).saved;
  assert.deepEqual(reworded.rewrite, { replace: { from: "Red Cross", to: "American Red Cross" } });
  assert.equal(reworded.accent, undefined);

  // Real colour requests still recolour
  for (const text of ["make it red", "red", "change it to red", "change the colour to red", "change the resume to dark red"]) assert.ok((await ask(text)).saved?.accent, text);

  // Details of a section are a question; the section itself still comes off
  const { reply, saved } = await ask("remove details from volunteer details");
  assert.equal(saved, undefined);
  assert.match(reply, /From Volunteering I can remove .*"remove Volunteering"\. Nothing changed yet/);
  assert.deepEqual((await ask("remove volunteering")).saved.hide, ["volunteering"]);
  assert.deepEqual((await ask("remove the volunteer section")).saved.hide, ["volunteering"]);
  assert.equal((await ask("remove the dates from volunteer details")).saved.hideFields.length, 2);
});
