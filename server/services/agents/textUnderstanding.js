// How the agents understand a chat message before any field is filled in.
//
// NLP: messages are tokenized, stemmed and turned into unigram + bigram
// features; the "request" part of a message ("I want to add a project") is
// separated from its "content" part (the actual name, dates, details), so a
// message that only says what the user wants to do never becomes a record
// called "A project".
//
// ML: two multinomial Naive Bayes classifiers, trained at start-up on the
// labelled examples below, give probabilities for what the user wants
// (add an entry, change a design, ask a question, small talk) and which
// portfolio section a message is about.
//
// DL: when an Ollama embedding model is installed (OLLAMA_EMBED_MODEL,
// default nomic-embed-text), each label also gets a neural embedding
// centroid, and the message's embedding similarity is blended with the
// Naive Bayes probabilities.
//
// The result carries a confidence; when the top two labels are close, the
// agents ask the user to clarify instead of guessing.

// ---- NLP ---------------------------------------------------------------------

const STOP = new Set("a an the and or of to in on at for with by from is are was were be been am i me my we our it its this that these those please can could would will you your".split(" "));

// A light stemmer: enough that "projects", "built" and "building" meet
function stem(word) {
  if (word.length <= 4) return word;
  return word
    .replace(/(ational|ation)$/, "ate")
    .replace(/(ings?|ed|ies|es|s)$/, (end) => (end === "ies" ? "y" : ""))
    .replace(/(ment|ness|ly)$/, "");
}

const tokens = (text) => String(text || "").toLowerCase().replace(/[’']/g, "").match(/[a-z0-9+#.]+/g)?.map((word) => word.replace(/\.+$/, "")).filter(Boolean) || [];

// Unigrams (without stop words) and bigrams (with them: "add a", "i did")
function features(text) {
  const all = tokens(text).map(stem);
  const uni = all.filter((word) => !STOP.has(word));
  const bi = all.slice(1).map((word, index) => `${all[index]}_${word}`);
  return [...uni, ...bi];
}

// ---- ML: multinomial Naive Bayes ---------------------------------------------

class NaiveBayes {
  constructor(examples) {
    this.labels = Object.keys(examples);
    this.counts = {};
    this.totals = {};
    this.docs = {};
    this.vocab = new Set();
    let documents = 0;
    for (const label of this.labels) {
      this.counts[label] = new Map();
      this.totals[label] = 0;
      this.docs[label] = examples[label].length;
      documents += examples[label].length;
      for (const example of examples[label]) {
        for (const feature of features(example)) {
          this.counts[label].set(feature, (this.counts[label].get(feature) || 0) + 1);
          this.totals[label] += 1;
          this.vocab.add(feature);
        }
      }
    }
    this.documents = documents;
  }

  // [{ label, p }] sorted by probability
  predict(text) {
    const feats = features(text).filter((feature) => this.vocab.has(feature));
    const logs = this.labels.map((label) => {
      let score = Math.log(this.docs[label] / this.documents);
      for (const feature of feats) {
        score += Math.log(((this.counts[label].get(feature) || 0) + 1) / (this.totals[label] + this.vocab.size));
      }
      return score;
    });
    const max = Math.max(...logs);
    const exp = logs.map((score) => Math.exp(score - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return this.labels.map((label, index) => ({ label, p: exp[index] / sum }))
      .sort((a, b) => b.p - a.p)
      .map((item) => ({ ...item, known: feats.length }));
  }
}

// ---- Training data -----------------------------------------------------------

const INTENT_EXAMPLES = {
  entry: [
    "I want to add a project", "add a new job", "I did my masters in computer science", "I worked at Google as an engineer",
    "add my degree", "I graduated from UNT in 2023", "I got certified in AWS", "please add my certification",
    "I built an app called JobPilot", "new internship at Amazon", "add an award I won", "I volunteer at a food bank",
    "I published a paper on transformers", "add a patent", "I am interested in photography", "can you add my education",
    "I joined Microsoft last year", "I completed a bachelor of technology", "add experience", "I want to add a degree",
    "record a new project", "I earned a scholarship", "I'm working as a data scientist", "create a project entry",
    "I studied at Stanford", "put my new job in", "I received the best paper award", "add a volunteering role",
    "I worked at Verizon", "I was a software engineer at IBM", "I work at Oracle", "I was an intern at Tesla", "I have a new job"
  ],
  design: [
    "make my portfolio dark green", "change the font to Playfair", "hide the projects section", "create a new design",
    "use a blue accent", "put skills first", "rename projects to things I built", "make the corners rounded",
    "switch to dark mode", "make a Slate design called Forest", "show interests on my portfolio", "delete this design",
    "change the colour scheme", "I want a new portfolio theme", "remove the about section from the design", "make it look minimal",
    "use a serif heading font", "move education above experience", "make my portfolio purple", "copy the gazette design"
  ],
  qa: [
    "where did I study", "which projects used LangGraph", "what are my key skills", "how many years of experience do I have",
    "list my certifications", "what did I do at Verizon", "do I have any publications", "summarize my experience",
    "which jobs used python", "when did I graduate", "what is my latest job", "tell me about my projects",
    "who did I work for", "what degree do I have", "show my skills", "what awards have I won"
  ],
  help: [
    "hi", "hello there", "thanks", "thank you so much", "what can you do", "help", "who are you", "good morning",
    "how does this work", "what are you", "ok thanks", "hey"
  ]
};

const SECTION_EXAMPLES = {
  education: [
    "masters in computer science at UNT", "bachelor of technology from JNTU", "I studied at Stanford university", "my degree in data science",
    "graduated with a GPA of 3.8", "MBA from Wharton", "PhD in machine learning", "high school diploma", "college course work", "add a degree", "add my education"
  ],
  experience: [
    "worked as a data scientist at Verizon", "software engineer at Google", "internship at Amazon", "joined Microsoft as a developer",
    "my job at a startup", "I was hired as an analyst", "current position at Oracle", "full time role at Meta", "contract work for a bank", "add a job", "add experience"
  ],
  projects: [
    "built an app called JobPilot", "a project that matches resumes", "side project on github", "hackathon project",
    "open source library I made", "my capstone project", "I developed a chatbot", "personal website project", "a RAG assistant I built", "add a project", "new project"
  ],
  certifications: [
    "certified AWS solutions architect", "Google cloud certification", "PMP certificate", "earned a credential from Coursera",
    "Azure fundamentals certification", "licensed professional engineer", "add a certification", "got certified in Kubernetes"
  ],
  achievements: [
    "won first place in a hackathon", "received the best paper award", "earned a scholarship", "employee of the month",
    "dean's list honor", "ranked top 10 in Kaggle", "add an award", "won a prize"
  ],
  volunteering: [
    "volunteer at a food bank", "mentor at code.org", "volunteered for a non profit", "teaching kids to code as a volunteer",
    "charity work for red cross", "add volunteering", "NGO volunteer"
  ],
  publications: [
    "published a paper in IEEE", "journal article on transformers", "conference paper at NeurIPS", "arxiv preprint",
    "add a publication", "wrote a research paper"
  ],
  patents: ["filed a patent", "patent for a new sensor", "patent application number", "add a patent", "granted a US patent"],
  interests: ["interested in photography", "hobbies include hiking", "I enjoy chess", "love playing guitar", "add an interest", "passion for traveling"],
  skills: ["add python and sql to my skills", "I know react and node", "proficient in pytorch", "my tech stack is langgraph and rag",
    "add a skill", "key skills are machine learning", "soft skills like leadership", "expert in kubernetes"],
  recommendations: ["my manager wrote a recommendation", "add a reference from my professor", "testimonial from a client",
    "Jane recommended me", "add a recommendation", "endorsement from a colleague"],
  summary: ["update my summary", "my professional summary should say", "change my bio", "rewrite my about me",
    "set my summary to AI engineer", "add a summary"],
  profile: ["my phone number is", "update my email", "my linkedin is", "I live in Dallas Texas", "change my headline",
    "my name is Uday", "update my profile", "my github url", "I am looking for data scientist roles", "update my address"]
};

const intentModel = new NaiveBayes(INTENT_EXAMPLES);
const sectionModel = new NaiveBayes(SECTION_EXAMPLES);

// ---- DL: embedding centroids (optional) --------------------------------------

let centroidsPromise = null;

function centroids() {
  if (!centroidsPromise) {
    centroidsPromise = (async () => {
      const { makeEmbedder } = require("./portfolioKnowledge");
      const embedder = await makeEmbedder();
      if (!embedder) return null;
      const build = async (examples) => {
        const result = {};
        for (const [label, list] of Object.entries(examples)) {
          const vectors = await embedder.embedDocuments(list);
          result[label] = vectors[0].map((_, i) => vectors.reduce((sum, vector) => sum + vector[i], 0) / vectors.length);
        }
        return result;
      };
      return { embedder, intent: await build(INTENT_EXAMPLES), section: await build(SECTION_EXAMPLES) };
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

// Blends Naive Bayes with embedding similarity when an embedding model is
// installed: { ranked, confident, method }
async function classify(model, kind, text, { useEmbeddings = true } = {}) {
  let ranked = model.predict(text);
  let method = "Naive Bayes";
  if (useEmbeddings) {
    const neural = await centroids();
    if (neural) {
      try {
        const vector = await neural.embedder.embedQuery(text);
        const sims = Object.entries(neural[kind]).map(([label, centroid]) => [label, cosine(vector, centroid)]);
        const exp = sims.map(([, sim]) => Math.exp(sim * 12));
        const sum = exp.reduce((a, b) => a + b, 0);
        const dl = Object.fromEntries(sims.map(([label], index) => [label, exp[index] / sum]));
        ranked = ranked.map((item) => ({ ...item, p: 0.5 * item.p + 0.5 * dl[item.label] })).sort((a, b) => b.p - a.p);
        method = "Naive Bayes + embeddings";
      } catch {
        // Naive Bayes alone
      }
    }
  }
  const [top, second] = ranked;
  // Confident: the message has known words, a clear winner and a margin
  const confident = top.known > 0 && top.p >= 0.55 && top.p - (second?.p || 0) >= 0.2;
  return { ranked, top: top.label, p: top.p, confident, method };
}

const classifyIntent = (text, options) => classify(intentModel, "intent", text, options);
const classifySection = (text, options) => classify(sectionModel, "section", text, options);

// ---- Request vs content --------------------------------------------------------

// The words that only say what the user wants to do
const REQUEST = [
  /\b(?:i\s+)?(?:want|would like|wanna|need|'?d like|am trying|'?m trying)\s+to\s+(?:add|create|put|enter|record|include|save|make)\b/gi,
  /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:add|create|put|enter|record|include|save)\b/gi,
  /\b(?:let'?s|lets|help me|i'?ll)\s+(?:add|create|put|enter|record)\b/gi,
  /\b(?:please|pls|kindly|now|here|just|also|again|for me|to my (?:portfolio|profile|section)|in my (?:portfolio|profile))\b/gi,
  /^\s*(?:add|create|new|record|enter|put|include|save)\b/gi,
  /\b(?:add|create|record)\b/gi
];
const FILLER_WORDS = new Set("a an the my new another one some any more details detail info information entry item thing something to in of for".split(" "));
const SECTION_NOUNS = /\b(projects?|jobs?|positions?|experiences?|work|degrees?|educations?|schools?|certifications?|certificates?|certs?|awards?|achievements?|volunteering|volunteer work|publications?|papers?|patents?|interests?|hobb(?:y|ies)|internships?|skills?|summary|bio|profile|recommendations?|references?|testimonials?|sections?)\b/gi;

// { content, requestOnly }: the message without its request words. When
// nothing is left ("I want to add a project"), it's only a request.
function splitRequest(text) {
  let rest = ` ${String(text || "")} `;
  for (const pattern of REQUEST) rest = rest.replace(pattern, " ");
  const withoutNouns = rest.replace(SECTION_NOUNS, " ");
  const left = tokens(withoutNouns).filter((word) => !FILLER_WORDS.has(word) && !STOP.has(word));
  return { content: rest.replace(/\s+/g, " ").trim(), requestOnly: left.length === 0 };
}

// "A project", "my new job", "the degree": a value that names the kind of
// thing, not the thing itself
// Answers that aren't answers: "hmm", "idk", "ok", "?"
const NON_ANSWER = /^\s*(h+m+|u+m+|u+h+|idk|dunno|ok(ay)?|k|yes|yeah|yep|no|nope|what\??|huh\??|maybe|not sure|i don'?t know|none|nothing|test(ing)?|asdf\w*|lol|\?+|\.+)\s*[.!?]*\s*$/i;

function isGenericValue(value) {
  if (NON_ANSWER.test(String(value || ""))) return true;
  const left = tokens(String(value || "").replace(SECTION_NOUNS, " ")).filter((word) => !FILLER_WORDS.has(word) && !STOP.has(word));
  return left.length === 0;
}

// "It's called JobPilot" -> "JobPilot"
const answerValue = (text) => String(text || "")
  .replace(/^\s*(?:(?:(?:its|it'?s|the) (?:name|title) is|it'?s|it is|its)\s+)?(?:(?:called|named|titled)\s+)?(?:(?:name|title)\s*:\s*)?/i, "")
  .replace(/^["“']|["”']+$/g, "")
  // A sentence's full stop goes; an abbreviation's ("M.S.") stays
  .replace(/(?<=[a-z0-9]{2})\.$/, "")
  .trim();

// An option the user's words actually point at; synonyms for the common ones
const OPTION_WORDS = {
  Completed: /\b(complet\w*|finish\w*|done|shipped|launched|delivered|built|made)\b/i,
  "In Progress": /\b(in progress|working on|building|ongoing|currently|still)\b/i,
  Planned: /\b(plan\w*|going to|will build|idea)\b/i,
  "On Hold": /\b(on hold|paused|stopped)\b/i
};

function optionMentioned(option, source) {
  if (OPTION_WORDS[option]) return OPTION_WORDS[option].test(source);
  const words = tokens(option).map(stem).filter((word) => !STOP.has(word));
  const said = new Set(tokens(source).map(stem));
  return words.length > 0 && words.every((word) => said.has(word));
}

module.exports = {
  classifyIntent, classifySection, splitRequest, isGenericValue, answerValue, optionMentioned, features, NaiveBayes,
  INTENT_EXAMPLES, SECTION_EXAMPLES
};
