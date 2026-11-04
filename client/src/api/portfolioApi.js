import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/portfolio`,
  withCredentials: true
});

// { sections: { experience: 3, ... }, completeness: { filled, total, missing } }
export const getPortfolioOverview = () =>
  api.get("/overview");

// The whole portfolio, shaped for the portfolio designs. audience "resume":
// the entries with Show in resume on (otherwise those with Show in portfolio on)
export const getPortfolioShowcase = (audience = "portfolio") =>
  api.get("/showcase", { params: audience === "resume" ? { for: "resume" } : {} });

// The hero summary agent writes a short summary for each design (all of them
// when designIds is left out). The server streams events while it works:
// onEvent("progress", { message }), then "result" or "error".
// Rejects with { message } when the request itself is refused.
export async function generateHeroSummaries(designIds, onEvent, signal) {
  const response = await fetch(`${API_URL}/api/portfolio/hero-summaries/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(designIds ? { designIds } : {}),
    signal
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw { message: data.message || "Unable to write your summaries." };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop();

    for (const block of blocks) {
      const event = block.match(/^event: (.*)$/m)?.[1];
      const data = block.match(/^data: (.*)$/m)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}

// Your own wording for one design's hero summary: { heroSummaries }
export const saveHeroSummary = (designId, text) =>
  api.put(`/hero-summaries/${designId}`, { text });

// Back to the opening of your About me; all designs when designId is left out
export const deleteHeroSummary = (designId) =>
  api.delete(designId ? `/hero-summaries/${designId}` : "/hero-summaries");
