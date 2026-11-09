const { StateGraph, Annotation, START, END } = require("@langchain/langgraph");
const { runDataEntry } = require("./dataEntryAgent");
const { runDesign } = require("./designAgent");
const { runQa } = require("./qaAgent");
const { sectionFromText } = require("./sectionSpecs");
const { ruleChanges, planResume, isResumeRequest } = require("./designPlanner");
const { detectIntent } = require("./ml/intentEnsemble");
const { analyze, fixCommandWords, describeCorrections } = require("../nlp/wordAnalyzer");

const AGENT_NAMES = { entry: "data entry agent", design: "design agent", qa: "Q&A agent" };
const INTENT_NAMES = { entry: "add to your portfolio", design: "change a design", qa: "a question", help: "small talk" };

const AGENT_FOR_INTENT = { entry: "entry", design: "design", qa: "qa", help: "help" };
const INTENT_CHOICES = { entry: "Add to my portfolio", design: "Change a design", qa: "Ask about my portfolio" };

// The chat's supervisor, a LangGraph router over the specialist agents:
//
//            ┌→ dataEntry (LangGraph: add to a section via the buffer zone)
//   route ───┼→ design    (A2A Portfolio Designer + MCP tools)
//            ├→ qa        (LangGraph: hybrid RAG + GraphRAG answers)
//            └→ help
//
// route follows, in order: the agent the user picked, an entry waiting for
// an answer, clear wording (rules), the Naive Bayes intent classifier (plus
// embeddings when installed), and the language model. When none of them is
// sure, it asks the user what they meant.
//
// route follows, in order: the agent the user picked in the chat, an entry
// still waiting for an answer, clear wording (rules), and the language
// model when the wording is unclear.

const ROUTE_PROMPT = [
  "Pick the agent for the user's chat message:",
  "- entry: they're telling you something to ADD to their portfolio (a degree, job, project, certification, award, volunteering, publication, patent, interest).",
  "- design: they want to create or change a portfolio design (colours, fonts, layout, hiding or showing sections).",
  "- qa: they're asking a question about their own portfolio or career details.",
  "- help: greetings, thanks, or asking what you can do.",
  'Reply with JSON only: {"agent": "entry" | "design" | "qa" | "help"}'
].join("\n");


const State = Annotation.Root({
  choices: Annotation(),
  decision: Annotation(),
  text: Annotation(),
  mode: Annotation(),
  pending: Annotation(),
  context: Annotation(),
  agent: Annotation(),
  result: Annotation(),
  steps: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] })
});

// The names in the user's own entries, so "blod bank" finds their Blood Bank
async function vocabularyOf(tools) {
  try {
    return (await tools.call("list_entries")).entries.map((entry) => entry.label);
  } catch {
    return [];
  }
}

// A design's new name is the user's to spell
const NAMES_SOMETHING = /\b(?:called|named|titled|call it|name it|rename)\b/i;

async function route({ text: message, mode, pending, context }, config) {
  const { llm, signal, intentModel, tools } = config.configurable;
  const text = message;
  if (["entry", "design", "qa"].includes(mode)) {
    return { agent: mode, decision: { predicted: mode, confidence: 1, decidedBy: "you" }, steps: [`Using the ${AGENT_NAMES[mode]}, as you asked`] };
  }

  // The answer to "what did you mean?": run the original message with it
  if (pending?.clarify === "intent") {
    const lower = text.toLowerCase();
    const picked = /\b(add|entry|save)\b/.test(lower) ? "entry" : /\b(design|theme|look|colou?r)\b/.test(lower) ? "design" : /\b(ask|question|answer)\b/.test(lower) ? "qa" : null;
    if (picked) return { agent: picked, text: pending.sourceText, pending: null, decision: { predicted: picked, confidence: 1, decidedBy: "you" }, steps: [`You chose: ${INTENT_CHOICES[picked]}`] };
    if (/^\s*(cancel|never ?mind|no)\b/i.test(text)) return { agent: "help", pending: null, steps: ["You cancelled"] };
  }
  if (pending && !pending.clarify || pending?.clarify === "section") {
    return { agent: "entry", decision: { predicted: "entry", confidence: 1, decidedBy: "pending" }, steps: ["Continuing the entry that's waiting for your answer"] };
  }

  // Typos and shorthand fixed, for understanding. Answers and designs read the
  // corrected text; data entry keeps what the user typed, with only its command
  // words fixed, so what gets saved is in their own words
  const vocabulary = await vocabularyOf(tools);
  const reading = analyze(text, { vocabulary });
  const read = reading.corrected;
  const readSteps = reading.corrections.length ? [`Read your words as: ${describeCorrections(reading.corrections)}`] : [];
  const textFor = (agent) => (agent === "entry" ? fixCommandWords(text, { vocabulary }) : agent === "design" && NAMES_SOMETHING.test(text) ? text : read);

  // A change to what the resumes show that the planner fully understands
  // ("add interests to my resume") needs no guessing
  if (isResumeRequest(read) && Object.keys(planResume(read)).length && !/\b(called|named|titled)\b/i.test(read)) {
    return { agent: "design", text: read, decision: { predicted: "design", confidence: 1, decidedBy: "rules" }, steps: [...readSteps, "Detected a change to what your resumes show"] };
  }

  // The ensemble: wording rules + Naive Bayes + logistic regression
  // (+ embeddings when installed) + the page you're on
  const intent = await detectIntent(text, {
    context,
    model: intentModel,
    vocabulary,
    styleChanges: Object.keys(ruleChanges(read)).length > 0,
    sectionHit: Boolean(sectionFromText(read))
  });
  const pct = (p) => `${Math.round(p * 100)}%`;
  const votes = intent.parts.map((part) => `${part.name}: ${part.top}`).join(", ");
  if (intent.confident) {
    return {
      agent: AGENT_FOR_INTENT[intent.top],
      text: textFor(AGENT_FOR_INTENT[intent.top]),
      decision: { predicted: intent.top, confidence: intent.p, decidedBy: "ensemble", modelVersion: intent.version },
      steps: [...readSteps, `Detected "${INTENT_NAMES[intent.top]}" (${pct(intent.p)}; ${votes}; intent model ${intent.version})`]
    };
  }

  // Not sure: the language model breaks the tie
  if (llm) {
    try {
      const reply = await llm.invokeJson(ROUTE_PROMPT, { message: read }, signal);
      if (["entry", "design", "qa", "help"].includes(reply.agent)) {
        return {
          agent: reply.agent,
          text: textFor(reply.agent),
          decision: { predicted: reply.agent, confidence: intent.p, decidedBy: "language model", modelVersion: intent.version },
          steps: [...readSteps, `The models weren't sure (${INTENT_NAMES[intent.top]} ${pct(intent.p)}; ${votes}); the language model picked "${INTENT_NAMES[reply.agent]}"`]
        };
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  // Nobody is sure: ask, best guesses first
  const options = intent.ranked.map((item) => item.label).filter((label) => INTENT_CHOICES[label]);
  return {
    agent: "clarify",
    choices: options.map((label) => INTENT_CHOICES[label]),
    decision: { predicted: intent.top, confidence: intent.p, decidedBy: "asked", modelVersion: intent.version },
    steps: [`Not sure what you meant (best guess ${INTENT_NAMES[intent.top]}, ${pct(intent.p)}; ${votes}), so asked`]
  };
}

// An unanswered "what did you mean?" isn't carried past the next message
const keep = (pending) => (pending?.clarify === "intent" ? null : pending);

async function dataEntry(state, config) {
  const { llm, tools, signal } = config.configurable;
  const result = await runDataEntry({ text: state.text, pending: state.pending, llm, tools, signal });
  return { result: { ...result, agent: "data-entry" } };
}

async function design(state, config) {
  const { llm, tools, signal } = config.configurable;
  const currentId = /^\/portfolio\/custom-([a-f0-9]{24})/.exec(state.context?.path || "")?.[1] || "";
  const result = await runDesign({ text: state.text, currentId, llm, tools, signal });
  return { result: { ...result, agent: "design", pending: keep(state.pending) } };
}

async function qa(state, config) {
  const { llm, tools, signal } = config.configurable;
  const result = await runQa({ question: state.text, llm, tools, signal });
  return { result: { ...result, agent: "qa", pending: keep(state.pending) } };
}

function clarify({ text, choices }) {
  return {
    result: {
      agent: "supervisor",
      pending: { clarify: "intent", sourceText: text },
      reply: "I want to get this right: do you want to add this to your portfolio, change a portfolio design, or ask a question about your portfolio?",
      choices: [...choices, "Cancel"]
    }
  };
}

function help({ pending }) {
  return {
    result: {
      agent: "supervisor",
      pending: keep(pending),
      reply: [
        "Hi! I'm a team of agents for your portfolio:",
        "• Data entry: tell me something to add (\"I did my MS in CS at UNT, 2021 to 2023\"). I'll ask for anything required that's missing, then put it in the buffer for you to confirm on that section's page.",
        "• Design: \"Make a dark green Slate called Forest and hide projects\", \"use Playfair Display for headings\", \"put projects first\".",
        "• Q&A: \"Which projects used LangGraph?\" I answer from your own portfolio."
      ].join("\n"),
      choices: ["Add a degree", "Make a custom design", "What are my key skills?"]
    }
  };
}

const supervisorGraph = new StateGraph(State)
  .addNode("route", route)
  .addNode("dataEntry", dataEntry)
  .addNode("design", design)
  .addNode("qa", qa)
  .addNode("help", help)
  .addNode("clarify", clarify)
  .addEdge(START, "route")
  .addConditionalEdges("route", ({ agent }) => ({ entry: "dataEntry", design: "design", qa: "qa", help: "help", clarify: "clarify" })[agent])
  .addEdge("dataEntry", END)
  .addEdge("design", END)
  .addEdge("qa", END)
  .addEdge("help", END)
  .addEdge("clarify", END)
  .compile();

// Returns { agent, reply, choices, links, sources, steps, pending, changed }
// intentModel: the user's intent model (ml/intentEnsemble.modelFor)
async function runSupervisor({ text, mode = "auto", pending = null, context = {}, llm = null, tools, signal, intentModel }) {
  const state = await supervisorGraph.invoke(
    { text, mode, pending, context },
    { configurable: { llm, tools, signal, intentModel }, signal, recursionLimit: 20 }
  );
  const { result } = state;
  return {
    agent: result.agent,
    reply: result.reply || "",
    choices: result.choices || [],
    links: result.links || [],
    sources: result.sources || [],
    steps: [...state.steps, ...(result.steps || [])],
    pending: result.pending === undefined ? pending : result.pending,
    changed: Boolean(result.changed),
    designId: result.designId || "",
    decision: state.decision || null,
    routedText: state.text
  };
}

module.exports = { runSupervisor, supervisorGraph, prompts: { ROUTE_PROMPT } };
