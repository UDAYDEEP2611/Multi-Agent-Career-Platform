// How technologies relate, for matching a resume to a job requirement.
// Keys are the requirement (lowercase); values are what a resume might show.
//
//   EQUIVALENT  the same skill under another name or a direct implementation
//               (Apache Spark <- PySpark, Containerization <- Docker)
//   RELATED     shared capabilities, not interchangeable; credited with the
//               consideration stated (AWS Glue <- PySpark: ETL transfers,
//               Glue-specific operations may not)
//   PARTIAL     related but doesn't establish the skill (Kubernetes <- Docker);
//               credited only when the job asks for little depth; noCredit
//               relations share no capability (LangGraph for persistent
//               memory) and are noted but earn nothing

const EQUIVALENT = {
  "apache spark": ["PySpark", "Spark"],
  "spark": ["PySpark", "Apache Spark"],
  "restful apis": ["REST API", "REST APIs", "REST endpoints", "RESTful", "FastAPI", "Flask", "Express", "Spring Boot", "Django REST"],
  "rest apis": ["REST API", "REST endpoints", "RESTful", "FastAPI", "Flask", "Express", "Spring Boot", "Django REST"],
  "apis": ["REST API", "FastAPI", "Flask", "Express", "GraphQL", "gRPC", "Spring Boot"],
  "containerization": ["Docker", "Podman", "containers", "containerized"],
  "containers": ["Docker", "Podman", "containerized"],
  "retrieval-augmented generation": ["RAG"],
  "rag": ["Retrieval-Augmented Generation"],
  "infrastructure as code": ["Terraform", "CloudFormation", "Pulumi", "AWS CDK", "Bicep"],
  "iac": ["Terraform", "CloudFormation", "Pulumi", "AWS CDK", "Bicep"],
  "relational querying": ["SQL", "PostgreSQL", "MySQL", "T-SQL", "PL/SQL", "Oracle SQL"],
  "sql": ["PostgreSQL", "MySQL", "T-SQL", "PL/SQL", "Oracle SQL", "SQL Server", "SQLite"],
  "relational databases": ["PostgreSQL", "MySQL", "Oracle Database", "SQL Server", "SQL"],
  "nosql": ["MongoDB", "DynamoDB", "Cassandra", "Cosmos DB", "Redis", "Couchbase"],
  "large language models": ["LLM", "LLMs", "GPT", "Claude", "Llama", "Mistral", "Gemini"],
  "llms": ["LLM", "Large Language Models", "GPT", "Claude", "Llama", "Mistral", "Gemini"],
  "llm": ["LLMs", "Large Language Models", "GPT", "Claude", "Llama", "Mistral"],
  "generative ai": ["GenAI", "LLM", "LLMs", "GPT", "Claude", "Stable Diffusion"],
  "vector databases": ["pgvector", "Pinecone", "Weaviate", "Milvus", "Qdrant", "FAISS", "Chroma", "ChromaDB", "Oracle AI Vector Search"],
  "vector search": ["pgvector", "Pinecone", "Weaviate", "Milvus", "Qdrant", "FAISS", "Chroma", "Oracle AI Vector Search"],
  "ci/cd": ["GitHub Actions", "Jenkins", "GitLab CI", "CircleCI", "Azure Pipelines", "Argo CD", "continuous integration", "continuous deployment"],
  "version control": ["Git", "GitHub", "GitLab", "Bitbucket"],
  "git": ["GitHub", "GitLab", "Bitbucket"],
  "machine learning": ["scikit-learn", "XGBoost", "LightGBM", "PyTorch", "TensorFlow", "model training", "ML models"],
  "deep learning": ["PyTorch", "TensorFlow", "Keras", "neural networks", "transformers"],
  "nlp": ["natural language processing", "spaCy", "NLTK", "Hugging Face", "transformers"],
  "natural language processing": ["NLP", "spaCy", "NLTK", "Hugging Face"],
  "kubernetes": ["K8s", "EKS", "AKS", "GKE", "OKE", "OpenShift"],
  // A provider's own services in a bullet are work on that provider ("SageMaker" is AWS)
  "aws": ["Amazon Web Services", "SageMaker", "Amazon Bedrock", "AWS Bedrock", "Bedrock", "Lambda", "EC2", "S3", "EKS", "ECS", "DynamoDB", "Redshift", "CloudFormation", "AWS Glue", "Kinesis", "Step Functions"],
  "azure": ["Microsoft Azure", "Azure OpenAI", "Azure Machine Learning", "Azure ML", "AKS", "Azure Functions", "Cosmos DB", "Synapse", "Azure Data Factory", "Azure AI"],
  "gcp": ["Google Cloud", "Google Cloud Platform", "Vertex AI", "BigQuery", "GKE", "Cloud Run", "Cloud Functions", "Dataflow"],
  "google cloud platform": ["GCP", "Google Cloud"],
  "oci": ["Oracle Cloud Infrastructure", "Oracle Cloud"],
  // Writing React or Node.js code is writing JavaScript
  "javascript": ["TypeScript", "ES6", "JS", "React", "Node.js", "Express", "Next.js", "Vue", "Angular"],
  "node.js": ["Node", "NodeJS", "Express"],
  "etl": ["ELT", "data pipelines", "ETL pipelines"],
  "data pipelines": ["ETL", "ELT", "Airflow", "dbt", "Spark", "PySpark", "Kafka"],
  "data visualization": ["Tableau", "Power BI", "Looker", "dashboards", "matplotlib"],
  "agile": ["Scrum", "Kanban", "sprints", "sprint planning"],
  "ehr": ["Epic", "Cerner", "electronic health record", "EMR"],
  "electronic health record": ["EHR", "Epic", "Cerner", "EMR"],
  "observability": ["OpenTelemetry", "Prometheus", "Grafana", "Datadog", "New Relic", "Splunk"],
  "prompt engineering": ["prompt design", "prompting", "context engineering"],
  "prompt design": ["prompt engineering", "prompting", "context engineering"],
  "ai agents": ["LangGraph", "CrewAI", "AutoGen", "agentic", "multi-agent"],
  "agentic ai": ["LangGraph", "CrewAI", "AutoGen", "AI agents", "multi-agent"],
  "llm evaluation": ["RAGAS", "LLM-as-Judge", "LLM-as-a-judge", "DeepEval", "TruLens", "LangSmith evaluations", "groundedness", "evals"],
  "evaluation techniques": ["RAGAS", "LLM-as-Judge", "DeepEval", "TruLens", "A/B testing", "evals"],
  "model evaluation": ["RAGAS", "LLM-as-Judge", "cross-validation", "A/B testing", "evals", "precision", "recall"],
  "ml libraries": ["scikit-learn", "PyTorch", "TensorFlow", "XGBoost", "LightGBM", "Keras", "Hugging Face", "spaCy", "JAX"],
  "machine learning libraries": ["scikit-learn", "PyTorch", "TensorFlow", "XGBoost", "LightGBM", "Keras", "Hugging Face", "spaCy"],
  "devops tools": ["Azure DevOps", "GitHub Actions", "GitLab CI", "Jenkins", "CI/CD", "Argo CD", "Docker", "Kubernetes", "Terraform"],
  "devops": ["Azure DevOps", "GitHub Actions", "GitLab CI", "Jenkins", "CI/CD", "Argo CD", "Docker", "Kubernetes", "Terraform"],
  // AI coding assistants do the same job as each other; building agents (LangGraph) isn't using one
  "ai coding tools": ["Claude Code", "GitHub Copilot", "Copilot", "Cursor", "Codex", "Windsurf", "Tabnine", "Amazon Q Developer", "CodeWhisperer", "AI pair programming", "AI-assisted coding"],
  "ai-enabled development tools": ["Claude Code", "GitHub Copilot", "Copilot", "Cursor", "Codex", "Windsurf", "Tabnine", "Amazon Q Developer", "CodeWhisperer", "AI pair programming", "AI-assisted coding"],
  "claude code": ["GitHub Copilot", "Copilot", "Cursor", "Codex", "Windsurf", "Tabnine", "Amazon Q Developer", "CodeWhisperer"],
  "github copilot": ["Claude Code", "Copilot", "Cursor", "Codex", "Windsurf", "Tabnine", "Amazon Q Developer", "CodeWhisperer"],
  "copilot": ["Claude Code", "GitHub Copilot", "Cursor", "Codex", "Windsurf", "Tabnine", "Amazon Q Developer", "CodeWhisperer"],
  "agentic frameworks": ["LangGraph", "CrewAI", "AutoGen", "Semantic Kernel", "LangChain agents", "MCP"]
};

const RELATED = {
  "aws glue": { tools: ["PySpark", "Spark", "Airflow"], note: "ETL expertise transfers; AWS Glue-specific operations may not." },
  "databricks": { tools: ["Spark", "PySpark", "Delta Lake"], note: "Strong data-processing overlap." },
  "azure data factory": { tools: ["Airflow", "AWS Glue", "AWS Step Functions"], note: "Similar workflow orchestration concepts." },
  "airflow": { tools: ["Prefect", "Dagster", "Azure Data Factory", "AWS Step Functions", "Luigi"], note: "Orchestration concepts transfer; Airflow DAG specifics may not." },
  "langgraph": { tools: ["LangChain", "CrewAI", "AutoGen", "Semantic Kernel", "LlamaIndex"], note: "Similar agent-orchestration concepts, different APIs." },
  "langchain": { tools: ["LangGraph", "LlamaIndex", "Semantic Kernel"], note: "Similar LLM-application concepts, different APIs." },
  "pinecone": { tools: ["pgvector", "Milvus", "Weaviate", "Qdrant", "FAISS", "Chroma"], note: "Vector retrieval transfers." },
  "jenkins": { tools: ["GitHub Actions", "GitLab CI", "CircleCI", "Azure Pipelines"], note: "CI/CD expertise transfers." },
  "github actions": { tools: ["Jenkins", "GitLab CI", "CircleCI", "Azure Pipelines"], note: "CI/CD expertise transfers." },
  "power bi": { tools: ["Tableau", "Looker", "Qlik"], note: "BI concepts transfer; DAX may not." },
  "tableau": { tools: ["Power BI", "Looker", "Qlik"], note: "BI concepts transfer." },
  "pytorch": { tools: ["TensorFlow", "Keras", "JAX"], note: "Deep learning concepts transfer." },
  "tensorflow": { tools: ["PyTorch", "JAX"], note: "Deep learning concepts transfer." },
  "snowflake": { tools: ["Redshift", "BigQuery", "Synapse", "Databricks SQL"], note: "Cloud data-warehouse concepts transfer." },
  "redshift": { tools: ["Snowflake", "BigQuery", "Synapse"], note: "Cloud data-warehouse concepts transfer." },
  "bigquery": { tools: ["Snowflake", "Redshift", "Synapse"], note: "Cloud data-warehouse concepts transfer." },
  "kafka": { tools: ["Kinesis", "Pub/Sub", "RabbitMQ", "Event Hubs", "Pulsar"], note: "Streaming concepts transfer." },
  "terraform": { tools: ["CloudFormation", "Pulumi", "AWS CDK", "Bicep"], note: "IaC concepts transfer; syntax and providers differ." },
  "react": { tools: ["Angular", "Vue", "Svelte"], note: "Front-end framework concepts transfer." },
  "angular": { tools: ["React", "Vue"], note: "Front-end framework concepts transfer." },
  "vue": { tools: ["React", "Angular"], note: "Front-end framework concepts transfer." },
  "java": { tools: ["Kotlin", "Scala", "C#"], note: "Object-oriented and JVM concepts transfer." },
  "c#": { tools: ["Java", "Kotlin"], note: "Object-oriented concepts transfer." },
  "postgresql": { tools: ["MySQL", "Oracle SQL", "SQL Server", "Oracle Database"], note: "Relational database skills transfer." },
  "mysql": { tools: ["PostgreSQL", "SQL Server", "Oracle Database"], note: "Relational database skills transfer." },
  "mongodb": { tools: ["DynamoDB", "Cosmos DB", "Couchbase"], note: "Document-database concepts transfer." },
  "fastapi": { tools: ["Flask", "Django", "Express"], note: "API framework concepts transfer." },
  "flask": { tools: ["FastAPI", "Django"], note: "API framework concepts transfer." },
  "django": { tools: ["Flask", "FastAPI"], note: "Web framework concepts transfer." },
  "epic": { tools: ["Cerner", "Meditech", "Allscripts"], note: "EHR concepts transfer; Epic-specific workflows may not." },
  "quickbooks": { tools: ["Xero", "NetSuite", "Sage"], note: "Accounting software concepts transfer." },
  "salesforce": { tools: ["HubSpot", "Microsoft Dynamics", "Zoho CRM"], note: "CRM concepts transfer." },
  "sap": { tools: ["Oracle ERP", "NetSuite", "Microsoft Dynamics"], note: "ERP concepts transfer; SAP modules may not." }
};

const PARTIAL = {
  "kubernetes": { tools: ["Docker", "containers"], note: "Docker shows containers, not Kubernetes orchestration." },
  "database administration": { tools: ["SQL", "PostgreSQL", "MySQL"], note: "SQL querying isn't the same as database administration." },
  "agent memory": { tools: ["LangGraph", "LangChain"], noCredit: true, note: "An agent framework doesn't by itself show persistent agent memory." },
  "persistent memory": { tools: ["LangGraph", "LangChain"], noCredit: true, note: "An agent framework doesn't by itself show persistent memory." },
  "graphrag": { tools: ["RAG", "Retrieval-Augmented Generation"], note: "RAG doesn't by itself show GraphRAG." },
  "knowledge graphs": { tools: ["RAG", "vector search"], noCredit: true, note: "Vector retrieval isn't knowledge-graph work." },
  "mlops": { tools: ["CI/CD", "GitHub Actions", "Jenkins", "Docker"], note: "CI/CD doesn't by itself show MLOps (model registry, serving, monitoring)." },
  "fine-tuning": { tools: ["prompt engineering", "RAG"], noCredit: true, note: "Prompting or RAG isn't model fine-tuning." },
  "dax": { tools: ["Tableau", "Looker", "Qlik"], noCredit: true, note: "BI concepts transfer, but DAX itself isn't demonstrated." },
  "multi-cloud": { tools: ["AWS", "Azure", "GCP", "OCI"], note: "One cloud doesn't show expertise across providers." },
  // General cloud experience doesn't prove a specific provider
  "aws": { tools: ["Azure", "GCP", "Google Cloud", "OCI"], note: "Cloud concepts transfer; AWS-specific services aren't demonstrated." },
  "azure": { tools: ["AWS", "GCP", "Google Cloud", "OCI"], note: "Cloud concepts transfer; Azure-specific services aren't demonstrated." },
  "gcp": { tools: ["AWS", "Azure", "OCI"], note: "Cloud concepts transfer; GCP-specific services aren't demonstrated." },
  "kubernetes administration": { tools: ["Docker", "containers"], note: "Containers aren't Kubernetes administration." },
  "people management": { tools: ["mentored", "mentoring", "led"], noCredit: true, note: "Mentoring or technical leadership isn't people management." }
};

// Foundational practices that real work normally involves, inferred (not
// verified) from bullets: GitHub Actions pipelines imply version-controlled
// work. Credit depends on how deep the job asks (CREDIT.inferred) and is
// never full; nothing is inferred from a skills list or from another
// inference. min: how many different signals are needed. confirmOnly:
// plausible but not established (Agile from team delivery): no credit,
// reported as "needs confirmation" instead of a gap.
const INFERENCES = {
  "git": {
    signals: [["GitHub Actions", /\bgithub actions\b/i], ["GitLab CI", /\bgitlab ci\b/i], ["CI/CD", /\bci\/cd\b/i], ["pull requests", /\bpull requests?\b/i], ["code review", /\bcode reviews?\b/i], ["Bitbucket", /\bbitbucket\b/i]],
    implies: "repository-based, version-controlled development",
    confirm: "Confirm whether you used Git for commits, branches, pull requests and collaboration; if so, make it explicit.",
    question: "Have you used Git for commits, branches and pull requests?",
    caveat: "Advanced Git operations or repository administration aren't established."
  },
  "mlops": {
    min: 2,
    components: true,
    // This many lifecycle parts shown in real work demonstrate the practice
    // itself (equivalent), even where the word "MLOps" isn't used
    demonstratedAt: 4,
    signals: [["model training", /\btrain\w*\b.{0,40}\bmodels?\b|\bmodels?\b.{0,30}\btrain\w*|\btraining pipelines?\b/i], ["automated retraining", /\bretrain\w*/i], ["model deployment", /\bdeploy\w*\b.{0,40}\bmodels?\b|\bmodels?\b.{0,40}\bdeploy\w*|\bmodel serving\b/i], ["monitoring", /\bmonitor\w*|\bdrift\b/i], ["CI/CD", /\bci\/cd\b/i], ["model management (MLflow, registry, versioning)", /\bmlflow\b|\bmodel registry\b|\bsagemaker\b|\bkubeflow\b|\bmodel versioning\b/i]],
    implies: "parts of the MLOps lifecycle (deployment, monitoring, CI/CD)",
    confirm: "Name the lifecycle parts you owned (registry, serving, monitoring, retraining) so each is explicit.",
    question: "Have you owned parts of the ML lifecycle such as a model registry, serving, monitoring or retraining?",
    caveat: "Model registries, automated retraining and full lifecycle coverage aren't established."
  },
  "linux": {
    signals: [["Docker", /\bdocker\b/i], ["Kubernetes", /\bkubernetes\b|\bk8s\b/i], ["shell scripting", /\bbash\b|\bshell scripts?\b/i], ["EC2", /\bec2\b/i]],
    implies: "working in Linux-based environments",
    confirm: "If you worked on Linux servers or containers directly, say so.",
    question: "Have you worked directly on Linux servers or in Linux containers?",
    caveat: "Linux administration isn't established."
  },
  "agile": {
    confirmOnly: true,
    signals: [["cross-functional work", /\bcross-functional\b/i], ["sprints", /\bsprints?\b/i], ["releases", /\breleases?\b/i], ["stakeholder work", /\bstakeholders?\b/i], ["iterative delivery", /\biterat\w*/i]],
    implies: "team software delivery",
    confirm: "If you worked in Scrum or Kanban teams (sprints, stand-ups, planning), say so.",
    question: "Have you worked in an Agile team (Scrum or Kanban: sprints, stand-ups, planning)?",
    caveat: "Agile methodology itself isn't established."
  }
};
INFERENCES["version control"] = INFERENCES.git;

// Concepts that are worded in many ways, which a name match can't catch.
//   asks   how a job names the concept (also adds it as a term)
//   shows  what a resume bullet says when it demonstrates it; with: a second
//          pattern the same bullet must also match (document work AND AI)
//   whole  matched against the whole resume (publications, open source):
//          an achievement is there or it isn't; no partial credit from a
//          modifier like "ML" in "open-source ML projects"
// Only concrete statements count: "evaluating them with standard metrics",
// "raising accuracy by 23%", "cut inference cost 27%".
const CONCEPTS = {
  "performance optimization": {
    asks: /\b(?:performance|model) optimi[sz]ation\b|\boptimi[sz]ing (?:model )?performance\b/i,
    shows: /\b(?:optimi[sz]\w*|hyperparameter\w*|tun(?:ed|ing) (?:the )?models?|(?:rais|improv|increas|boost)\w* [\w-]+(?: [\w-]+)? (?:accuracy|precision|recall|f1|auc|throughput)|(?:cut|reduc|lower)\w* (?:[\w-]+ ){0,3}(?:latency|inference cost|response times?|answer times?))\b/i
  },
  "document-heavy ai": {
    asks: /\bdocument[- ](?:heavy|intensive|centric)\b|\bdocument (?:ai|intelligence|processing|understanding)\b|\bintelligent document\b/i,
    shows: /\b(?:documents?|document intelligence|knowledge bases?|pdfs?|contracts|forms)\b/i,
    with: /\b(?:rag|llms?|nlp|generative ai|genai|semantic search|assistant|classif\w*|extraction|ocr|transformer\w*)\b/i
  },
  "structured-data ai": {
    asks: /\bstructured[- ]data(?: ai)?(?: applications?)?\b|\btabular (?:data|ml|models?)\b/i,
    shows: /\b(?:sql|tabular|records|structured data|tables)\b/i,
    with: /\b(?:models?|xgboost|scikit-learn|llms?|generat\w* sql|text-to-sql|predict\w*|classif\w*|agentic)\b/i
  },
  "generative ai platforms": {
    asks: /\b(?:generative ai|genai|llm|modern ai) platforms?\b|\bcloud(?:-based)? ai services\b/i,
    shows: /\b(?:amazon bedrock|aws bedrock|azure openai|vertex ai|oci generative ai|watsonx)\b|\bgenerative ai\b.{0,80}\b(?:on|using|via|with) (?:oci|aws|azure|gcp|google cloud)\b/i
  },
  "data preparation": {
    asks: /\bdata prep(?:aration)?\b|\bpreparing (?:datasets|data)\b/i,
    shows: /\b(?:prepar\w* (?:the )?data|data prep\w*|clean\w* (?:the )?data|data (?:cleaning|validation|wrangling)|feature pipelines?|etl|data pipelines?|preprocess\w*)\b/i
  },
  "model lifecycle management": {
    asks: /\b(?:model|ml) lifecycle(?: management)?\b/i,
    shows: /\b(?:model|ml) lifecycle\b|\blifecycle of (?:the )?models?\b|\bmodel registry\b/i
  },
  "model performance analysis": {
    asks: /\b(?:analy[sz]\w*|measur\w*|evaluat\w*) model performance\b|\bstandard metrics\b/i,
    shows: /\b(?:standard metrics|precision|recall|f1|auc|rmse|groundedness|ragas|llm-as-judge|evaluat\w* (?:them|models?|the models?) with)\b/i
  },
  // Building or integrating AI endpoints: calling a model provider's API, or
  // serving a model behind one ("LLM services as FastAPI microservices",
  // "deployed it behind REST APIs"). Using an AI tool isn't an AI API.
  "ai apis": {
    asks: /\b(?:ai|llm|genai|generative ai|model|ml) apis?\b|\bai (?:services|endpoints)\b/i,
    shows: /\b(?:openai|anthropic|claude|gemini|bedrock|azure openai|vertex ai|hugging face|cohere|mistral)\b[^.]{0,60}\bapis?\b|\bapis?\b[^.]{0,60}\b(?:openai|anthropic|claude|gemini|bedrock|llms?)\b|\b(?:llm|model|inference|ai|nlp)[\w -]{0,20}(?:services?|endpoints?)\b[^.]{0,40}\b(?:fastapi|rest|apis?|microservices?)\b|\bdeploy\w*\b[^.]{0,80}\bbehind (?:rest(?:ful)? )?apis?\b|\b(?:tool|function) calling\b/i
  },
  "open-source contributions": {
    asks: /\bcontributions? to open[- ]source\b|\bopen[- ]source (?:\w+ )?(?:contributions?|projects?)\b/i,
    shows: /\bopen[- ]source (?:contribut\w*|maintainer|library|project|package)\b|\bcontribut\w* to [\w.-]+ (?:repo|repository|project|library|framework)\b|\bmaintainer of\b|\bmerged pull requests?\b/i,
    whole: true
  },
  // "Publications or presentations": either kind of activity counts
  "publications": {
    asks: /\bpublications? or presentations?\b|\b(?:publications?|presentations?|published papers?|conference talks?)\b/i,
    shows: /\b(?:published|co-?authored|publications?:|presented (?:at|a|our|my)|speaker at|conference (?:paper|talk)|journal (?:article|paper))\b/i,
    whole: true
  }
};

// Different names for the same requirement, so it's scored once
const CANONICAL = {
  "copilot": "github copilot", "prompt design": "prompt engineering", "large language models": "llms", "llm": "llms",
  "retrieval-augmented generation": "rag", "version control": "git", "ai-enabled development tools": "ai coding tools",
  "ai-enabled dev tools": "ai coding tools", "ai coding harnesses": "ai coding tools", "claude code": "ai coding tools", "github copilot": "ai coding tools"
};

module.exports = { EQUIVALENT, RELATED, PARTIAL, CONCEPTS, CANONICAL, INFERENCES };
