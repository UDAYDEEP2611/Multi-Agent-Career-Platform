import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/educations`,
  withCredentials: true
});

const path = (educationId) =>
  `/${educationId}/volunteering`;

export const getEducationVolunteering = (educationId) =>
  api.get(path(educationId));

export const createEducationVolunteering = (educationId, data) =>
  api.post(path(educationId), data);

export const updateEducationVolunteering = (
  educationId,
  volunteeringId,
  data
) =>
  api.patch(`${path(educationId)}/${volunteeringId}`, data);

export const deleteEducationVolunteering = (
  educationId,
  volunteeringId
) =>
  api.delete(`${path(educationId)}/${volunteeringId}`);
