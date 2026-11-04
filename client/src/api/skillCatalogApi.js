import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/skill-catalog`,
  withCredentials: true
});

export const searchSkillCatalog = (query, signal) =>
  api.get("/search", {
    params: { q: query },
    signal
  });
