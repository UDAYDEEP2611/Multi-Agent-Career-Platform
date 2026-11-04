const { mentions } = require("../resume/atsRules");
const { aliasesOf } = require("../resume/resumeQuality");
const { EVIDENCE } = require("./matchModel");
const { DEGREES } = require("./requirements");

// Checks each requirement against what the resume actually shows.
// A skill only in the Skills list is "listed only"; the same skill in a
// bullet about real work is "demonstrated", and with deployment, scale,
// testing or a measured result, "strong".

const DEPTH = /(deploy|production|scal|monitor|test|latency|throughput|users|\d)/i;

// Skills that show a broader requirement ("pgvector" shows vector database
// work). Related evidence counts as at most "demonstrated", and says what
// it was shown through.
const RELATED = {
  "vector databases": ["pgvector", "Pinecone", "Weaviate", "ChromaDB", "Chroma", "Milvus", "Qdrant", "FAISS", "Oracle AI Vector Search"],
  "large language models": ["LangChain", "LangGraph", "LlamaIndex", "OpenAI", "GPT", "Claude", "Llama", "Mistral", "Ollama", "RAG", "Retrieval-Augmented Generation", "Prompt Engineering", "Fine-tuning"],
  "llms": ["LangChain", "LangGraph", "LlamaIndex", "OpenAI", "GPT", "Claude", "Llama", "Mistral", "Ollama", "RAG", "Retrieval-Augmented Generation", "Prompt Engineering", "Fine-tuning"],
  "generative ai": ["LLM", "LangChain", "LangGraph", "OpenAI", "Claude", "RAG", "Stable Diffusion", "Prompt Engineering"],
  "ai agents": ["LangGraph", "CrewAI", "AutoGen", "Agentic", "MCP", "A2A", "Multi-Agent"],
  "agentic ai": ["LangGraph", "CrewAI", "AutoGen", "AI Agents", "MCP", "A2A", "Multi-Agent"],
  "ci/cd": ["GitHub Actions", "Jenkins", "GitLab CI", "CircleCI", "Argo CD", "Continuous Integration", "Continuous Deployment"],
  "aws": ["SageMaker", "Bedrock", "Lambda", "S3", "EC2", "ECS", "EKS", "Glue", "Redshift", "DynamoDB", "CloudFormation"],
  "microsoft azure": ["Azure OpenAI", "Azure Functions", "Azure DevOps", "Cosmos DB", "Synapse"],
  "google cloud platform": ["Vertex AI", "BigQuery", "Cloud Run", "GKE"],
  "model evaluation": ["RAGAS", "LLM-as-Judge", "LangSmith", "Arize", "evaluation pipeline", "evals", "A/B Testing"],
  "mlops": ["MLflow", "Kubeflow", "Model Serving", "Model Monitoring", "SageMaker", "Vertex AI"],
  "machine learning": ["PyTorch", "TensorFlow", "scikit-learn", "XGBoost", "Keras", "Deep Learning", "model training"],
  "deep learning": ["PyTorch", "TensorFlow", "Keras", "Transformers", "CNN", "LSTM"],
  "containerization": ["Docker", "Kubernetes", "Podman"],
  "data pipelines": ["Airflow", "Spark", "PySpark", "Kafka", "dbt", "ETL", "Databricks"],
  "rest apis": ["FastAPI", "Flask", "Django", "Express", "Spring Boot", "RESTful APIs"],
  "infrastructure as code": ["Terraform", "Pulumi", "CloudFormation", "Ansible"],
  "observability": ["OpenTelemetry", "Prometheus", "Grafana", "Datadog", "LangSmith", "Langfuse"]
};

const relatedTerms = (terms) =>
  [...new Set(terms.flatMap((term) => RELATED[term.toLowerCase()] || []))];

// Every bullet with where it came from
function bulletsOf(resume) {
  return [
    ...resume.experience.flatMap((item) =>
      item.bullets.map((text, index) => ({ text, where: `${item.title} at ${item.organization}, bullet ${index + 1}` }))),
    ...resume.projects.flatMap((item) =>
      item.bullets.map((text, index) => ({ text, where: `Project "${item.title}", bullet ${index + 1}` })))
  ];
}

const monthIndex = (date) => (date ? date.year * 12 + ((date.month || 1) - 1) : null);

// Months of work counted once even when jobs overlap
function experienceYears(experience, now = new Date()) {
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const ranges = experience
    .map((item) => [monthIndex(item.start), item.current ? thisMonth : monthIndex(item.end)])
    .filter(([start, end]) => start !== null && end !== null && end >= start)
    .sort((a, b) => a[0] - b[0]);

  let months = 0;
  let current = null;
  for (const [start, end] of ranges) {
    if (current && start <= current[1] + 1) {
      current[1] = Math.max(current[1], end);
    } else {
      if (current) months += current[1] - current[0] + 1;
      current = [start, end];
    }
  }
  if (current) months += current[1] - current[0] + 1;

  return Math.round((months / 12) * 10) / 10;
}

function degreeLevel(education) {
  return Math.max(0, ...education.map((item) => {
    const text = `${item.degree} ${item.fieldOfStudy}`;
    const match = DEGREES.find(([, , pattern]) => pattern.test(text));
    return match ? match[1] : 0;
  }));
}

function verifySkill(requirement, resume, bullets) {
  const terms = [...new Set((requirement.terms || [requirement.text]).flatMap((term) => [term, ...aliasesOf(term)]))];
  const hit = (text) => terms.some((term) => mentions(text, term));
  const found = bullets.filter((bullet) => hit(bullet.text));

  if (found.length >= 2 || found.some((bullet) => DEPTH.test(bullet.text))) {
    return { level: "strong", where: found.slice(0, 3).map((bullet) => bullet.where) };
  }
  if (found.length) return { level: "demonstrated", where: found.map((bullet) => bullet.where) };

  const listed = [...resume.skills.technical, ...resume.skills.soft].some(hit) || hit(resume.summary || "");

  // Shown through a related skill: capped at "demonstrated"
  const related = relatedTerms(terms);
  const relatedBullets = bullets
    .map((bullet) => ({ ...bullet, via: related.filter((term) => mentions(bullet.text, term)) }))
    .filter((bullet) => bullet.via.length);
  if (relatedBullets.length) {
    const via = [...new Set(relatedBullets.flatMap((bullet) => bullet.via))].slice(0, 4).join(", ");
    return {
      level: "demonstrated",
      where: relatedBullets.slice(0, 2).map((bullet) => bullet.where),
      detail: `Shown through related work (${via}), not the exact term.`
    };
  }

  return listed ? { level: "partial", where: ["Skills or summary only"] } : { level: "missing", where: [] };
}

function verifyBehavior(requirement, bullets) {
  const pattern = new RegExp(requirement.pattern, "i");
  const found = bullets.filter((bullet) => pattern.test(bullet.text));
  if (found.length >= 2) return { level: "strong", where: found.slice(0, 3).map((bullet) => bullet.where) };
  if (found.length) return { level: "demonstrated", where: found.map((bullet) => bullet.where) };
  return { level: "missing", where: [] };
}

// requirements -> the same list with { level, score, where, detail }
function verifyRequirements(requirements, resume) {
  const bullets = bulletsOf(resume);
  const years = experienceYears(resume.experience);
  const degree = degreeLevel(resume.education);

  return requirements.map((requirement) => {
    if (requirement.kind === "years") {
      const score = Math.min(1, years / requirement.minYears);
      return {
        ...requirement,
        level: score >= 1 ? "strong" : score >= 0.6 ? "partial" : "missing",
        score: Math.round(score * 100) / 100,
        where: [],
        detail: `${years} years of work counted from your job dates (overlapping jobs counted once); the job asks for ${requirement.minYears}+.`
      };
    }

    if (requirement.kind === "degree") {
      const score = degree >= requirement.level ? 1 : degree > 0 ? 0.5 : 0;
      return {
        ...requirement,
        level: score === 1 ? "strong" : score ? "partial" : "missing",
        score,
        where: [],
        detail: degree ? `Your highest degree meets ${score === 1 ? "" : "part of "}this requirement.` : "No degree on the resume."
      };
    }

    const { level, where, detail = "" } = requirement.kind === "behavioral"
      ? verifyBehavior(requirement, bullets)
      : verifySkill(requirement, resume, bullets);

    return {
      ...requirement,
      level,
      score: EVIDENCE[level].score,
      where,
      detail: level === "missing" ? "Not on the resume. That isn't proof you lack it: add it only if you have it." : detail
    };
  });
}

module.exports = { verifyRequirements, experienceYears, degreeLevel };
