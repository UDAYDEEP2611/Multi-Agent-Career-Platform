import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/experiences`,
  withCredentials: true
});

export const getExperienceMedia = (experienceId) =>
  api.get(`/${experienceId}/media`);

export const createExperienceMedia = (experienceId, data) =>
  api.post(`/${experienceId}/media`, data);

export const updateExperienceMedia = (experienceId, mediaId, data) =>
  api.patch(`/${experienceId}/media/${mediaId}`, data);

export const deleteExperienceMedia = (experienceId, mediaId) =>
  api.delete(`/${experienceId}/media/${mediaId}`);

export const uploadExperienceMediaFile = (experienceId, mediaId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post(`/${experienceId}/media/${mediaId}/file`, formData);
};

export const deleteExperienceMediaFile = (experienceId, mediaId) =>
  api.delete(`/${experienceId}/media/${mediaId}/file`);

// Used directly in <img src> and links; the session cookie authorizes it
export const experienceMediaFileUrl = (experienceId, media) =>
  `${api.defaults.baseURL}/${experienceId}/media/${media._id}/file?v=${encodeURIComponent(media.updatedAt || "")}`;
