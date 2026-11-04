
import axios from "axios";
import { API_URL } from "../staticSite";

const profileApi = axios.create({
  baseURL: `${API_URL}/api/profile`,
  withCredentials: true
});

export const getProfile = () => profileApi.get("/");

export const createProfile = (contact) =>
  profileApi.post("/", { contact });

export const updateContact = (contact) =>
  profileApi.patch("/contact", contact);

export const updatePersonal = (personal) =>
  profileApi.patch("/personal", personal);

export const deleteProfile = () =>
  profileApi.delete("/");

export const updateRoleDetails = (roleDetails) =>
  profileApi.patch("/roles", roleDetails);
