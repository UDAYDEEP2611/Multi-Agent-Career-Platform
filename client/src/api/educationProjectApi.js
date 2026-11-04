import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/educations`,
  withCredentials: true
});

const path = (educationId) =>
  `/${educationId}/projects`;

export const getEducationProjects = (educationId) =>
  api.get(path(educationId));

export const getEducationProject = (educationId, projectId) =>
  api.get(`${path(educationId)}/${projectId}`);

export const createEducationProject = (educationId, data) =>
  api.post(path(educationId), data);

export const updateEducationProject = (
  educationId,
  projectId,
  data
) =>
  api.patch(`${path(educationId)}/${projectId}`, data);

export const deleteEducationProject = (
  educationId,
  projectId
) =>
  api.delete(`${path(educationId)}/${projectId}`);
