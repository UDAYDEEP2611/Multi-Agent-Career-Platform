import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/achievements",
  withCredentials: true
});

export const getAchievements = () =>
  api.get("/");

export const getAchievement = (achievementId) =>
  api.get(`/${achievementId}`);

export const createAchievement = (data) =>
  api.post("/", data);

export const updateAchievement = (achievementId, data) =>
  api.patch(`/${achievementId}`, data);

export const deleteAchievement = (achievementId) =>
  api.delete(`/${achievementId}`);
