import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
  withCredentials: true
});

const path = (experienceId, projectId) =>
  `/${experienceId}/projects/${projectId}/contributors`;

export const getProjectContributors = (
  experienceId,
  projectId
) =>
  api.get(path(experienceId, projectId));

export const createProjectContributor = (
  experienceId,
  projectId,
  data
) =>
  api.post(path(experienceId, projectId), data);

export const updateProjectContributor = (
  experienceId,
  projectId,
  contributorId,
  data
) =>
  api.patch(
    `${path(experienceId, projectId)}/${contributorId}`,
    data
  );

export const deleteProjectContributor = (
  experienceId,
  projectId,
  contributorId
) =>
  api.delete(
    `${path(experienceId, projectId)}/${contributorId}`
  );
