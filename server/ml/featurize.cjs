// Turns the examples into features with the server's own word analyzer, so
// training reads text exactly the way the running app does.
//   node ml/featurize.cjs   -> ml/data/features.json
const fs = require("node:fs");
const path = require("node:path");
const { featuresOf } = require("../services/nlp/wordAnalyzer");

const data = path.join(__dirname, "data");
const train = JSON.parse(fs.readFileSync(path.join(data, "train.json")));
const holdout = JSON.parse(fs.readFileSync(path.join(data, "holdout.json")));
const out = {};
for (const task of Object.keys(train)) {
  out[task] = {
    train: train[task].map((row) => ({ features: featuresOf(row.text), label: row.label, group: row.group })),
    holdout: holdout[task].map(([text, label]) => ({ text, features: featuresOf(text), label }))
  };
}
fs.writeFileSync(path.join(data, "features.json"), JSON.stringify(out));
console.log("featurized", Object.entries(out).map(([task, value]) => `${task}: ${value.train.length} + ${value.holdout.length}`).join(", "));
