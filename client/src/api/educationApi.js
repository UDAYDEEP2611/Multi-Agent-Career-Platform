import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/educations",
  withCredentials: true
});

export const getEducations = () =>
  api.get("/");

export const getEducation = (educationId) =>
  api.get(`/${educationId}`);

export const createEducation = (data) =>
  api.post("/", data);

export const updateEducation = (educationId, data) =>
  api.patch(`/${educationId}`, data);

export const deleteEducation = (educationId) =>
  api.delete(`/${educationId}`);
