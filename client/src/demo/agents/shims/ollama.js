// The demo's language model: the AI proxy (ai-proxy/, on Workers AI) when the
// build names one in VITE_AI_PROXY_URL. Without it, or when it can't be
// reached, the agents use their rules and trained models, as the full app
// does when Ollama isn't running.
const PROXY = (import.meta.env.VITE_AI_PROXY_URL || "").replace(/\/$/, "");
const OFF = { available: false, model: "", message: "The demo runs the agents on their rules and trained models, without a language model." };

let status = null;
let checkedAt = 0;

export const modelName = () => status?.model || "";

// { available, model, message }, checked at most once a minute
export async function ollamaStatus() {
  if (!PROXY) return OFF;
  if (status && Date.now() - checkedAt < 60000) return status;
  try {
    const response = await fetch(`${PROXY}/status`, { signal: AbortSignal.timeout(4000) });
    const body = await response.json();
    status = response.ok && body.available ? { available: true, model: body.model, message: "" } : OFF;
  } catch {
    status = OFF;
  }
  checkedAt = Date.now();
  return status;
}

// The agents' model: send a system prompt and a JSON payload, get JSON back
export function createOllamaLlm() {
  if (!PROXY) return null;
  return {
    model: modelName(),
    async invokeJson(system, payload, signal) {
      const timeout = AbortSignal.timeout(60000);
      const response = await fetch(`${PROXY}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, payload }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Over the limit or down: the rules answer until the next check
        if (response.status === 429 || response.status >= 500) checkedAt = 0;
        throw new Error(body.error || `AI proxy status ${response.status}`);
      }
      return body.reply;
    }
  };
}
