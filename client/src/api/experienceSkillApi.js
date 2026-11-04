import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/experiences`,
  withCredentials: true
});

export const getExperienceSkills = (experienceId) =>
  api.get(`/${experienceId}/skills`);

export const createExperienceSkill = (experienceId, data) =>
  api.post(`/${experienceId}/skills`, data);

export const updateExperienceSkill = (experienceId, skillId, data) =>
  api.patch(`/${experienceId}/skills/${skillId}`, data);

export const deleteExperienceSkill = (experienceId, skillId) =>
  api.delete(`/${experienceId}/skills/${skillId}`);
