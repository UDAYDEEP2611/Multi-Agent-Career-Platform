// Technical abbreviations and their expansions, so "LLM" on a resume
// matches "Large Language Model" in a job (and the other way round).
//
// Each entry: [short form, ...expansions]. Exact synonyms are matched
// anywhere. Context-sensitive ones (CV: computer vision or curriculum vitae;
// PR: pull request or public relations; ML: machine learning or milliliters)
// count only when the text around them is about the right field, given by a
// regex after the names: [short, ...expansions, /context/].

const SOFTWARE = /\b(?:software|engineer\w*|develop\w*|code|coding|programm\w*|api|apis|deploy\w*|python|java\w*|cloud|data|model\w*|pipeline\w*|server\w*|system\w*|devops|git\w*|repo\w*)\b/i;
const ML = /\b(?:machine learning|deep learning|models?|neural|training|trained|ai|data|python|pytorch|tensorflow|scikit|nlp|llms?|vision|image\w*|classif\w*|predict\w*|features?)\b/i;
const VISION = /\b(?:image\w*|vision|opencv|yolo|object detection|segmentation|video|camera|ocr|cnn|convolutional|pixels?|visual)\b/i;
const SECURITY = /\b(?:security|secur\w*|threat\w*|siem|incident|soc|vulnerab\w*|attack\w*|malware|firewall|forensic\w*|splunk|alert\w*)\b/i;

const REGISTRY = [
  // AI / ML
  ["AI", "Artificial Intelligence"],
  ["ML", "Machine Learning", ML],
  ["DL", "Deep Learning", ML],
  ["LLM", "Large Language Model", "Large Language Models", "LLMs"],
  ["SLM", "Small Language Model", "Small Language Models"],
  ["VLM", "Vision Language Model", "Vision-Language Model"],
  ["RAG", "Retrieval-Augmented Generation", "Retrieval Augmented Generation"],
  ["GenAI", "Generative AI", "Gen AI", "Generative Artificial Intelligence"],
  ["NLP", "Natural Language Processing"],
  ["NLU", "Natural Language Understanding"],
  ["NLG", "Natural Language Generation"],
  ["CV", "Computer Vision", VISION],
  ["OCR", "Optical Character Recognition"],
  ["ASR", "Automatic Speech Recognition", "Speech-to-Text"],
  ["TTS", "Text-to-Speech", ML],
  ["NER", "Named Entity Recognition"],
  ["RL", "Reinforcement Learning", ML],
  ["RLHF", "Reinforcement Learning from Human Feedback"],
  ["SFT", "Supervised Fine-Tuning"],
  ["PEFT", "Parameter-Efficient Fine-Tuning"],
  ["LoRA", "Low-Rank Adaptation"],
  ["CNN", "Convolutional Neural Network", "Convolutional Neural Networks", ML],
  ["RNN", "Recurrent Neural Network", "Recurrent Neural Networks"],
  ["LSTM", "Long Short-Term Memory"],
  ["GAN", "Generative Adversarial Network", "Generative Adversarial Networks"],
  ["GNN", "Graph Neural Network", "Graph Neural Networks"],
  ["KG", "Knowledge Graph", "Knowledge Graphs", ML],
  ["XAI", "Explainable AI"],
  ["EDA", "Exploratory Data Analysis", ML],
  ["KNN", "k-Nearest Neighbors", "K-Nearest Neighbours"],
  ["SVM", "Support Vector Machine", "Support Vector Machines"],
  ["PCA", "Principal Component Analysis"],
  ["ANN", "Approximate Nearest Neighbor", ML],
  ["MLOps", "Machine Learning Operations", "ML Ops"],
  ["LLMOps", "LLM Operations", "LLM Ops"],
  ["MCP", "Model Context Protocol"],
  ["A2A", "Agent-to-Agent Protocol", "Agent2Agent"],
  ["HITL", "Human-in-the-Loop"],
  ["GPU", "Graphics Processing Unit"],
  // Data
  ["ETL", "Extract, Transform, Load", "Extract Transform Load"],
  ["ELT", "Extract, Load, Transform"],
  ["SQL", "Structured Query Language"],
  ["RDBMS", "Relational Database Management System"],
  ["DBMS", "Database Management System"],
  ["OLAP", "Online Analytical Processing"],
  ["OLTP", "Online Transaction Processing"],
  ["CDC", "Change Data Capture", SOFTWARE],
  ["BI", "Business Intelligence", /\b(?:dashboards?|reports?|reporting|power bi|tableau|looker|analytics|kpis?|data)\b/i],
  ["KPI", "Key Performance Indicator", "Key Performance Indicators"],
  // Software engineering
  ["API", "Application Programming Interface"],
  ["SDK", "Software Development Kit"],
  ["OOP", "Object-Oriented Programming"],
  ["TDD", "Test-Driven Development"],
  ["BDD", "Behavior-Driven Development"],
  ["SDLC", "Software Development Life Cycle", "Software Development Lifecycle"],
  ["UI", "User Interface"],
  ["UX", "User Experience"],
  ["JS", "JavaScript"],
  ["TS", "TypeScript", SOFTWARE],
  ["ORM", "Object-Relational Mapping"],
  ["SPA", "Single-Page Application", SOFTWARE],
  ["SSR", "Server-Side Rendering"],
  ["MVC", "Model-View-Controller"],
  ["QA", "Quality Assurance"],
  ["PR", "Pull Request", "Pull Requests", SOFTWARE],
  ["CLI", "Command-Line Interface"],
  ["DSA", "Data Structures and Algorithms"],
  // Cloud and DevOps
  ["CI/CD", "Continuous Integration/Continuous Delivery", "Continuous Integration and Continuous Delivery", "Continuous Integration/Continuous Deployment", "Continuous Integration and Continuous Deployment"],
  ["CI", "Continuous Integration", SOFTWARE],
  ["CD", "Continuous Delivery", "Continuous Deployment", SOFTWARE],
  ["IaC", "Infrastructure as Code"],
  ["K8s", "Kubernetes"],
  ["SRE", "Site Reliability Engineering"],
  ["AWS", "Amazon Web Services"],
  ["GCP", "Google Cloud Platform", "Google Cloud"],
  ["OCI", "Oracle Cloud Infrastructure"],
  ["IaaS", "Infrastructure as a Service"],
  ["PaaS", "Platform as a Service"],
  ["SaaS", "Software as a Service"],
  ["VPC", "Virtual Private Cloud"],
  ["EC2", "Elastic Compute Cloud"],
  ["S3", "Simple Storage Service", SOFTWARE],
  ["EKS", "Elastic Kubernetes Service"],
  ["AKS", "Azure Kubernetes Service"],
  ["GKE", "Google Kubernetes Engine"],
  ["IAM", "Identity and Access Management"],
  ["VM", "Virtual Machine", "Virtual Machines", SOFTWARE],
  ["SLA", "Service Level Agreement", "Service-Level Agreement"],
  ["SLO", "Service Level Objective", "Service-Level Objective"],
  // Security
  ["RBAC", "Role-Based Access Control"],
  ["ABAC", "Attribute-Based Access Control"],
  ["SSO", "Single Sign-On"],
  ["MFA", "Multi-Factor Authentication"],
  ["PII", "Personally Identifiable Information"],
  ["PHI", "Protected Health Information"],
  ["SIEM", "Security Information and Event Management"],
  ["SOC", "Security Operations Center", SECURITY],
  ["XSS", "Cross-Site Scripting"],
  ["CSRF", "Cross-Site Request Forgery"],
  ["DLP", "Data Loss Prevention"],
  ["IR", "Incident Response", SECURITY],
  ["PKI", "Public Key Infrastructure"],
  ["WAF", "Web Application Firewall"],
  ["EDR", "Endpoint Detection and Response"],
  // Delivery and domains
  ["POC", "Proof of Concept"],
  ["MVP", "Minimum Viable Product", /\b(?:product|launch\w*|users?|startup|feature\w*|prototype)\b/i],
  ["SME", "Subject Matter Expert"],
  ["EHR", "Electronic Health Record", "Electronic Health Records"],
  ["EMR", "Electronic Medical Record", "Electronic Medical Records"]
];

const key = (name) => String(name).toLowerCase().replace(/[^a-z0-9/+#]/g, "");

// key -> { short, names, context }
const BY_NAME = new Map();
for (const entry of REGISTRY) {
  const context = entry[entry.length - 1] instanceof RegExp ? entry[entry.length - 1] : null;
  const names = entry.filter((part) => typeof part === "string");
  const record = { short: names[0], names, context };
  for (const name of names) if (!BY_NAME.has(key(name))) BY_NAME.set(key(name), record);
}

// Other names for a term: [{ name, context? }]. A context-sensitive short
// form carries the pattern the surrounding text must match.
function synonymsOf(term) {
  const record = BY_NAME.get(key(term));
  if (!record) return [];
  return record.names
    .filter((name) => key(name) !== key(term))
    .map((name) => (record.context && name === record.short ? { name, context: record.context } : { name }));
}

// One id for every name of the same thing ("large language models" -> "llm").
// A context-sensitive short form gets an id only when its text fits.
function abbreviationId(term, text = "") {
  const record = BY_NAME.get(key(term));
  if (!record) return null;
  if (record.context && key(term) === key(record.short) && text && !record.context.test(text)) return null;
  return record.short.toLowerCase();
}

module.exports = { REGISTRY, synonymsOf, abbreviationId };
