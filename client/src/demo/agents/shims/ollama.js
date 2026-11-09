// The demo has no local language model: the agents use their rules and
// trained models, as the full app does when Ollama isn't running
export const modelName = () => "";
export const ollamaStatus = async () => ({ available: false, model: "", message: "The demo runs without a language model." });
export const createOllamaLlm = () => null;
