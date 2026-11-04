import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/educations`,
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
