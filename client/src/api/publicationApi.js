import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/publications`,
  withCredentials: true
});

export const getPublications = () =>
  api.get("/");

export const createPublication = (data) =>
  api.post("/", data);

export const updatePublication = (publicationId, data) =>
  api.patch(`/${publicationId}`, data);

export const deletePublication = (publicationId) =>
  api.delete(`/${publicationId}`);
