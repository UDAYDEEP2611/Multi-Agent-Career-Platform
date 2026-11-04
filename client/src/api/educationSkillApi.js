import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/educations",
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
