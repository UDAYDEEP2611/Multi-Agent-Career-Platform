const { StateGraph, Annotation, START, END } = require("@langchain/langgraph");
const { baselineRequirements, mergeAiRequirements } = require("./requirements");
const { verifyRequirements, experienceYears } = require("./evidence");
const { scoreMatch, CATEGORIES } = require("./matchModel");

// How well a resume fits a job, as a LangGraph workflow:
//
//   extractRequirements → verifyEvidence → score
//
// Only extractRequirements may ask the language model, and only to find
// requirements the rules missed. Evidence, experience years and the score
// are plain code, so the same resume always gets the same, explainable
// result. Passing earlier requirements skips extraction: recalculating
// after edits compares like with like.

const REQUIREMENTS_PROMPT = [
  "Extract the requirements from this job description.",
  `Each requirement has a category: ${CATEGORIES.filter((c) => c.id !== "qualifications").map((c) => `"${c.id}" (${c.label})`).join(", ")}.`,
  "- terms: 1 to 3 words copied exactly from the job description that a resume would mention",
  "  (skills, tools, methods). Skip salary, location, benefits, titles and years of experience.",
  "- importance: \"required\", or \"preferred\" if the job says preferred, plus or nice to have.",
  "At most 20, most important first.",
  'Reply with JSON only: {"requirements": [{"text": string, "category": string, "terms": string[], "importance": string}]}'
].join("\n");

const State = Annotation.Root({
  resume: Annotation(),
  jobDescription: Annotation(),
  weights: Annotation(),
  requirements: Annotation(),
  verified: Annotation(),
  result: Annotation(),
  notes: Annotation({ reducer: (all, added) => all.concat(added), default: () => [] })
});

async function extractRequirements({ resume, jobDescription, requirements }, config) {
  if (requirements) return {};

  const { llm, onProgress = () => {}, signal } = config?.configurable || {};
  const extraSkills = [...resume.skills.technical, ...resume.skills.soft];
  const baseline = baselineRequirements(jobDescription, { extraSkills, targetTitle: resume.targetTitle });

  if (!llm) return { requirements: baseline };

  onProgress("Reading the job's requirements");
  try {
    const reply = await llm.invokeJson(REQUIREMENTS_PROMPT, { jobDescription }, signal);
    return { requirements: mergeAiRequirements(baseline, reply.requirements, jobDescription) };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { requirements: baseline, notes: ["The AI couldn't read the requirements; matched known skills and phrases only."] };
  }
}

function verifyEvidence({ resume, requirements }, config) {
  config?.configurable?.onProgress?.("Checking the evidence for each requirement");
  return { verified: verifyRequirements(requirements, resume) };
}

function score({ resume, verified, weights }) {
  const { overall, categories } = scoreMatch(verified, weights || {});

  return {
    result: {
      overall,
      categories,
      requirements: verified,
      years: experienceYears(resume.experience),
      counts: {
        strong: verified.filter((item) => item.level === "strong").length,
        demonstrated: verified.filter((item) => item.level === "demonstrated").length,
        partial: verified.filter((item) => item.level === "partial").length,
        missing: verified.filter((item) => item.level === "missing").length
      }
    }
  };
}

const jobMatchGraph = new StateGraph(State)
  .addNode("extractRequirements", extractRequirements)
  .addNode("verifyEvidence", verifyEvidence)
  .addNode("score", score)
  .addEdge(START, "extractRequirements")
  .addEdge("extractRequirements", "verifyEvidence")
  .addEdge("verifyEvidence", "score")
  .addEdge("score", END)
  .compile();

// requirements: from an earlier evaluation, to recalculate without AI
// Returns { overall, categories, requirements, years, counts, notes } or
// null when there's no job description
async function evaluateJobMatch({ resume, jobDescription, requirements = null, weights = null, llm = null, onProgress, signal }) {
  if (!jobDescription?.trim() && !requirements) return null;

  const state = await jobMatchGraph.invoke(
    { resume, jobDescription: jobDescription || "", requirements, weights },
    { configurable: { llm, onProgress, signal }, signal }
  );

  return { ...state.result, notes: state.notes };
}

module.exports = { evaluateJobMatch, jobMatchGraph };
