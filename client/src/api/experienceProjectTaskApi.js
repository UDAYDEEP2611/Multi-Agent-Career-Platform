import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
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
