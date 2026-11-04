import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/skills`,
  withCredentials: true
});

export const getUserSkills = () =>
  api.get("/");

export const createUserSkill = (data) =>
  api.post("/", data);

export const updateUserSkill = (skillId, data) =>
  api.patch(`/${skillId}`, data);

export const deleteUserSkill = (skillId) =>
  api.delete(`/${skillId}`);

// group: important | technical | soft
export const reorderSkills = (group, skillIds) =>
  api.put("/order", { group, skillIds });

// Before adding: { existing, similar, suggestion, skillType, checkedBy }
export const checkSkillName = (name) =>
  api.post("/check", { name });
