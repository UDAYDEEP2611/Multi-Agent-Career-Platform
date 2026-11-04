import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
  withCredentials: true
});

export const getExperienceProjects = (experienceId) =>
  api.get(`/${experienceId}/projects`);

export const getExperienceProject = (experienceId, projectId) =>
  api.get(`/${experienceId}/projects/${projectId}`);

export const createExperienceProject = (experienceId, data) =>
  api.post(`/${experienceId}/projects`, data);

export const updateExperienceProject = (
  experienceId,
  projectId,
  data
) =>
  api.patch(
    `/${experienceId}/projects/${projectId}`,
    data
  );

export const deleteExperienceProject = (
  experienceId,
  projectId
) =>
  api.delete(
    `/${experienceId}/projects/${projectId}`
  );
