import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/patents`,
  withCredentials: true
});

export const getPatents = () =>
  api.get("/");

export const createPatent = (data) =>
  api.post("/", data);

export const updatePatent = (patentId, data) =>
  api.patch(`/${patentId}`, data);

export const deletePatent = (patentId) =>
  api.delete(`/${patentId}`);
