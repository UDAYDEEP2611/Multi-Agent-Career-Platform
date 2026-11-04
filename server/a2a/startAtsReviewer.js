// Runs the ATS Reviewer A2A agent on its own: npm run agent:reviewer
// (The main server also starts it unless START_A2A_REVIEWER=false.)
require("dotenv").config({ quiet: true });
const { startAtsReviewer } = require("./atsReviewerAgent");

startAtsReviewer()
  .then((server) => {
    const { port } = server.address();
    console.log(`ATS Reviewer agent (A2A) at http://localhost:${port}/.well-known/agent-card.json`);
  })
  .catch((error) => {
    console.error("ATS Reviewer agent failed to start:", error.message);
    process.exit(1);
  });
