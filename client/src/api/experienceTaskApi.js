import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/experiences`,
  withCredentials: true
});

export const getExperienceTasks = (experienceId) =>
  api.get(`/${experienceId}/tasks`);

export const createExperienceTask = (experienceId, description) =>
  api.post(`/${experienceId}/tasks`, { description });

export const updateExperienceTask = (experienceId, taskId, description) =>
  api.patch(`/${experienceId}/tasks/${taskId}`, { description });

export const deleteExperienceTask = (experienceId, taskId) =>
  api.delete(`/${experienceId}/tasks/${taskId}`);
