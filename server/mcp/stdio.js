// The portfolio MCP server over stdio, for MCP clients such as Claude
// Desktop or Claude Code. It serves one user's portfolio:
//
//   PORTFOLIO_USER=<username or email> npm run mcp
//
// stdout carries the MCP protocol, so everything else is logged to stderr.
console.log = (...args) => console.error(...args);
require("dotenv").config({ quiet: true, path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const User = require("../models/User");
const { prepareUserDatabase, runAsUser } = require("../utils/userDatabase");
const { createPortfolioMcpServer } = require("./portfolioMcpServer");
require("../models/userModels");

async function main() {
  const identifier = String(process.env.PORTFOLIO_USER || "").trim().toLowerCase();
  if (!identifier || !process.env.MONGODB_URI) {
    console.error("Set PORTFOLIO_USER (your username or email) and MONGODB_URI.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const account = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] })
    .select("username email role")
    .lean();

  if (!account || account.role === "admin") {
    console.error(`No portfolio user "${identifier}".`);
    process.exit(1);
  }

  const user = { id: String(account._id), username: account.username, email: account.email };
  await prepareUserDatabase(user.id);

  const server = createPortfolioMcpServer({ user, run: (fn) => runAsUser(user.id, fn) });
  await server.connect(new StdioServerTransport());
  console.error(`Portfolio MCP server ready for ${user.username}`);
}

main().catch((error) => {
  console.error("MCP server error:", error);
  process.exit(1);
});
