import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/interests",
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
