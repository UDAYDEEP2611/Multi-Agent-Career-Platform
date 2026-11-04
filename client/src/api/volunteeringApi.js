import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/volunteering",
  withCredentials: true
});

export const getVolunteering = () =>
  api.get("/");

export const getVolunteeringRole = (volunteeringId) =>
  api.get(`/${volunteeringId}`);

export const createVolunteering = (data) =>
  api.post("/", data);

export const updateVolunteering = (volunteeringId, data) =>
  api.patch(`/${volunteeringId}`, data);

export const deleteVolunteering = (volunteeringId) =>
  api.delete(`/${volunteeringId}`);
