import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/interests`,
  withCredentials: true
});

export const getInterests = () =>
  api.get("/");

export const createInterest = (data) =>
  api.post("/", data);

export const updateInterest = (interestId, data) =>
  api.patch(`/${interestId}`, data);

export const deleteInterest = (interestId) =>
  api.delete(`/${interestId}`);
