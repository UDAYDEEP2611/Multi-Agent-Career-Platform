import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/experiences`,
  withCredentials: true
});

export const getExperiences = () => api.get("/");

export const getExperience = (id) => api.get(`/${id}`);

export const createExperience = (data) => api.post("/", data);

export const updateExperience = (id, data) =>
  api.patch(`/${id}`, data);

export const deleteExperience = (id) =>
  api.delete(`/${id}`);
