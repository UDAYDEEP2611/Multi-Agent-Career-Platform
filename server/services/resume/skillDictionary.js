const catalog = require("../../scripts/skillCatalogData");
const { mentions } = require("./atsRules");
const { shortName } = require("./resumeQuality");

// Finds known technical skills in a job description without AI: every
// skill in the catalog (scripts/skillCatalogData.js) and the user's own
// skills. Names that are also everyday words would match ordinary text
// ("go", "transactions"), so they are left to the AI step.

const AMBIGUOUS = new Set([
  "go", "r", "transactions", "indexing", "clustering", "localization", "recursion", "scripting",
  "rollbacks", "scalability", "debugging", "databases", "data types", "orchestration",
  "forensics", "benchmarking", "encryption", "dbt", "ajax",
  "swift", "bootstrap", "helm", "julia", "guardrails", "bash", "statistics"
]);

// Short names job posts use for catalog skills
const ALIASES = {
  "Microsoft Azure": ["Azure"],
  "Google Cloud Platform": ["GCP", "Google Cloud"],
  "Amazon Web Services": ["AWS"],
  "Large Language Models": ["LLMs"],
  "Retrieval-Augmented Generation": ["RAG"],
  "Natural Language Processing": ["NLP"],
  "Apache Spark": ["Spark"],
  "Apache Kafka": ["Kafka"],
  "Apache Airflow": ["Airflow"],
  "PostgreSQL": ["Postgres"],
  "Kubernetes": ["K8s"],
  "Node.js": ["NodeJS"],
  "Hugging Face Transformers": ["Hugging Face"],
  "Model Context Protocol": ["MCP"],
  "Amazon Bedrock": ["Bedrock"],
  "Amazon SageMaker": ["SageMaker"],
  "Amazon Redshift": ["Redshift"],
  "Plotly Dash": ["Dash"],
  "Azure AI Foundry": ["Azure Foundry", "AI Foundry"],
  "Agent-to-Agent Protocol": ["A2A"]
};

// "Business Intelligence (BI)" -> ["Business Intelligence"], plus the
// acronym when it has 3 or more letters ("CRM", "SaaS"), plus aliases.
// The first variant found in the job is the name shown.
function variants(name) {
  const aliases = ALIASES[name] || [];
  const match = name.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (!match) return [name, ...aliases];

  const [, base, acronym] = match;
  return [base, ...(acronym.replace(/[^A-Za-z]/g, "").length >= 3 ? [acronym] : [])];
}

const technicalNames = catalog
  .filter((skill) => skill.skillType === "technical")
  .map((skill) => skill.name);

// Skills found in the text, in the order they first appear in it
function dictionaryKeywords(jobDescription, extraNames = []) {
  const text = String(jobDescription || "");
  if (!text.trim()) return [];

  const lower = text.toLowerCase();
  const found = [];
  const seen = new Set();

  for (const name of [...extraNames, ...technicalNames]) {
    const key = name.toLowerCase();
    if (seen.has(key) || AMBIGUOUS.has(key) || name.length < 2) continue;
    seen.add(key);

    const hit = variants(name).find((variant) => mentions(text, variant));
    if (hit) {
      // Named the way the job wrote it: "CRM", "Azure"
      const position = lower.indexOf(hit.toLowerCase());
      found.push({ name: hit, position: position === -1 ? Infinity : position });
    }
  }

  // Drop a skill only seen inside a longer one ("Scripting" in "Shell
  // Scripting"); keep it if the job also names it on its own ("...apps
  // using Databricks" as well as "Databricks Apps")
  const names = found.map((entry) => entry.name);
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const standsAlone = (name) => {
    const longer = names.filter((other) => other !== name && other.length > name.length && mentions(other, name));
    if (!longer.length) return true;
    const rest = longer.reduce((remaining, other) => remaining.replace(new RegExp(escapeRegex(other), "gi"), " "), text);
    return mentions(rest, name);
  };
  return found
    .filter((entry) => standsAlone(entry.name))
    .sort((a, b) => a.position - b.position)
    .map((entry) => shortName(entry.name))
    .filter((name, index, names) => names.indexOf(name) === index);
}

module.exports = { dictionaryKeywords };
