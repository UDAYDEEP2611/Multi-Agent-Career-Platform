import axios from "axios";

const contactApi = axios.create({
  baseURL: "http://localhost:5050/api/contact",
  withCredentials: true
});

export const sendContactMessage = (data) =>
  contactApi.post("/", data);

export const subscribeToUpdates = (data) =>
  contactApi.post("/subscribe", data);

export default contactApi;
