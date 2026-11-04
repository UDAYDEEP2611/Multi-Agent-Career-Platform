
import axios from "axios";

const profileApi = axios.create({
  baseURL: "http://localhost:5050/api/profile",
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
