const { ChatOllama } = require("@langchain/ollama");

// The local Ollama server that writes resume content.
//   OLLAMA_BASE_URL (default http://127.0.0.1:11434)
//   OLLAMA_MODEL    (default mistral)

const baseUrl = () => (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const modelName = () => process.env.OLLAMA_MODEL || "mistral";

// { available, model, installed, message }
async function ollamaStatus() {
  const model = modelName();

  try {
    const response = await fetch(`${baseUrl()}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error(`status ${response.status}`);

    const { models = [] } = await response.json();
    const installed = models.some((entry) => entry.name === model || entry.name === `${model}:latest`);

    return {
      available: installed,
      model,
      message: installed ? "" : `Ollama is running but the "${model}" model isn't installed. Run: ollama pull ${model}`
    };
  } catch {
    return { available: false, model, message: "Ollama isn't running. Start it with: ollama serve" };
  }
}

const parseJson = (text) => {
  const raw = String(text || "");
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
};

// The agent's model: send a system prompt and a JSON payload, get JSON back
function createOllamaLlm() {
  const chat = new ChatOllama({
    model: modelName(),
    baseUrl: baseUrl(),
    format: "json",
    temperature: 0.3
  });

  return {
    model: modelName(),
    async invokeJson(system, payload, signal) {
      const reply = await chat.invoke(
        [["system", system], ["human", JSON.stringify(payload)]],
        { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000) }
      );
      return parseJson(reply.content);
    }
  };
}

module.exports = { ollamaStatus, createOllamaLlm, modelName };
