import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
  withCredentials: true
});

export const getExperienceVolunteering = (experienceId) =>
  api.get(`/${experienceId}/volunteering`);

export const createExperienceVolunteering = (experienceId, data) =>
  api.post(`/${experienceId}/volunteering`, data);

export const updateExperienceVolunteering = (
  experienceId,
  volunteeringId,
  data
) =>
  api.patch(
    `/${experienceId}/volunteering/${volunteeringId}`,
    data
  );

export const deleteExperienceVolunteering = (
  experienceId,
  volunteeringId
) =>
  api.delete(
    `/${experienceId}/volunteering/${volunteeringId}`
  );
