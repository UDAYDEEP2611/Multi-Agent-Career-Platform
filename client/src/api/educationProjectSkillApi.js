import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/educations`,
  withCredentials: true
});

const path = (educationId, projectId) =>
  `/${educationId}/projects/${projectId}/skills`;

export const getEducationProjectSkills = (educationId, projectId) =>
  api.get(path(educationId, projectId));

export const createEducationProjectSkill = (educationId, projectId, data) =>
  api.post(path(educationId, projectId), data);

export const updateEducationProjectSkill = (
  educationId,
  projectId,
  skillId,
  data
) =>
  api.patch(`${path(educationId, projectId)}/${skillId}`, data);

export const deleteEducationProjectSkill = (
  educationId,
  projectId,
  skillId
) =>
  api.delete(`${path(educationId, projectId)}/${skillId}`);
