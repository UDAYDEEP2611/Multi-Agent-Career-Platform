import axios from "axios";
import { API_URL } from "../staticSite";

const BASE_URL = `${API_URL}/api/resume`;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true
});

// { sources: { contact, summary, experiences, educations, projects, skills },
//   ai: { available, model, message } }
export const getResumeSources = () => api.get("/sources");

// Builds the resume. The server streams events while the agent works:
// onEvent("progress", { message }), then "result" or "error".
// Rejects with { message } when the request itself is refused.
export const generateResume = (body, onEvent, signal) => streamEvents("/generate", body, onEvent, signal);

// Sends the finished resume through the agents again under new instructions.
// body: the build options plus { resume, keywords, requirements, revisionInstructions }
export const reviseResume = (body, onEvent, signal) => streamEvents("/revise", body, onEvent, signal);

async function streamEvents(path, body, onEvent, signal) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw { message: data.message || "Unable to build the resume." };
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

// Rephrases the summary to about targetWords words so it fills its lines
export const fitSummary = (body, signal) => api.post("/summary-fit", body, { signal });

// Compares an uploaded resume (PDF, DOCX, RTF or TXT) with a job description:
// { resume, found, match: { overall, profile, sections, gaps, ... }, notes }
// details: optional { company, jobTitle } typed by the user
export const compareResume = (file, jobDescription, signal, details = {}) => {
  const form = new FormData();
  form.append("jobDescription", jobDescription);
  if (details.company) form.append("company", details.company);
  if (details.jobTitle) form.append("jobTitle", details.jobTitle);
  form.append("file", file);
  return api.post("/compare", form, { signal });
};

// The demo person's resume, as { fileName, text } (GitHub Pages demo only)
export const getDemoResume = () => api.get("/demo-resume");

// { title, company } read from a pasted job description, to fill the form
export const getJobInfo = (jobDescription, signal) => api.post("/job-info", { jobDescription }, { signal });

// The JobPilot log book: comparisons from the last 72 hours
export const listMatchLogs = () => api.get("/match-logs");
export const getMatchLog = (id) => api.get(`/match-logs/${id}`);
// The uploaded file itself, as a Blob, for Preview
export const getMatchLogFile = (id) => api.get(`/match-logs/${id}/file`, { responseType: "blob" });
export const deleteMatchLog = (id) => api.delete(`/match-logs/${id}`);
// Answers about inferred skills ({ git: "yes" | "no" | null }); returns the re-scored result
export const confirmMatchLog = (id, confirmations) => api.post(`/match-logs/${id}/confirm`, { confirmations });

// Re-scores an edited resume against the requirements found when it was built
export const recalculateMatch = (resume, requirements, weights) =>
  api.post("/match", { resume, requirements, weights });
