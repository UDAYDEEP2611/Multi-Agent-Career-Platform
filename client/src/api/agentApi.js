import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api",
  withCredentials: true
});

// ---- Assistant chat --------------------------------------------------------

// { messages, pending, ai: { available, model, message } }
export const getChat = () => api.get("/chat");

// mode: "auto" (the supervisor picks) or "entry", "design", "qa".
// { messages: [user, assistant], pending, changed: { buffer, designs, designId } }
export const sendChatMessage = (text, mode, context) =>
  api.post("/chat/message", { text, mode, context });

export const clearChat = () => api.delete("/chat");

// "Not what I meant": agent is "entry", "design" or "qa". The message runs
// again with that agent, and the user's intent model learns from it.
export const sendChatFeedback = (messageId, agent, context) =>
  api.post("/chat/feedback", { messageId, agent, context });

// ---- Buffer zone -----------------------------------------------------------

// { drafts: [{ id, section, summary, data, fields, notes, error, ... }] }
export const getDrafts = (section) => api.get("/drafts", { params: section ? { section } : {} });
export const updateDraft = (id, data) => api.patch(`/drafts/${id}`, { data });
export const confirmDraft = (id) => api.post(`/drafts/${id}/confirm`);
export const discardDraft = (id) => api.delete(`/drafts/${id}`);

// ---- Custom designs --------------------------------------------------------

export const getCustomDesigns = () => api.get("/custom-designs");
export const getCustomDesign = (id) => api.get(`/custom-designs/${id}`);
export const deleteCustomDesign = (id) => api.delete(`/custom-designs/${id}`);

// ---- Telling the open pages what the agents changed ------------------------

export const AGENT_EVENTS = {
  buffer: "uuv:buffer-changed",
  designs: "uuv:designs-changed",
  // An entry was switched on or off for the portfolio or resumes
  portfolio: "uuv:portfolio-changed"
};

export const announce = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

// ---- Resume settings -------------------------------------------------------

// { settings: { limits: { experience, education, projects, certifications } (0 = all), extras, allSkills } }
export const getResumeSettings = () => api.get("/resume-settings");
export const updateResumeSettings = (changes) => api.patch("/resume-settings", changes);

// The AI chat on one designed resume: { reply, steps, changed, settings, ai }
export const sendResumeChat = (designId, message, layout, sideWidth) => api.post(`/resume-chat/${designId}`, { message, layout, sideWidth });
// Whether the language model is running: { ai: { available, model } }
export const getResumeChatStatus = () => api.get("/resume-chat/status");
