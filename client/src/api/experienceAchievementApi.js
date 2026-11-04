import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
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
