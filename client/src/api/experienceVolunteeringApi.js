import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/experiences`,
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
