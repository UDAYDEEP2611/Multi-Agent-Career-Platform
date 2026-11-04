import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/educations",
  withCredentials: true
});

const taskPath = (educationId) =>
  `/${educationId}/tasks`;

export const getEducationTasks = (educationId) =>
  api.get(taskPath(educationId));

export const createEducationTask = (educationId, data) =>
  api.post(taskPath(educationId), data);

export const updateEducationTask = (
  educationId,
  taskId,
  data
) =>
  api.patch(
    `${taskPath(educationId)}/${taskId}`,
    data
  );

export const deleteEducationTask = (
  educationId,
  taskId
) =>
  api.delete(
    `${taskPath(educationId)}/${taskId}`
  );
