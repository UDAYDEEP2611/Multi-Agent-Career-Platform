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
    ? `/educations/${educationId}/projects/${projectId}/tasks`
    : `/projects/${projectId}/tasks`;

export const getEducationProjectTasks = (
  educationId,
  projectId
) =>
  api.get(path(educationId, projectId));

export const createEducationProjectTask = (
  educationId,
  projectId,
  data
) =>
  api.post(path(educationId, projectId), data);

export const updateEducationProjectTask = (
  educationId,
  projectId,
  taskId,
  data
) =>
  api.patch(
    `${path(educationId, projectId)}/${taskId}`,
    data
  );

export const deleteEducationProjectTask = (
  educationId,
  projectId,
  taskId
) =>
  api.delete(
    `${path(educationId, projectId)}/${taskId}`
  );
