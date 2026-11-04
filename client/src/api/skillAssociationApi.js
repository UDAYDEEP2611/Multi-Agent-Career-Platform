import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/skill-associations`,
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
