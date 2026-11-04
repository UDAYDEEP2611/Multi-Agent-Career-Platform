require("dotenv").config();

const connectDB = require("./config/db");
const createApp = require("./app");
const { startAtsReviewer } = require("./a2a/atsReviewerAgent");
const { startDesigner } = require("./a2a/designerAgent");

// Validate required environment variables
const requiredEnv = [
  "MONGODB_URI",
  "CLIENT_URL",
  "SESSION_SECRET"
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 5050;
const app = createApp();

// Connect MongoDB before starting the server
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log("-----------------------------------");
      console.log("AgenticAgentPortfolioSystem");
      console.log("MongoDB Connected Successfully");
      console.log(`Server: http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log("-----------------------------------");
    });

    // The ATS Reviewer agent runs on its own port and is reached over A2A,
    // like any separate agent; run it alone with npm run agent:reviewer
    if (process.env.START_A2A_REVIEWER !== "false") {
      startAtsReviewer()
        .then((reviewer) => console.log(`ATS Reviewer agent (A2A): http://localhost:${reviewer.address().port}/.well-known/agent-card.json`))
        .catch((error) => console.error("ATS Reviewer agent didn't start:", error.message));
    }

    // The Portfolio Designer agent plans custom designs for the chat; the
    // chat falls back to planning in-process when it isn't running
    if (process.env.START_A2A_DESIGNER !== "false") {
      startDesigner()
        .then((designer) => console.log(`Portfolio Designer agent (A2A): http://localhost:${designer.address().port}/.well-known/agent-card.json`))
        .catch((error) => console.error("Portfolio Designer agent didn't start:", error.message));
    }
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
