const { inventsNumbers, mentions, resumeText } = require("./atsRules");
const { dictionaryKeywords } = require("./skillDictionary");
const { GENERIC_PHRASES, withoutEmployers, wordCount, ATS_RULES } = require("./resumeAgent");

// Rephrases a summary to a word count so it fills its lines on the page:
// 4 to 6 lines, with a last line that isn't a few stray words. The browser
// measures the lines and asks for a target; the facts must not change.

const FIT_PROMPT = [
  "You adjust the length of a resume's professional summary so it fills its lines well on the page.",
  ATS_RULES,
  "- Rewrite summary to targetWords words (within 3 words either way). feedback says why.",
  "- Keep every fact, number, tool and result in summary, and its order: identity and years,",
  "  AI systems built, technical implementation, then the measured result as the last sentence.",
  "- To lengthen: describe the same work more specifically, or add a skill from allowedSkills.",
  "  To shorten: cut filler words and merge clauses, never results or numbers.",
  "- No new numbers, employers or generic phrases (passionate, innovation, transformation).",
  'Reply with JSON only: {"summary": string}'
].join("\n");

// Why a rephrased summary can't be used, or null if it's fine
function fitRejection(next, { summary, targetWords, allowedText, employers }) {
  if (!next) return "came back empty";
  const words = wordCount(next);
  if (Math.abs(words - targetWords) > Math.max(6, targetWords * 0.12)) return `has ${words} words, not about ${targetWords}`;
  if (inventsNumbers(next, allowedText)) return "has a number that isn't on the resume";
  // Every measured result stays
  const lost = (summary.match(/\d+(?:\.\d+)?\s?%/g) || []).filter((result) => !next.includes(result));
  if (lost.length) return `drops the result ${lost.join(", ")}`;
  const foreign = dictionaryKeywords(next).filter((tool) => !mentions(allowedText, tool));
  if (foreign.length) return `names tools not on the resume (${foreign.join(", ")})`;
  if (withoutEmployers(next, employers).dropped) return "names an employer";
  if (GENERIC_PHRASES.test(next)) return `uses the generic phrase "${next.match(GENERIC_PHRASES)[0]}"`;
  return null;
}

// resume: the built resume; targetWords: what fills the lines; feedback: how
// it looks now. Returns { summary } or { error }.
async function refitSummary({ llm, resume, summary, targetWords, feedback, signal }) {
  const task = {
    summary,
    targetWords,
    allowedText: `${summary}\n${resumeText(resume)}`,
    employers: resume.experience.map((item) => item.organization)
  };
  const payload = { summary, targetWords, feedback, allowedSkills: resume.skills.technical.slice(0, 30) };

  let draft = String((await llm.invokeJson(FIT_PROMPT, payload, signal)).summary || "").replace(/\s+/g, " ").trim();
  let problem = fitRejection(draft, task);
  if (problem) {
    draft = String((await llm.invokeJson(FIT_PROMPT, {
      ...payload, draftSummary: draft, feedback: `${feedback} Your last draft ${problem}; fix that.`
    }, signal)).summary || "").replace(/\s+/g, " ").trim();
    problem = fitRejection(draft, task);
  }

  return problem ? { error: `The rephrased summary ${problem}.` } : { summary: draft };
}

module.exports = { refitSummary, fitRejection };
