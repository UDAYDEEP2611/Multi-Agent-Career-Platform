const crypto = require("crypto");
const { Role } = require("@a2a-js/sdk");
const { ClientFactory } = require("@a2a-js/sdk/client");
const { dataPart } = require("./atsReviewerAgent");

// Calls the ATS Reviewer agent over A2A. Its address comes from
// A2A_REVIEWER_URL (default http://localhost:5051; "off" disables it).
// Returns the review, or null when the agent can't be reached, so the
// caller can fall back to the built-in review.

let cached = null; // { url, client }

const reviewerUrl = () => process.env.A2A_REVIEWER_URL || "http://localhost:5051";

async function clientFor(url) {
  if (cached?.url === url) return cached.client;
  // Discovers the agent from its Agent Card
  const client = await new ClientFactory().createFromUrl(url);
  cached = { url, client };
  return client;
}

async function reviewViaA2A({ resume, keywords }, signal) {
  const url = reviewerUrl();
  if (url === "off") return null;

  try {
    const client = await clientFor(url);
    const timeout = AbortSignal.timeout(8000);

    const result = await client.sendMessage(
      {
        tenant: "",
        message: {
          messageId: crypto.randomUUID(),
          contextId: "",
          taskId: "",
          role: Role.ROLE_USER,
          parts: [dataPart({ resume, keywords })],
          metadata: undefined,
          extensions: [],
          referenceTaskIds: []
        },
        configuration: undefined,
        metadata: undefined
      },
      { signal: signal ? AbortSignal.any([signal, timeout]) : timeout }
    );

    // A direct message reply, or a task whose artifacts hold the answer
    const parts = result.parts || result.artifacts?.flatMap((artifact) => artifact.parts) || [];
    const review = parts.find((part) => part.content?.$case === "data")?.content.value?.review;
    return review && typeof review.score === "number" ? review : null;
  } catch (error) {
    if (signal?.aborted) throw error;
    cached = null; // look the agent up again next time
    return null;
  }
}

module.exports = { reviewViaA2A };
