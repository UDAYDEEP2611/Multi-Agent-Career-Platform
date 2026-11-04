import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/experiences`,
  withCredentials: true
});

export const getExperienceRecords = (experienceId) =>
  api.get(`/${experienceId}/records`);

export const createExperienceRecord = (experienceId, data) =>
  api.post(`/${experienceId}/records`, data);

export const updateExperienceRecord = (
  experienceId,
  recordId,
  data
) =>
  api.patch(`/${experienceId}/records/${recordId}`, data);

export const deleteExperienceRecord = (
  experienceId,
  recordId
) =>
  api.delete(`/${experienceId}/records/${recordId}`);
