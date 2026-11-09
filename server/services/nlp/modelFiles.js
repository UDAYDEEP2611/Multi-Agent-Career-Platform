const fs = require("node:fs");
const path = require("node:path");

// Reads one file from services/nlp/models ("intent", "model-card"...). The
// GitHub Pages demo swaps this file for one that bundles them.
const readModelFile = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "models", `${name}.json`), "utf8"));

module.exports = { readModelFile };
