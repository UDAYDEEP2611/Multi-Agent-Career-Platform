
import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/summary`,
  withCredentials: true
});

export const getSummary = () => api.get("/");
export const createSummary = (content, origin) =>
  api.post("/", { content, origin });
export const updateSummary = (content, origin) =>
  api.put("/", { content, origin });
export const deleteSummary = () => api.delete("/");

// AI writer: five versions built from the portfolio (can take a minute)
export const generateSummaries = (options) => api.post("/generate", options);
export const reviewSummary = (content) => api.post("/review", { content });
export const restoreSummary = (historyId) => api.post(`/history/${historyId}/restore`);
export const deleteSummaryVersion = (historyId) => api.delete(`/history/${historyId}`);
