const fs = require("node:fs");
const path = require("node:path");
const { featuresOf } = require("./wordAnalyzer");

// Runs the models trained in ml/train.py (Complement Naive Bayes, logistic
// regression, a linear SVM and a neural network) without Python: their weights
// are plain numbers in services/nlp/models. Each votes with a weight set by its
// cross-validated accuracy.
//
// Tasks: "intent" (which agent), "section" (which part of the portfolio) and
// "action" (what a message to a resume's chat wants). When a task's file is
// missing, predict returns null and the agents use their rules and small models.

const loaded = new Map();

function modelFor(task) {
  if (loaded.has(task)) return loaded.get(task);
  let model = null;
  try {
    model = JSON.parse(fs.readFileSync(path.join(__dirname, "models", `${task}.json`), "utf8"));
    model.index = new Map(model.features.map((feature, index) => [feature, index]));
  } catch {
    model = null;
  }
  loaded.set(task, model);
  return model;
}

const softmax = (scores) => {
  const max = Math.max(...scores);
  const exp = scores.map((score) => Math.exp(score - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((value) => value / sum);
};

// Sublinear TF-IDF, normalized: the same vector as training. [[index, value]]
function vectorOf(model, features) {
  const counts = new Map();
  for (const feature of features) {
    const index = model.index.get(feature);
    if (index !== undefined) counts.set(index, (counts.get(index) || 0) + 1);
  }
  const vector = [...counts].map(([index, count]) => [index, (1 + Math.log(count)) * model.idf[index]]);
  const norm = Math.sqrt(vector.reduce((sum, [, value]) => sum + value * value, 0)) || 1;
  return vector.map(([index, value]) => [index, value / norm]);
}

function votesOf(spec, vector) {
  if (spec.kind === "mlp") {
    const hidden = spec.hiddenBias.map((bias, unit) => Math.max(0, vector.reduce((sum, [index, value]) => sum + value * spec.hidden[index][unit], bias)));
    return softmax(spec.outputBias.map((bias, label) => hidden.reduce((sum, value, unit) => sum + value * spec.output[unit][label], bias)));
  }
  const scores = spec.bias.map((bias, label) => vector.reduce((sum, [index, value]) => sum + value * spec.coef[label][index], bias));
  return softmax(spec.kind === "svm" ? scores.map((score) => score * 2) : scores);
}

// { ranked: [{ label, p }], top, p, votes: { model: label }, known } or null.
// known: how many of the message's words the models have seen (0 to 1)
function predict(task, text, options) {
  const model = modelFor(task);
  if (!model) return null;
  const features = featuresOf(text, options);
  const vector = vectorOf(model, features);
  const total = model.labels.map(() => 0);
  const votes = {};
  for (const [name, spec] of Object.entries(model.models)) {
    const probabilities = votesOf(spec, vector);
    probabilities.forEach((value, label) => {
      total[label] += spec.weight * value;
    });
    votes[name] = model.labels[probabilities.indexOf(Math.max(...probabilities))];
  }
  const ranked = model.labels.map((label, index) => ({ label, p: total[index] })).sort((a, b) => b.p - a.p);
  // Whole words, not letters: three letters in a row match nearly anything, so
  // nonsense must not count as understood
  const words = features.filter((feature) => feature.startsWith("w:"));
  return { ranked, top: ranked[0].label, p: ranked[0].p, votes, known: words.length ? words.filter((feature) => model.index.has(feature)).length / words.length : 0 };
}

// What was trained, and how it scored
function modelCard() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "models", "model-card.json"), "utf8"));
  } catch {
    return null;
  }
}

module.exports = { predict, modelFor, modelCard };
