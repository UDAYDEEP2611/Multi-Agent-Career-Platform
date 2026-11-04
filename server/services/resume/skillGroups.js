// Sorts technical skills into the categories a resume's TECHNICAL SKILLS
// section lists them under, e.g.
//   • Languages & Engineering: Python, SQL, FastAPI, REST APIs
//   • Generative AI & Agentic AI: LLMs, LangGraph, MCP
// Rules are checked in order and the first match wins, so specific groups
// (RAG, MLOps) come before broad ones (Machine Learning, Cloud & Data).
// Skills that match nothing go under "Tools & Platforms".

const GROUPS = [
  {
    // App frameworks, before Cloud & Data takes "Databricks Apps"
    label: "Languages & Engineering",
    match: /(streamlit|gradio|plotly dash|^dash$|shiny|databricks apps)/
  },
  {
    // Before MLOps, which would otherwise take "Model Evaluation"
    label: "Machine Learning",
    match: /model (training|deployment|evaluation)/
  },
  {
    label: "RAG & Vector Search",
    match: /(\brag\b|retrieval|vector|embedding|semantic search|hybrid search|semantic caching|rerank|graphrag|neo4j|pgvector|pinecone|weaviate|chroma|milvus|qdrant|faiss|knowledge graph|elasticsearch|opensearch)/
  },
  {
    label: "MLOps, LLMOps, Evaluation & Responsible AI",
    match: /(mlops|llmops|mlflow|kubeflow|model serving|model monitoring|drift|opentelemetry|ragas|langsmith|langfuse|arize|phoenix|llm.as.(a.)?judge|evaluation|observability|guardrail|prompt.injection|pii|responsible ai|ai safety|weights (&|and) biases)/
  },
  {
    // Cloud vendors' AI services sit with their cloud
    label: "Cloud & Data",
    match: /(sagemaker|bedrock|azure openai|azure machine learning|vertex ai|oci generative)/
  },
  {
    label: "Generative AI & Agentic AI",
    match: /(\bllms?\b|large language|generative|\bgenai\b|\bgpt|openai|claude|anthropic|gemini|llama|mistral|ollama|prompt|context engineering|agent|langchain|langgraph|llamaindex|crewai|autogen|semantic kernel|haystack|dspy|\bmcp\b|model context protocol|\ba2a\b|function.calling|tool.(calling|use)|structured outputs|fine.tun|\blora\b|qlora|rlhf|vllm|diffusion|human.in.the.loop|model routing)/
  },
  {
    label: "Machine Learning",
    match: /(machine learning|deep learning|pytorch|tensorflow|keras|\bjax\b|scikit|sklearn|xgboost|lightgbm|catboost|transformers|\bbert\b|spacy|nltk|\bnlp\b|natural language|computer vision|opencv|feature engineering|reinforcement learning|recommendation|time series|forecasting|statistic|a\/b testing|data science|pandas|numpy|polars|onnx|whisper|speech recognition|jupyter)/
  },
  {
    label: "Cloud & Data",
    match: /(\baws\b|amazon|azure|\bgcp\b|google cloud|google kubernetes|\boci\b|oracle cloud|cloud|docker|kubernetes|\bk8s\b|terraform|helm|ansible|pulumi|cloudformation|serverless|lambda|\bs3\b|\bec2\b|\becs\b|\beks\b|glue|data pipeline|\betl\b|\belt\b|spark|kafka|airflow|\bdbt\b|snowflake|databricks|bigquery|redshift|synapse|delta lake|iceberg|hive|flink|trino|presto|duckdb|hadoop|big data|postgres|mysql|mongodb|redis|sqlite|oracle database|sql server|mariadb|dynamodb|cassandra|cosmos|firebase|supabase|nosql|database|data (warehous|lake|model|engineering|governance|quality|integration|architecture|migration|lineage|analysis|visualization)|power bi|tableau|looker|excel|fivetran|airbyte|great expectations|vercel|netlify|heroku|cloudflare|jenkins|github actions|gitlab ci|circleci|argo|prometheus|grafana|datadog|splunk|elk stack|new relic|devops|infrastructure|site reliability|virtualization|linux|unix|load balancing|caching|message queue|rabbitmq|event streaming|web scraping)/
  },
  {
    label: "Security & Compliance",
    match: /(secur|encryption|cryptograph|oauth|\bjwt\b|\bsaml\b|owasp|soc 2|hipaa|gdpr|iso 27001|\bnist\b|zero trust|\biam\b|identity|penetration|vulnerab|threat|firewall|\bvpns?\b|siem|incident response|forensic|complian|privacy|\brbac\b|authentication|authorization|secrets|password)/
  },
  {
    label: "Languages & Engineering",
    match: /(python|\bjava\b|javascript|typescript|\bsql\b|c\+\+|c#|^go$|golang|rust|kotlin|swift|php|ruby|scala|^r$|dart|bash|shell|powershell|matlab|julia|perl|objective-c|solidity|html|css|sass|react|next\.js|vue|angular|svelte|redux|tailwind|bootstrap|node|express|fastapi|flask|django|spring|nestjs|\.net|rails|laravel|graphql|grpc|rest|\bapis?\b|websocket|socket\.io|microservice|system design|distributed|\bgit\b|github|gitlab|bitbucket|version control|ci\/cd|continuous|test|jest|pytest|cypress|playwright|selenium|junit|postman|mocha|agile|scrum|kanban|object.oriented|design pattern|algorithm|data structure|pydantic|sqlalchemy|prisma|mongoose|celery|nginx|vite|webpack|flutter|jquery|three\.js|d3|backend|frontend|full stack|web development|software|programming|scripting|debugging|code|architect|event.driven|json|ajax|asynchronous|dependency|orm|mvc|ui development|responsive design|streamlit|gradio|plotly dash|^dash$|shiny|databricks apps)/
  }
];

const FALLBACK = "Tools & Platforms";
const ORDER = [
  "Languages & Engineering",
  "Machine Learning",
  "Generative AI & Agentic AI",
  "RAG & Vector Search",
  "MLOps, LLMOps, Evaluation & Responsible AI",
  "Cloud & Data",
  "Security & Compliance",
  FALLBACK
];

function groupFor(name) {
  const lower = name.toLowerCase().trim();
  return GROUPS.find((group) => group.match.test(lower))?.label || FALLBACK;
}

// technical: names in priority order; soft: names
// Returns [{ label, skills: [names] }] in the order above, empty groups
// left out, soft skills last as "Professional Skills"
function groupSkills(technical, soft = []) {
  const byLabel = new Map(ORDER.map((label) => [label, []]));
  technical.forEach((name) => byLabel.get(groupFor(name)).push(name));

  const groups = ORDER
    .map((label) => ({ label, skills: byLabel.get(label) }))
    .filter((group) => group.skills.length);

  if (soft.length) groups.push({ label: "Professional Skills", skills: soft });
  return groups;
}

module.exports = { groupSkills, groupFor };
