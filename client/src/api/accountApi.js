import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/account",
  withCredentials: true
});

// The activity log is locked until unlock() succeeds; locked calls fail
// with status 423
export const getLockStatus = () => api.get("/lock");
export const unlockActivity = (password) => api.post("/unlock", { password });
export const unlockActivityWithGoogle = (credential) => api.post("/unlock", { credential });
export const lockActivity = () => api.post("/lock");

// kind: "data" (changes) or "auth" (sign-ins)
export const getActivity = (kind) => api.get("/activity", { params: { kind, limit: 300 } });
export const getMySessions = () => api.get("/sessions");
export const signOutOtherSessions = () => api.post("/sessions/sign-out-others");
export const getMyStorage = () => api.get("/storage");
