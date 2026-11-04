import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/skill-catalog",
  withCredentials: true
});

export const searchSkillCatalog = (query, signal) =>
  api.get("/search", {
    params: { q: query },
    signal
  });
