import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/projects",
  withCredentials: true
});

export const getProjects = () =>
  api.get("/");

export const getProject = (projectId) =>
  api.get(`/${projectId}`);

export const createProject = (data) =>
  api.post("/", data);

export const updateProject = (projectId, data) =>
  api.patch(`/${projectId}`, data);

export const deleteProject = (projectId) =>
  api.delete(`/${projectId}`);

// Achievements and Links: lists inside a project
// section: "achievements" | "links"
export const getProjectSection = (projectId, section) =>
  api.get(`/${projectId}/${section}`);

export const createProjectSectionItem = (projectId, section, data) =>
  api.post(`/${projectId}/${section}`, data);

export const updateProjectSectionItem = (projectId, section, itemId, data) =>
  api.patch(`/${projectId}/${section}/${itemId}`, data);

export const deleteProjectSectionItem = (projectId, section, itemId) =>
  api.delete(`/${projectId}/${section}/${itemId}`);
