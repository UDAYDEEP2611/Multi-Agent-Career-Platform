import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
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
