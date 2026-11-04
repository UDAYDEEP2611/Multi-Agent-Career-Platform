import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/experiences`,
  withCredentials: true
});

export const getExperienceAchievements = (experienceId) =>
  api.get(`/${experienceId}/achievements`);

export const createExperienceAchievement = (experienceId, data) =>
  api.post(`/${experienceId}/achievements`, data);

export const updateExperienceAchievement = (
  experienceId,
  achievementId,
  data
) =>
  api.patch(
    `/${experienceId}/achievements/${achievementId}`,
    data
  );

export const deleteExperienceAchievement = (
  experienceId,
  achievementId
) =>
  api.delete(
    `/${experienceId}/achievements/${achievementId}`
  );
