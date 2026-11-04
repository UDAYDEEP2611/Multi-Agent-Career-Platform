import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/achievements`,
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
