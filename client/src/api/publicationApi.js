import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/publications",
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
