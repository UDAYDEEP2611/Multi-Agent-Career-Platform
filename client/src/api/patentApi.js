import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/patents",
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
