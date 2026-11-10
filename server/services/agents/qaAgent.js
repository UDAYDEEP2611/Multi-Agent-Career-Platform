const { StateGraph, Annotation, START, END } = require("@langchain/langgraph");

// The portfolio Q&A agent, as a LangGraph workflow:
//
//   retrieve → respond
//
// retrieve calls the MCP tool search_portfolio: hybrid RAG over the
// portfolio's documents plus GraphRAG facts from its knowledge graph.
// respond has the language model reply from that context only, citing
// sources as [1], [2]; without a model it lists what it found.

const ANSWER_PROMPT = [
  "You answer questions about the user's own portfolio, speaking to them as \"you\".",
  "Use ONLY the context: documents (numbered) and graphFacts (from their portfolio's knowledge graph).",
  "- If the context doesn't answer it, say so and suggest which section to fill in.",
  "- Cite the documents you used as [1], [2]. Keep it short: 1 to 4 sentences or a short list.",
  'Reply with JSON only: {"answer": string}'
].join("\n");

const State = Annotation.Root({
  question: Annotation(),
  found: Annotation(),
  answer: Annotation(),
  sources: Annotation({ reducer: (_, next) => next, default: () => [] }),
  links: Annotation({ reducer: (_, next) => next, default: () => [] }),
  steps: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] })
});

async function retrieve({ question }, config) {
  const { tools } = config.configurable;
  const found = await tools.call("search_portfolio", { query: question, k: 5 });
  return {
    found,
    steps: [
      `Searched your portfolio with ${found.mode}: ${found.results.length} match${found.results.length === 1 ? "" : "es"}`,
      found.graph.seeds.length
        ? `GraphRAG followed ${found.graph.seeds.join(", ")} through your knowledge graph: ${found.graph.facts.length} facts`
        : "GraphRAG: the question names nothing in your knowledge graph"
    ]
  };
}

async function respond({ question, found }, config) {
  const { llm, signal } = config.configurable;
  const sources = found.results.map((item) => ({ label: item.title, detail: item.section }));
  const links = [...new Map(found.results.map((item) => [item.link, { label: `Open ${item.section}`, to: item.link }])).values()].slice(0, 2);

  if (!found.results.length && !found.graph.facts.length) {
    return { answer: "I couldn't find anything about that in your portfolio yet. Add it in the matching section (or tell me and I'll prepare the entry), then ask again.", sources: [], links: [] };
  }

  if (llm) {
    try {
      const reply = await llm.invokeJson(ANSWER_PROMPT, {
        question,
        documents: found.results.map((item, index) => ({ n: index + 1, title: item.title, text: item.text.slice(0, 1200) })),
        graphFacts: found.graph.facts
      }, signal);
      if (typeof reply.answer === "string" && reply.answer.trim()) {
        return { answer: reply.answer.trim(), sources, links, steps: ["The language model answered from those sources only"] };
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  // No model: show what was found
  const lines = [
    ...found.graph.facts.slice(0, 8).map((fact) => `• ${fact}`),
    // Past the dates line, so the snippet says what was done
    ...found.results.slice(0, 3).map((item, index) => `[${index + 1}] ${item.title}: ${item.text.split("\n").slice(1).filter(Boolean).join(" ").slice(0, 220)}`)
  ];
  return { answer: `Here's what your portfolio says:\n${lines.join("\n")}`, sources, links, steps: ["No language model running; listed the matches"] };
}

const qaGraph = new StateGraph(State)
  .addNode("retrieve", retrieve)
  .addNode("respond", respond)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "respond")
  .addEdge("respond", END)
  .compile();

async function runQa({ question, llm = null, tools, signal }) {
  const state = await qaGraph.invoke({ question }, { configurable: { llm, tools, signal }, signal });
  return { reply: state.answer, sources: state.sources, links: state.links, steps: state.steps };
}

module.exports = { runQa, qaGraph, prompts: { ANSWER_PROMPT } };
