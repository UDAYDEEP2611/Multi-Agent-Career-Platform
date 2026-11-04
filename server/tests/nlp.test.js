const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { analyze, featuresOf, fixCommandWords } = require("../services/nlp/wordAnalyzer");
const { predict, modelFor } = require("../services/nlp/trainedModels");
const { rulePlan } = require("../services/agents/resumeCustomizer");
const { planResume, isResumeRequest } = require("../services/agents/designPlanner");

const VOCABULARY = ["Blood Bank Management System", "UltraUnityVerse: Agentic AI Career Portfolio Platform", "Docker"];
const read = (text) => analyze(text, { vocabulary: VOCABULARY }).corrected;

test("typos, shorthand and ALL CAPS are read as words", () => {
  for (const [typed, reading] of [
    ["hide teh blod bank projct", "hide the blood bank project"],
    ["remvoe my certifcations", "remove my certifications"],
    ["SHOW ALL MY PROJCTS ON MY RESUNME", "show all my projects on my resume"],
    ["IN REESUMES ONLY 15 IMP SKILLS", "in resumes only 15 important skills"],
    ["ALL EXOPS INCLUDED", "all experience included"],
    ["chnage colr to blu", "change color to blue"],
    ["rest this resume", "reset this resume"],
    ["i workd at googel as enginer", "i worked at google as engineer"],
    ["wat skils do i hav", "what skills do i have"],
    ["hide ultraunitiverse", "hide ultraunityverse"]
  ]) assert.equal(read(typed), reading);
});

test("names, links and numbers are never corrected", () => {
  for (const text of ["I worked at Zorblax Inc", "my email is jane@gmial.com", "see https://githb.com/x", "i built TabSaver in 2021", "Add Acme Corp to my jobs", "use #1e3a8a"]) {
    assert.equal(read(text), text);
  }
  assert.deepEqual(analyze("the portfolio is ready").corrections, []);
  // Right words the dictionary only knows in another form
  assert.deepEqual(analyze("a startup dishwasher").corrections, []);
});

test("data entry gets its command words fixed and its values kept", () => {
  assert.equal(fixCommandWords("add a projct called Zorblx"), "add a project called Zorblx");
  assert.equal(fixCommandWords("i workd at Googel"), "i worked at Googel");
  assert.equal(fixCommandWords("add kafka to my skils"), "add kafka to my skills");
});

test("the running models compute what training computed", () => {
  for (const task of ["intent", "section", "action"]) {
    const model = modelFor(task);
    assert.ok(model, `${task} model is present`);
    for (const { text, p } of model.golden) {
      const { ranked } = predict(task, text);
      model.labels.forEach((label, index) => {
        assert.ok(Math.abs(ranked.find((item) => item.label === label).p - p[index]) < 0.002, `${task}: "${text}" ${label}`);
      });
    }
  }
});

// A floor on the hand-written sentences, so a retrain can't quietly get worse
test("the shipped models hold up on sentences they never saw", () => {
  const holdout = JSON.parse(fs.readFileSync(path.join(__dirname, "../ml/data/holdout.json")));
  for (const [task, floor] of [["intent", 0.9], ["section", 0.9], ["action", 0.9]]) {
    const right = holdout[task].filter(([text, label]) => predict(task, text).top === label).length;
    assert.ok(right / holdout[task].length >= floor, `${task}: ${right}/${holdout[task].length}`);
  }
  assert.ok(featuresOf("show my projects").some((feature) => feature === "w:project"), "lemmas reach the models");
});

test("the resume planner understands the corrected words", () => {
  const corrected = read("SHOW ALL MY PROJCTS ON MY RESUNME");
  assert.ok(isResumeRequest(corrected));
  assert.deepEqual(planResume(corrected).limits, { projects: null });
  assert.deepEqual(planResume(read("ALL EXOPS ON RESUMES")).limits, { experience: null });
  assert.equal(planResume("hide all projects on my resume").limits, undefined);
});

test("casual wording for hiding an entry", () => {
  for (const [typed, phrase] of [
    ["get rid of blood bank", "blood bank"],
    ["dont want ultraunityverse on here", "ultraunityverse"],
    ["no need for the docker skill here", "docker skill"]
  ]) assert.deepEqual(rulePlan(read(typed)).hideEntries, [phrase]);
});
