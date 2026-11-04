const crypto = require("crypto");
const express = require("express");
const { AGENT_CARD_PATH, Role } = require("@a2a-js/sdk");
const { DefaultRequestHandler, InMemoryTaskStore, AgentEvent } = require("@a2a-js/sdk/server");
const { agentCardHandler, jsonRpcHandler, UserBuilder } = require("@a2a-js/sdk/server/express");
const { reviewResume } = require("../services/resume/atsRules");

// The ATS Reviewer: an independent agent that speaks A2A (Agent-to-Agent
// protocol v1.0). Other agents find it through its Agent Card at
// /.well-known/agent-card.json and send it a message over JSON-RPC
// (message/send) with a data part { resume, keywords }. It replies with a
// data part { review }: score, keyword match, issues, and which bullets to
// rewrite. It holds no user data and needs no database.

const JSONRPC_PATH = "/a2a/jsonrpc";

const dataPart = (value) => ({
  content: { $case: "data", value },
  metadata: undefined,
  filename: "",
  mediaType: "application/json"
});

const textPart = (value) => ({
  content: { $case: "text", value },
  metadata: undefined,
  filename: "",
  mediaType: "text/plain"
});

function agentCard(baseUrl) {
  return {
    name: "ATS Reviewer",
    description: "Checks a resume against applicant tracking system (ATS) rules and a job's keywords, and says which bullets to rewrite.",
    version: "1.0.0",
    supportedInterfaces: [
      { url: `${baseUrl}${JSONRPC_PATH}`, protocolBinding: "JSONRPC", tenant: "", protocolVersion: "1.0" }
    ],
    provider: { organization: "UltraUnityVerse", url: baseUrl },
    capabilities: { streaming: false, pushNotifications: false, extensions: [] },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "review-resume",
        name: "Review resume for ATS",
        description: "Input: { resume, keywords }. Output: { review } with score, keyword coverage, issues and rewrite targets.",
        tags: ["resume", "ats", "review"],
        examples: ["Review this resume against these job keywords"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        securityRequirements: []
      }
    ],
    signatures: []
  };
}

const reviewerExecutor = {
  async execute(requestContext, eventBus) {
    const input = requestContext.userMessage.parts.find((part) => part.content?.$case === "data")?.content.value;

    const reply = (parts) => {
      eventBus.publish(AgentEvent.message({
        messageId: crypto.randomUUID(),
        contextId: requestContext.contextId,
        taskId: "",
        role: Role.ROLE_AGENT,
        parts,
        metadata: undefined,
        extensions: [],
        referenceTaskIds: []
      }));
      eventBus.finished();
    };

    if (!input?.resume?.experience || !input.resume.skills) {
      reply([textPart("Send a data part with { resume, keywords }.")]);
      return;
    }

    const keywords = Array.isArray(input.keywords) ? input.keywords.filter((keyword) => typeof keyword === "string") : [];
    reply([dataPart({ review: reviewResume(input.resume, keywords) })]);
  },

  async cancelTask() {
    // Reviews finish immediately; there is nothing to cancel
  }
};

// baseUrl: the address other agents reach this one at (goes in the card)
function createAtsReviewerApp(baseUrl) {
  const app = express();
  const handler = new DefaultRequestHandler(agentCard(baseUrl), new InMemoryTaskStore(), reviewerExecutor);

  app.use(express.json({ limit: "2mb" }));
  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: handler }));
  app.use(JSONRPC_PATH, jsonRpcHandler({ requestHandler: handler, userBuilder: UserBuilder.noAuthentication }));

  return app;
}

// Listens on its own port, separate from the main API
function startAtsReviewer(port = Number(process.env.A2A_REVIEWER_PORT) || 5051) {
  const baseUrl = process.env.A2A_REVIEWER_PUBLIC_URL || `http://localhost:${port}`;

  return new Promise((resolve, reject) => {
    const server = createAtsReviewerApp(baseUrl)
      .listen(port, "127.0.0.1", () => resolve(server))
      .on("error", reject);
  });
}

module.exports = { createAtsReviewerApp, startAtsReviewer, agentCard, dataPart };
