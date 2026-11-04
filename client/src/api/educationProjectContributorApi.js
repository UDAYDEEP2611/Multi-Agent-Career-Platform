import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true
});

// educationId null = a standalone project (/api/projects/:projectId/...),
// which shares these panels with Education projects
const path = (educationId, projectId) =>
  educationId
    ? `/educations/${educationId}/projects/${projectId}/contributors`
    : `/projects/${projectId}/contributors`;

export const getEducationProjectContributors = (educationId, projectId) =>
  api.get(path(educationId, projectId));

export const createEducationProjectContributor = (educationId, projectId, data) =>
  api.post(path(educationId, projectId), data);

export const updateEducationProjectContributor = (
  educationId,
  projectId,
  contributorId,
  data
) =>
  api.patch(`${path(educationId, projectId)}/${contributorId}`, data);

export const deleteEducationProjectContributor = (
  educationId,
  projectId,
  contributorId
) =>
  api.delete(`${path(educationId, projectId)}/${contributorId}`);
