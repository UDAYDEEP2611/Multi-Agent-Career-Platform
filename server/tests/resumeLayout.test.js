const { test } = require("node:test");
const assert = require("node:assert/strict");

const { runResumeCustomizer, rulePlan } = require("../services/agents/resumeCustomizer");
const { layoutChanges } = require("../services/agents/resumeLayout");
const { analyze } = require("../services/nlp/wordAnalyzer");

// [message, what changes, which column, by how much]
const yes = [
["Can U Increase right Layout by 5%","side","right",5],["increase the right column by 5 percent","side","right",5],["make right side 5% wider","side","right",5],["make the right column bigger","side","right",5],
["right column wider please","side","right",5],["widen the left column by 10%","side","left",10],["reduce left column by 3%","side","left",-3],["decrease right layout 5%","side","right",-5],["shrink the left panel a little","side","left",-2],
["can you make the sidebar wider","side","side",5],["sidebar narrower by 4","side","side",-4],["increase side bar width","side","side",5],["make main column larger","side","main",5],["make the main section smaller by 5%","side","main",-5],
["the right column is too narrow","side","right",5],["left column is too wide","side","left",-5],["right side needs more space","side","right",5],["give the right column more room","side","right",5],["give right 5% more","side","right",5],
["i want less room on the left","side","left",-5],["take 5% from left and give it to right","side","left",-5],["widen right and shrink left by 6%","side","right",6],["left smaller, right bigger","side","left",-5],["add five percent to the right hand side","side","right",5],
["increase the width of the left column by 10 percent","side","left",10],["+5% on right column","side","right",5],["expand right part a lot","side","right",10],["increase right layout by five percent","side","right",5],["increase coloumn on the right by 5%","side","right",5],
["move the divider to the right by 5%","side","left",5],["move divider left","side","right",5],["right column 40%","side","right","to40"],["make the right column 40% wide","side","right","to40"],["set sidebar to 35%","side","side","to35"],["increase right column to 45%","side","right","to45"],
["make columns equal","side","left","to50"],["both columns the same width","side","left","to50"],["50/50 columns","side","left","to50"],["60/40 split","side","left","to60"],["left 30 right 70","side","left","to30"],["right 60% left 40%","side","left","to40"],
["reset column width","side","side","reset"],["put the right column back to normal size","side","right","reset"],["how wide is the right column?","side","right","info"],["what is the width of the sidebar","side","side","info"],
["increase margins","margin",null,10],["make margins smaller by 20%","margin",null,-20],["reduce the left margin","margin",null,-10],["less padding","margin",null,-10],["margin 1 inch","margin",null,"pct100"],["reset margins","margin",null,"reset"],
["make the text bigger","text",null,5],["font smaller","text",null,-5],["increase font size by 10%","text",null,10],["make letters a bit bigger","text",null,3],["font size 11pt","text",null,"pct10"],["text is too small","text",null,5],
["reduce the spacing","spacing",null,-10],["tighter spacing","spacing",null,-10],["more line spacing","spacing",null,10],["make it more compact","spacing",null,-10],["make it airy","spacing",null,10],["line height by 20% more","spacing",null,20],["space between sections bigger","spacing",null,10],
["more gap between the columns","gutter",null,25],["reduce gap between columns by 50%","gutter",null,-50],["column gutter smaller","gutter",null,-25],
];

// Not about a size, whatever words they share with one
const no = ["hide the summary","move education to the right column","put skills on the right","make it navy","change the font to arial","use a serif font","remove the right column","why is the right column so narrow","what's on this resume?","make my name bigger","reduce the text in my summary","right now show all projects","that's right","make skills bigger in the right column","don't make the sidebar bigger","only 2 jobs","increase my projects to 5","add more skills","swap Education and Experience","move Education to left","make the right column blue","show 5 certifications","the Right Way project","hide Left Hand Robot project","remove the margin notes project","add Volunteer Details to right column"];

const val = (a) => a.reset ? "reset" : a.info ? "info" : a.to !== undefined ? "to" + a.to : a.percent !== undefined ? "pct" + a.percent : a.by;

async function chat(text, { layout = "right", sideWidth = 34, settings = {}, designId = "sandstone" } = {}) {
  const calls = [];
  const tools = {
    call: async (name, args) => {
      calls.push([name, args]);
      if (name === "list_entries") return { entries: [{ section: "projects", id: "a".repeat(24), label: "Grade Predictor" }] };
      if (name === "get_resume_settings") return { limits: {}, extras: [], designs: {}, ...settings };
      return {};
    }
  };
  const result = await runResumeCustomizer({ text, designId, layout, sideWidth, tools });
  return { result, saved: calls.find(([name]) => name === "update_resume_settings")?.[1] };
}

test("sizes are read however they're asked for, even with typing mistakes corrected", () => {
  for (const [message, key, target, value] of yes) {
    for (const words of [message, analyze(message).corrected]) {
      const ask = rulePlan(words).layoutAsks?.[0];
      assert.ok(ask, `${words}: not read as a size`);
      assert.equal(ask.key, key, words);
      if (target) assert.equal(ask.target, target, words);
      assert.equal(val(ask), value, words);
    }
  }
});

test("other requests aren't mistaken for sizes", () => {
  for (const message of no) assert.equal(rulePlan(message).layoutAsks, undefined, message);
});

test("the column named is the one that grows, wherever the sidebar is", async () => {
  // The sidebar is on the right: the right column grows
  let { result, saved } = await chat("Can U Increase right Layout by 5%");
  assert.equal(result.changed, true, result.reply);
  assert.deepEqual(saved, { designId: "sandstone", tweaks: { sideShift: 5 } });
  assert.match(result.reply, /right column wider \(39% of the page, was 34%\)/);

  // The sidebar is on the left: the right column is the main one, so the sidebar gives way
  ({ result, saved } = await chat("Can U Increase right Layout by 5%", { layout: "left", sideWidth: 32 }));
  assert.deepEqual(saved.tweaks, { sideShift: -5 });
  assert.match(result.reply, /right column wider \(73% of the page, was 68%\)/);
});

test("changes build on each other and stop at a sensible size", async () => {
  const settings = { designs: { sandstone: { tweaks: { sideShift: 5, margin: 10 } } } };
  assert.deepEqual((await chat("right column wider by 5%", { settings })).saved.tweaks, { sideShift: 10 });
  assert.deepEqual((await chat("wider margins", { settings })).saved.tweaks, { margin: 20 });

  const { result, saved } = await chat("make the right column 80% wide");
  assert.deepEqual(saved.tweaks, { sideShift: 16 });
  assert.match(result.reply, /between 20% and 50%/);

  const atLimit = await chat("right column wider", { settings: { designs: { sandstone: { tweaks: { sideShift: 16 } } } } });
  assert.equal(atLimit.saved, undefined);
  assert.equal(atLimit.result.changed, false);
  assert.match(atLimit.result.reply, /can't go any further/);

  assert.deepEqual(layoutChanges([{ key: "text", by: 100 }], {}).tweaks, { text: 30 });
  assert.deepEqual(layoutChanges([{ key: "all", reset: true }], {}).tweaks, { sideShift: 0, margin: 0, gutter: 0, text: 0, spacing: 0 });
});

test("a size comes with whatever else was asked in the same message", async () => {
  let { saved, result } = await chat("increase the right column by 5% and make skills in boxes");
  assert.deepEqual(saved, { designId: "sandstone", skillStyle: "boxes", tweaks: { sideShift: 5 } });
  assert.match(result.reply, /right column wider/);
  assert.match(result.reply, /boxes/);

  ({ saved } = await chat("wider margins and smaller text"));
  assert.deepEqual(saved.tweaks, { margin: 10, text: -5 });

  // A number belongs to the part it was said with, unless a part has no ask of its own
  ({ saved } = await chat("increase the right column by 5% and tighter spacing"));
  assert.deepEqual(saved.tweaks, { sideShift: 5, spacing: -10 });
  ({ saved } = await chat("make margins and spacing smaller by 20%"));
  assert.deepEqual(saved.tweaks, { margin: -20, spacing: -20 });
  ({ saved } = await chat("widen right and shrink left by 6%"));
  assert.deepEqual(saved.tweaks, { sideShift: 6 });
});

test("it says so when a size can't apply, or asks what's meant", async () => {
  const one = await chat("increase right column by 5%", { layout: "single" });
  assert.equal(one.saved, undefined);
  assert.match(one.result.reply, /one column/);

  // ...but a one-column design still has margins and text
  assert.deepEqual((await chat("smaller margins", { layout: "single" })).saved.tweaks, { margin: -10 });

  const which = await chat("increase the width by 5%");
  assert.equal(which.saved, undefined);
  assert.match(which.result.reply, /Which column/);

  const info = await chat("how wide is the right column?");
  assert.equal(info.saved, undefined);
  assert.match(info.result.reply, /right is 34%/);

  const portfolio = await chat("make the right column of my portfolio wider");
  assert.equal(portfolio.saved, undefined);
  assert.match(portfolio.result.reply, /only on resumes/);

  const everyExact = await chat("make the right column wider on all my resumes");
  assert.equal(everyExact.saved, undefined);
  assert.match(everyExact.result.reply, /sidebar wider/);

  const every = await chat("make the sidebar wider by 5% on all my resumes");
  assert.deepEqual(every.saved, { tweaks: { sideShift: 5 } });
});
