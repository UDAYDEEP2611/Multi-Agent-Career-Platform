import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/experiences`,
  withCredentials: true
});

const taskPath = (experienceId, projectId) =>
  `/${experienceId}/projects/${projectId}/tasks`;

export const getProjectTasks = (experienceId, projectId) =>
  api.get(taskPath(experienceId, projectId));

export const createProjectTask = (
  experienceId,
  projectId,
  data
) =>
  api.post(taskPath(experienceId, projectId), data);

export const updateProjectTask = (
  experienceId,
  projectId,
  taskId,
  data
) =>
  api.patch(
    `${taskPath(experienceId, projectId)}/${taskId}`,
    data
  );

export const deleteProjectTask = (
  experienceId,
  projectId,
  taskId
) =>
  api.delete(
    `${taskPath(experienceId, projectId)}/${taskId}`
  );
