import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/recommendations",
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
