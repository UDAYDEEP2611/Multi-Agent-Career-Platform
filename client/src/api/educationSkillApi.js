import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/educations`,
  withCredentials: true
});

const skillPath = (educationId) =>
  `/${educationId}/skills`;

export const getEducationSkills = (educationId) =>
  api.get(skillPath(educationId));

export const createEducationSkill = (educationId, data) =>
  api.post(skillPath(educationId), data);

export const updateEducationSkill = (
  educationId,
  skillId,
  data
) =>
  api.patch(
    `${skillPath(educationId)}/${skillId}`,
    data
  );

export const deleteEducationSkill = (
  educationId,
  skillId
) =>
  api.delete(
    `${skillPath(educationId)}/${skillId}`
  );
