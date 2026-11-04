import axios from "axios";
import { API_URL } from "../staticSite";

const contactApi = axios.create({
  baseURL: `${API_URL}/api/contact`,
  withCredentials: true
});

export const sendContactMessage = (data) =>
  contactApi.post("/", data);

export const subscribeToUpdates = (data) =>
  contactApi.post("/subscribe", data);

export default contactApi;
