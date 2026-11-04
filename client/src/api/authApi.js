
import axios from "axios";
import { API_URL } from "../staticSite";

const authApi = axios.create({
  baseURL: `${API_URL}/api/auth`,
  withCredentials: true
});

export const registerUser = (data) =>
  authApi.post("/register", data);

export const loginUser = (data) =>
  authApi.post("/login", data);

// Whether Google sign-in is set up: { clientId } ("" when it isn't)
export const getGoogleConfig = () =>
  authApi.get("/google/config");

// data: { credential, password? }
export const googleSignIn = (data) =>
  authApi.post("/google", data);

export const getCurrentUser = () =>
  authApi.get("/me");

export const logoutUser = () =>
  authApi.post("/logout");

// Signed in: set a new password (other devices are signed out)
export const changePassword = (data) =>
  authApi.post("/change-password", data);

// Forgotten password: an emailed link leads to the reset page
export const requestPasswordReset = (email) =>
  authApi.post("/forgot-password", { email });

export const checkResetToken = (token) =>
  authApi.post("/reset-password/check", { token });

export const resetPassword = (data) =>
  authApi.post("/reset-password", data);

export default authApi;
