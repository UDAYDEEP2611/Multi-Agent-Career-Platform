const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = require("@modelcontextprotocol/sdk/inMemory.js");

// The resume agent's MCP client. It connects to the portfolio MCP server's
// resume tools (no user data) once, in-process, and calls them like any
// MCP client would.

let connecting = null;

function connect() {
  if (!connecting) {
    connecting = (async () => {
      // Loaded here because the server's tools load the resume agent
      const { createPortfolioMcpServer } = require("./portfolioMcpServer");
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

      await createPortfolioMcpServer().connect(serverSide);
      const client = new Client({ name: "resume-agent", version: "1.0.0" });
      await client.connect(clientSide);
      return client;
    })().catch((error) => {
      connecting = null;
      throw error;
    });
  }
  return connecting;
}

// Calls one tool and returns its structured result
async function callTool(name, args) {
  const client = await connect();
  const result = await client.callTool({ name, arguments: args });

  if (result.isError) {
    throw new Error(result.content?.[0]?.text || `MCP tool ${name} failed`);
  }
  return result.structuredContent;
}

module.exports = { callTool };
