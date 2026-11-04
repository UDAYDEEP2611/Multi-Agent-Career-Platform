import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/skill-associations",
  withCredentials: true
});

export const getSkillAssociations = (skillId) =>
  api.get(`/skill/${skillId}`);

export const getSourceSkills = (sourceType, sourceId) =>
  api.get(`/source/${sourceType}/${sourceId}`);

export const createSkillAssociation = (data) =>
  api.post("/", data);

export const deleteSkillAssociation = (associationId) =>
  api.delete(`/${associationId}`);
