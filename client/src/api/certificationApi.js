import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/certifications`,
  withCredentials: true
});

// List items include their linked skills: { ..., skills: [{ name, rating }] }
export const getCertifications = () =>
  api.get("/");

export const getCertification = (certificationId) =>
  api.get(`/${certificationId}`);

export const createCertification = (data) =>
  api.post("/", data);

export const updateCertification = (certificationId, data) =>
  api.patch(`/${certificationId}`, data);

export const deleteCertification = (certificationId) =>
  api.delete(`/${certificationId}`);
