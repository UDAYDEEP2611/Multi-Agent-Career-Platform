import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
  withCredentials: true
});

const path = (experienceId, projectId) =>
  `/${experienceId}/projects/${projectId}/skills`;

export const getProjectSkills = (
  experienceId,
  projectId
) =>
  api.get(path(experienceId, projectId));

export const createProjectSkill = (
  experienceId,
  projectId,
  data
) =>
  api.post(path(experienceId, projectId), data);

export const updateProjectSkill = (
  experienceId,
  projectId,
  skillId,
  data
) =>
  api.patch(
    `${path(experienceId, projectId)}/${skillId}`,
    data
  );

export const deleteProjectSkill = (
  experienceId,
  projectId,
  skillId
) =>
  api.delete(
    `${path(experienceId, projectId)}/${skillId}`
  );
