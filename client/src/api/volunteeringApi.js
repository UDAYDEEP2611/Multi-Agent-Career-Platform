import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/volunteering`,
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
