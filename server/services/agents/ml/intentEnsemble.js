const crypto = require("node:crypto");
const { features, NaiveBayes, INTENT_EXAMPLES, splitRequest } = require("../textUnderstanding");
const { correctedText } = require("../../nlp/wordAnalyzer");
const { predict } = require("../../nlp/trainedModels");

// Intent detection for the one assistant chat: which agent should handle a
// message. An ensemble, so no single signal decides alone:
//
//   words      the word analyzer first fixes typos and shorthand (NLTK dictionary)
//   rules      wording that's nearly always right ("make it navy", "where
//              did I…?", "I worked at…") as soft votes
//   trained    Complement Naive Bayes, logistic regression, linear SVM and a
//              neural network, trained in ml/train.py on thousands of examples
//   ML         multinomial Naive Bayes and softmax logistic regression on
//              unigram + bigram features
//   DL         similarity to each intent's embedding centroid, when an
//              Ollama embedding model is installed
//   context    the page the user is on (a custom design leans to design)
//
// The final probabilities are a weighted vote. Below the confidence bar the
// supervisor asks the language model, then the user.
//
// MLOps: each trained model has a version (a hash of its training data) and
// cross-validated metrics (5-fold accuracy, macro F1, confusion matrix).
// Users' corrections ("Not what I meant → Design") are added to their own
// model's training data with extra weight, so it retrains on the next
// message and learns their phrasing.

const LABELS = ["entry", "design", "qa", "help"];

// More phrasings than the shared examples, so the models see variety
const EXTRA_EXAMPLES = {
  entry: [
    "I finished my bachelors in 2019", "got a new job as a backend developer", "I've been promoted to senior engineer",
    "I interned at Google last summer", "please put my AWS certificate in", "I made a chrome extension called TabSaver",
    "my phone number changed to 555 0100", "update my summary to say I build agents", "add python and docker to my skills",
    "Jane my manager wrote me a recommendation", "I won the hackathon at UNT", "I teach kids coding on weekends as a volunteer",
    "my paper got accepted at NeurIPS", "I was granted a patent for a sensor", "I love hiking and chess",
    "save this project for me", "Project name: TaskVerse", "Degree: MS Computer Science", "I'm studying for a PhD now",
    "started a new role at Oracle in March", "here are my project details", "add this to my education", "put it under experience",
    "my new headline is AI engineer", "I'm looking for data scientist roles", "change my linkedin url", "record my new certification"
  ],
  design: [
    "can the portfolio look more modern", "I don't like the font", "make the colours warmer", "use a darker theme",
    "can you hide my volunteering on the portfolio", "I want a portfolio that looks like a newspaper", "give the slate design a navy accent",
    "the headings should be bigger and serif", "show projects before experience", "make a copy of the Noir design",
    "remove recommendations from this design", "change the accent to orange", "make it look like a terminal", "less rounded corners please",
    "rename the skills section to toolkit", "my custom design should be always dark", "use Inter for body text", "delete my Forest design",
    "make the portfolio pink and playful", "I need a professional looking portfolio theme",
    "show all my projects on my resume", "add interests to my resume", "only two jobs on my resume", "include all skills in my resume",
    "put the remaining certifications on my cv", "reset my resume to default", "remove achievements from my resume"
  ],
  qa: [
    "do I know docker", "how long was I at Verizon", "what's my GPA", "which certifications expire soon", "where do I work now",
    "what did I study", "list everything I built with React", "how many projects do I have", "what's on my resume about RAG",
    "am I missing anything for a data scientist role", "which skills are my strongest", "what's my headline", "give me my summary",
    "who recommended me", "what year did I start at Oracle", "did I use LangGraph anywhere", "what are my most recent jobs",
    "find the project with the chatbot"
  ],
  help: [
    "what can this assistant do", "how do I use you", "what are you able to help with", "thanks a lot", "cool thanks",
    "good evening", "hiya", "can you help me", "what is this chat", "bye"
  ]
};

const BASE_EXAMPLES = Object.fromEntries(LABELS.map((label) => [label, [...INTENT_EXAMPLES[label], ...EXTRA_EXAMPLES[label]]]));

// Logistic regression also sees character trigrams ("#pro", "roj", "ject"),
// so "projects", "projekt" and "proj" still look alike
function lrFeatures(text) {
  const words = String(text || "").toLowerCase().match(/[a-z0-9+#]+/g) || [];
  const grams = [];
  for (const word of words) {
    const padded = `#${word}#`;
    for (let i = 0; i + 3 <= padded.length; i += 1) grams.push(`c:${padded.slice(i, i + 3)}`);
  }
  return [...features(text), ...grams];
}

// ---- Logistic regression (softmax, SGD, L2) ---------------------------------

class LogisticRegression {
  constructor(labels) {
    this.labels = labels;
    this.weights = labels.map(() => new Map());
    this.bias = labels.map(() => 0);
  }

  scores(feats) {
    return this.labels.map((_, k) => feats.reduce((sum, feature) => sum + (this.weights[k].get(feature) || 0), this.bias[k]));
  }

  probabilities(feats) {
    const scores = this.scores(feats);
    const max = Math.max(...scores);
    const exp = scores.map((score) => Math.exp(score - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((value) => value / sum);
  }

  // rows: [{ feats, label, weight }]
  fit(rows, { epochs = 30, rate = 0.3, l2 = 0.0005, seed = 7 } = {}) {
    let state = seed;
    const random = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    const order = rows.map((_, index) => index);
    for (let epoch = 0; epoch < epochs; epoch += 1) {
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const step = rate / (1 + epoch * 0.1);
      for (const index of order) {
        const { feats, label, weight = 1 } = rows[index];
        const probs = this.probabilities(feats);
        this.labels.forEach((name, k) => {
          const gradient = ((name === label ? 1 : 0) - probs[k]) * weight;
          this.bias[k] += step * gradient;
          for (const feature of feats) {
            const current = this.weights[k].get(feature) || 0;
            this.weights[k].set(feature, current + step * (gradient - l2 * current));
          }
        });
      }
    }
    return this;
  }

  predict(text) {
    const feats = lrFeatures(text);
    const probs = this.probabilities(feats);
    return this.labels.map((label, k) => ({ label, p: probs[k] })).sort((a, b) => b.p - a.p);
  }
}

// ---- Rules as soft votes ---------------------------------------------------------

const DESIGN_WORDS = /\b(design|theme|colou?rs?|accent|font|typeface|corners?|dark mode|light mode|layout|hide|unhide|section order|rename .* section|look(?:s)? (?:more|like)|modern|playful|minimal|serif|portfolio look)\b/i;
const QUESTION = /^\s*(what|which|when|where|who|how|do i|did i|have i|am i|is my|are my|list|tell me|show me|give me my|find|summari[sz]e)\b|\?\s*$/i;
const HELP = /^\s*(hi|hello|hey|hiya|thanks|thank you|cool thanks|bye|good (?:morning|evening|afternoon)|help|what can (?:you|this)|who are you|how do i use you)\b/i;
const ADDING = /\b(add|save|record|put|update my|change my|i (?:did|got|earned|completed|finished|worked|work|joined|built|made|won|received|volunteer\w*|published|studied|graduated|interned|teach|love|was (?:granted|promoted|hired))|i'?m (?:working|studying|looking for)|i'?ve been|new (?:job|degree|project|certification|role|headline)|my (?:phone|email|linkedin|headline|summary) )\b/i;
const LABEL_LINE = /^\s*[A-Za-z][A-Za-z ]{1,30}:\s*\S/m;
// What a resume shows ("all my projects on my resume", "3 jobs on my cv"),
// as opposed to new details to add ("I built X", "called Y")
const RESUME_LAYOUT = /\b(r[eé]sum[eé]s?|cvs?)\b/i;
const LAYOUT_WORDS = /\b(all|every|remaining|rest|other|only|just|limit|show|hide|remove|include|leave out|reset|default|more|fewer|\d+|one|two|three|four|five)\b/i;
const NEW_DETAILS = /\b(called|named|titled|i (?:did|worked|built|made|won|got|earned|studied|graduated|joined))\b/i;

function ruleVotes(text, context = {}, { styleChanges = false, sectionHit = false } = {}) {
  const votes = { entry: 0, design: 0, qa: 0, help: 0 };
  const reasons = [];
  const vote = (label, weight, why) => {
    votes[label] += weight;
    reasons.push(`${why} → ${label}`);
  };
  const words = String(text || "").trim().split(/\s+/).length;
  if (HELP.test(text) && words <= 7) vote("help", 2, "a greeting or thanks");
  if (DESIGN_WORDS.test(text)) vote("design", 1.5, "design wording");
  if (styleChanges) vote("design", 1.5, "a colour, font or layout change");
  if (QUESTION.test(text)) vote("qa", 1.5, "a question");
  // "add interests to my resume" is about what the resume shows, so its
  // "add" and section words don't count as new details
  const resumeLayout = RESUME_LAYOUT.test(text) && LAYOUT_WORDS.test(text) && !NEW_DETAILS.test(text);
  if (resumeLayout) vote("design", 3, "what your resume shows");
  if (ADDING.test(text) && !resumeLayout) vote("entry", 1.5, "something to add or update");
  if (LABEL_LINE.test(text)) vote("entry", 1, "labelled details");
  if (sectionHit && !resumeLayout) vote("entry", 0.7, "a portfolio section's wording");
  if (splitRequest(text).requestOnly && ADDING.test(text)) vote("entry", 0.5, "a request to add");
  if (/^\/portfolio\/custom-/.test(context.path || "")) vote("design", 0.6, "you're on a custom design");
  else if (/^\/portfolio\//.test(context.path || "")) vote("design", 0.3, "you're on a portfolio design");
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  return { votes: total ? Object.fromEntries(LABELS.map((label) => [label, votes[label] / total])) : null, reasons, strength: total };
}

// ---- Training, versions and evaluation --------------------------------------

function rowsFrom(examples, feedback = []) {
  const rows = [];
  for (const label of LABELS) for (const text of examples[label] || []) rows.push({ text, label, weight: 1 });
  // A correction counts three times: it's what this user actually meant
  for (const item of feedback) if (LABELS.includes(item.label)) rows.push({ text: item.text, label: item.label, weight: 3 });
  return rows;
}

function fitModels(rows) {
  const grouped = Object.fromEntries(LABELS.map((label) => [label, []]));
  for (const row of rows) for (let i = 0; i < Math.round(row.weight); i += 1) grouped[row.label].push(row.text);
  const nb = new NaiveBayes(grouped);
  const lr = new LogisticRegression(LABELS).fit(rows.map((row) => ({ feats: lrFeatures(row.text), label: row.label, weight: row.weight })));
  return { nb, lr };
}

// ML part of the vote: Naive Bayes and logistic regression, averaged
function mlVotes({ nb, lr }, text) {
  const fromNb = Object.fromEntries(nb.predict(text).map((item) => [item.label, item.p]));
  const fromLr = Object.fromEntries(lr.predict(text).map((item) => [item.label, item.p]));
  const known = nb.predict(text)[0].known;
  return { nb: fromNb, lr: fromLr, known };
}

// 5-fold cross-validation of the ML models (rules and context left out, so
// the numbers describe what the models learned)
function crossValidate(rows, folds = 5) {
  const shuffled = [...rows].sort((a, b) => crypto.createHash("md5").update(a.text).digest("hex").localeCompare(crypto.createHash("md5").update(b.text).digest("hex")));
  const confusion = Object.fromEntries(LABELS.map((label) => [label, Object.fromEntries(LABELS.map((other) => [other, 0]))]));
  let correct = 0;
  let ensembleCorrect = 0;
  for (let fold = 0; fold < folds; fold += 1) {
    const test = shuffled.filter((_, index) => index % folds === fold);
    const train = shuffled.filter((_, index) => index % folds !== fold);
    const models = fitModels(train);
    for (const row of test) {
      const { nb, lr } = mlVotes(models, row.text);
      const predicted = LABELS.reduce((best, label) => ((nb[label] + lr[label]) > (nb[best] + lr[best]) ? label : best), LABELS[0]);
      confusion[row.label][predicted] += 1;
      if (predicted === row.label) correct += 1;
      // The whole ensemble: the same models plus the wording rules
      const rules = ruleVotes(row.text).votes;
      const score = (label) => 0.25 * nb[label] + 0.25 * lr[label] + (rules ? 0.4 * rules[label] : 0);
      if (LABELS.reduce((best, label) => (score(label) > score(best) ? label : best), LABELS[0]) === row.label) ensembleCorrect += 1;
    }
  }
  const f1s = LABELS.map((label) => {
    const tp = confusion[label][label];
    const fp = LABELS.reduce((sum, other) => sum + (other === label ? 0 : confusion[other][label]), 0);
    const fn = LABELS.reduce((sum, other) => sum + (other === label ? 0 : confusion[label][other]), 0);
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  });
  return {
    folds,
    accuracy: correct / rows.length,
    ensembleAccuracy: ensembleCorrect / rows.length,
    macroF1: f1s.reduce((a, b) => a + b, 0) / LABELS.length,
    perLabelF1: Object.fromEntries(LABELS.map((label, index) => [label, f1s[index]])),
    confusion
  };
}

// { version, models, metrics, examples, feedback, trainedAt }
function trainIntentModel(feedback = [], { evaluate = true } = {}) {
  const rows = rowsFrom(BASE_EXAMPLES, feedback);
  const version = crypto.createHash("sha1").update(JSON.stringify(rows.map((row) => [row.text, row.label, row.weight]))).digest("hex").slice(0, 8);
  return {
    version,
    models: fitModels(rows),
    metrics: evaluate ? crossValidate(rows) : null,
    examples: rows.length,
    feedback: feedback.length,
    trainedAt: new Date().toISOString()
  };
}

// The base model is trained once; users with corrections get their own,
// retrained only when their corrections change
const base = trainIntentModel();
const personal = new Map(); // userId -> model

function modelFor(userId, feedback = []) {
  if (!feedback.length) return base;
  const hit = personal.get(String(userId));
  if (hit && hit.feedback === feedback.length) return hit;
  const model = trainIntentModel(feedback);
  personal.set(String(userId), model);
  if (personal.size > 500) personal.delete(personal.keys().next().value);
  return model;
}

// ---- The ensemble ------------------------------------------------------------------

let centroidsPromise = null;
function embeddingCentroids() {
  if (!centroidsPromise) {
    centroidsPromise = (async () => {
      const { makeEmbedder } = require("../portfolioKnowledge");
      const embedder = await makeEmbedder();
      if (!embedder) return null;
      const centroids = {};
      for (const label of LABELS) {
        const vectors = await embedder.embedDocuments(BASE_EXAMPLES[label]);
        centroids[label] = vectors[0].map((_, i) => vectors.reduce((sum, vector) => sum + vector[i], 0) / vectors.length);
      }
      return { embedder, centroids };
    })().catch(() => null);
  }
  return centroidsPromise;
}

const cosine = (a, b) => {
  let dot = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    left += a[i] * a[i];
    right += b[i] * b[i];
  }
  return dot / (Math.sqrt(left * right) || 1);
};

async function dlVotes(text) {
  const neural = await embeddingCentroids();
  if (!neural) return null;
  try {
    const vector = await neural.embedder.embedQuery(text);
    const sims = LABELS.map((label) => Math.exp(cosine(vector, neural.centroids[label]) * 12));
    const sum = sims.reduce((a, b) => a + b, 0);
    return Object.fromEntries(LABELS.map((label, index) => [label, sims[index] / sum]));
  } catch {
    return null;
  }
}

// { top, p, ranked, confident, parts, reasons, version, method }
// A long message's request is in its first line ("Add a project"); what
// follows is detail that can mention anything ("…designs, questions…")
function headOf(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const long = lines.length > 1 || String(text).split(/\s+/).length > 30;
  if (!long) return null;
  return lines.length > 1 ? lines[0] : String(text).split(/(?<=[.!?])\s+/)[0];
}

const blend = (a, b, weightA) => Object.fromEntries(LABELS.map((label) => [label, weightA * a[label] + (1 - weightA) * b[label]]));

async function detectIntent(message, { context = {}, model = base, styleChanges = false, sectionHit = false, useEmbeddings = true, vocabulary = [] } = {}) {
  const text = correctedText(message, { vocabulary });
  const head = headOf(text);
  // Rules on the first line, plus the labels and sections of the whole
  const rules = ruleVotes(head || text, context, { styleChanges, sectionHit });
  if (head && LABEL_LINE.test(text) && rules.votes) {
    rules.votes = blend({ entry: 1, design: 0, qa: 0, help: 0 }, rules.votes, 0.3);
    rules.reasons.push("labelled details → entry");
  }
  let ml = mlVotes(model.models, text);
  if (head) {
    const first = mlVotes(model.models, head);
    ml = { nb: blend(first.nb, ml.nb, 0.75), lr: blend(first.lr, ml.lr, 0.75), known: Math.max(first.known, ml.known) };
  }
  const dl = useEmbeddings ? await dlVotes(head || text) : null;
  // Fed what was typed: they fix spelling themselves and also read its letters
  const trained = predict("intent", headOf(message) || message, { vocabulary });

  // Weights: rules are precise when they fire; the models carry the rest
  const parts = [
    rules.votes && { name: "rules", weight: 0.4, votes: rules.votes },
    trained && { name: "trained models", weight: trained.known >= 0.3 ? 0.45 : 0.05, votes: Object.fromEntries(trained.ranked.map(({ label, p }) => [label, p])) },
    { name: "Naive Bayes", weight: ml.known ? 0.25 : 0.05, votes: ml.nb },
    { name: "logistic regression", weight: ml.known ? 0.25 : 0.05, votes: ml.lr },
    dl && { name: "embeddings", weight: 0.2, votes: dl }
  ].filter(Boolean);
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const final = Object.fromEntries(LABELS.map((label) => [label, parts.reduce((sum, part) => sum + part.weight * part.votes[label], 0) / totalWeight]));
  const ranked = LABELS.map((label) => ({ label, p: final[label] })).sort((a, b) => b.p - a.p);
  const [top, second] = ranked;

  // Sure enough to act: a clear winner backed by a rule or known words
  const backed = Boolean(rules.votes) || ml.known > 0 || Boolean(dl) || trained?.known >= 0.3;
  const confident = backed && top.p >= 0.45 && top.p - second.p >= 0.15;

  return {
    top: top.label,
    p: top.p,
    ranked,
    confident,
    parts: parts.map((part) => ({ name: part.name, top: LABELS.reduce((best, label) => (part.votes[label] > part.votes[best] ? label : best), LABELS[0]) })),
    reasons: rules.reasons,
    version: model.version,
    method: parts.map((part) => part.name).join(" + ")
  };
}

module.exports = { detectIntent, trainIntentModel, modelFor, crossValidate, LogisticRegression, ruleVotes, base, LABELS, BASE_EXAMPLES };
