const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = require("@modelcontextprotocol/sdk/inMemory.js");
const { runAsUser } = require("../utils/userDatabase");

// The chat agents' MCP client: connects, in-process, to a portfolio MCP
// server started for the signed-in user, so the agents act on the
// portfolio only through MCP tools (the same tools Claude Desktop gets).

async function connectForUser(user) {
  // Loaded here because the server's tools load the agents' services
  const { createPortfolioMcpServer } = require("./portfolioMcpServer");
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createPortfolioMcpServer({ user, run: (fn) => runAsUser(user.id, fn) });
  await server.connect(serverSide);
  const client = new Client({ name: "chat-agents", version: "1.0.0" });
  await client.connect(clientSide);

  return {
    // Calls one tool and returns its structured result
    async call(name, args = {}) {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) throw new Error(result.content?.[0]?.text || `MCP tool ${name} failed`);
      return result.structuredContent;
    },
    async tools() {
      return (await client.listTools()).tools.map((tool) => tool.name);
    },
    close: () => client.close()
  };
}

module.exports = { connectForUser };
