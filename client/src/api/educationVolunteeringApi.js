import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/educations",
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
