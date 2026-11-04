const crypto = require("crypto");
const express = require("express");
const { AGENT_CARD_PATH, Role } = require("@a2a-js/sdk");
const { DefaultRequestHandler, InMemoryTaskStore, AgentEvent } = require("@a2a-js/sdk/server");
const { agentCardHandler, jsonRpcHandler, UserBuilder } = require("@a2a-js/sdk/server/express");
const { dataPart } = require("./atsReviewerAgent");
const { planDesign } = require("../services/agents/designPlanner");

// The Portfolio Designer: an independent agent that speaks A2A. The chat
// supervisor sends it { request, custom, currentId } and it replies with a
// design plan (see services/agents/designPlanner.js). It never touches the
// database: the main server applies the plan through its MCP tools. Uses
// the local Ollama model, when it's running, for requests the rules miss.

const JSONRPC_PATH = "/a2a/jsonrpc";

const textPart = (value) => ({ content: { $case: "text", value }, metadata: undefined, filename: "", mediaType: "text/plain" });

function agentCard(baseUrl) {
  return {
    name: "Portfolio Designer",
    description: "Plans custom portfolio designs: a base design plus colour, fonts, corners, light or dark, and which sections show, in what order and under what titles.",
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
        id: "plan-design",
        name: "Plan a custom portfolio design",
        description: "Input: { request, custom, currentId }. Output: { plan } with action, target, base design and changes.",
        tags: ["portfolio", "design", "theme"],
        examples: ["Make a dark green Slate called Forest and hide projects", "Use Playfair Display for headings"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        securityRequirements: []
      }
    ],
    signatures: []
  };
}

async function modelIfRunning() {
  const { ollamaStatus, createOllamaLlm } = require("../services/resume/ollama");
  return (await ollamaStatus()).available ? createOllamaLlm() : null;
}

const designerExecutor = {
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

    if (typeof input?.request !== "string" || !input.request.trim()) {
      reply([textPart("Send a data part with { request, custom, currentId }.")]);
      return;
    }

    const plan = await planDesign({
      request: input.request.slice(0, 2000),
      custom: Array.isArray(input.custom) ? input.custom.slice(0, 50) : [],
      currentId: typeof input.currentId === "string" ? input.currentId : "",
      llm: await modelIfRunning()
    });
    reply([dataPart({ plan })]);
  },

  async cancelTask() {
    // Plans finish in one step; there is nothing to cancel
  }
};

function createDesignerApp(baseUrl) {
  const app = express();
  const handler = new DefaultRequestHandler(agentCard(baseUrl), new InMemoryTaskStore(), designerExecutor);

  app.use(express.json({ limit: "1mb" }));
  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: handler }));
  app.use(JSONRPC_PATH, jsonRpcHandler({ requestHandler: handler, userBuilder: UserBuilder.noAuthentication }));

  return app;
}

// Listens on its own port, separate from the main API (0 = any free port)
function startDesigner(port = Number(process.env.A2A_DESIGNER_PORT) || 5052) {
  const http = require("http");

  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on("error", reject).listen(port, "127.0.0.1", () => {
      // The card must name the port actually used
      const baseUrl = process.env.A2A_DESIGNER_PUBLIC_URL || `http://localhost:${server.address().port}`;
      server.on("request", createDesignerApp(baseUrl));
      resolve(server);
    });
  });
}

module.exports = { createDesignerApp, startDesigner, agentCard };
