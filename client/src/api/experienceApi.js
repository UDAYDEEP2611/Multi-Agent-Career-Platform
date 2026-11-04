import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
  withCredentials: true
});

export const getExperiences = () => api.get("/");

export const getExperience = (id) => api.get(`/${id}`);

export const createExperience = (data) => api.post("/", data);

export const updateExperience = (id, data) =>
  api.patch(`/${id}`, data);

export const deleteExperience = (id) =>
  api.delete(`/${id}`);
