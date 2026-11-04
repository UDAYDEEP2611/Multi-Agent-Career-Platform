import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/admin",
  withCredentials: true
});

export const getAdminUsers = () =>
  api.get("/users");

// data: { role?: "user" | "admin", isDisabled?: boolean }
export const updateAdminUser = (userId, data) =>
  api.patch(`/users/${userId}`, data);

export const getAdminStorage = () =>
  api.get("/storage");

export const getAdminOverview = () =>
  api.get("/overview");

export const deleteAdminUser = (userId, confirm) =>
  api.delete(`/users/${userId}`, { data: { confirm } });

export const signOutAdminUser = (userId) =>
  api.post(`/users/${userId}/sign-out`);

export const getAdminSessions = () =>
  api.get("/sessions");

export const endAdminSession = (handle) =>
  api.delete(`/sessions/${handle}`);

export const cleanExpiredSessions = () =>
  api.post("/sessions/clean-expired");

export const getAdminDatabases = () =>
  api.get("/databases");

export const deleteOrphanedDatabase = (userId, confirm) =>
  api.delete(`/databases/${userId}`, { data: { confirm } });

export const getAdminSystem = () =>
  api.get("/system");

export const clearAdminCache = () =>
  api.post("/system/clear-cache");

export const getAdminAudit = (limit = 200) =>
  api.get("/audit", { params: { limit } });
