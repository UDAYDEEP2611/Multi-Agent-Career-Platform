const crypto = require("crypto");
const { Role } = require("@a2a-js/sdk");
const { ClientFactory } = require("@a2a-js/sdk/client");
const { dataPart } = require("./atsReviewerAgent");

// Asks the Portfolio Designer agent for a design plan over A2A. Its address
// comes from A2A_DESIGNER_URL (default http://localhost:5052; "off"
// disables it). Returns the plan, or null when the agent can't be reached,
// so the caller can plan in-process instead.

let cached = null; // { url, client }

const designerUrl = () => process.env.A2A_DESIGNER_URL || "http://localhost:5052";

async function clientFor(url) {
  if (cached?.url === url) return cached.client;
  const client = await new ClientFactory().createFromUrl(url);
  cached = { url, client };
  return client;
}

async function planViaA2A({ request, custom, currentId }, signal) {
  const url = designerUrl();
  if (url === "off") return null;

  try {
    const client = await clientFor(url);
    const timeout = AbortSignal.timeout(60000);
    const result = await client.sendMessage(
      {
        tenant: "",
        message: {
          messageId: crypto.randomUUID(),
          contextId: "",
          taskId: "",
          role: Role.ROLE_USER,
          parts: [dataPart({ request, custom, currentId })],
          metadata: undefined,
          extensions: [],
          referenceTaskIds: []
        },
        configuration: undefined,
        metadata: undefined
      },
      { signal: signal ? AbortSignal.any([signal, timeout]) : timeout }
    );

    const parts = result.parts || result.artifacts?.flatMap((artifact) => artifact.parts) || [];
    const plan = parts.find((part) => part.content?.$case === "data")?.content.value?.plan;
    return plan && typeof plan.action === "string" ? plan : null;
  } catch (error) {
    if (signal?.aborted) throw error;
    cached = null;
    return null;
  }
}

module.exports = { planViaA2A };
