import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/recommendations`,
  withCredentials: true
});

export const getRecommendations = () =>
  api.get("/");

export const createRecommendation = (data) =>
  api.post("/", data);

export const updateRecommendation = (recommendationId, data) =>
  api.patch(`/${recommendationId}`, data);

export const deleteRecommendation = (recommendationId) =>
  api.delete(`/${recommendationId}`);
