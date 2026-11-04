// Asks Claude whether a new skill name is misspelled or the same as one the
// user already has. Only used when ANTHROPIC_API_KEY is set; returns null
// on any problem so the caller falls back to the rule-based check.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

const isEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

function buildPrompt(name, existingNames) {
  return [
    "You check skill names for a resume.",
    `New skill: ${JSON.stringify(name)}`,
    `Skills the user already has: ${JSON.stringify(existingNames)}`,
    "",
    "Reply with JSON only, no other text:",
    '{"correctedName": string, "skillType": "technical" | "soft", "sameAs": string[]}',
    "- correctedName: the skill with spelling and official capitalization fixed",
    '  (e.g. "pyhton" -> "Python", "javascript" -> "JavaScript"). If it is',
    "  already correct, return it unchanged. Never replace it with a different skill.",
    "- sameAs: names copied exactly from the user's list that mean the same",
    '  skill (e.g. "React.js" and "React"). Related but different skills',
    '  ("Java" and "JavaScript") are not the same. Empty if none.'
  ].join("\n");
}

async function checkSkillWithAi(name, existingNames) {
  if (!isEnabled()) return null;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: buildPrompt(name, existingNames) }]
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      console.error("Skill check AI error:", response.status);
      return null;
    }

    const data = await response.json();
    const text = data.content?.find((block) => block.type === "text")?.text || "";
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

    // Only trust well-formed answers that point at real skills
    const correctedName =
      typeof parsed.correctedName === "string" &&
      parsed.correctedName.trim() &&
      parsed.correctedName.length <= 100
        ? parsed.correctedName.trim()
        : name;

    return {
      correctedName,
      skillType: parsed.skillType === "soft" ? "soft" : "technical",
      sameAs: Array.isArray(parsed.sameAs)
        ? parsed.sameAs.filter((item) => existingNames.includes(item))
        : []
    };
  } catch (error) {
    console.error("Skill check AI error:", error.message);
    return null;
  }
}

module.exports = { checkSkillWithAi, isAiSkillCheckEnabled: isEnabled };
