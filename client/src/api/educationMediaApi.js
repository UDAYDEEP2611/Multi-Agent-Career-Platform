import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/educations",
  withCredentials: true
});

const path = (educationId) =>
  `/${educationId}/media`;

export const getEducationMedia = (educationId) =>
  api.get(path(educationId));

export const createEducationMedia = (educationId, data) =>
  api.post(path(educationId), data);

export const updateEducationMedia = (
  educationId,
  mediaId,
  data
) =>
  api.patch(`${path(educationId)}/${mediaId}`, data);

export const deleteEducationMedia = (
  educationId,
  mediaId
) =>
  api.delete(`${path(educationId)}/${mediaId}`);

export const uploadEducationMediaFile = (educationId, mediaId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post(`${path(educationId)}/${mediaId}/file`, formData);
};

export const deleteEducationMediaFile = (educationId, mediaId) =>
  api.delete(`${path(educationId)}/${mediaId}/file`);

// Used directly in links; the session cookie authorizes it
export const educationMediaFileUrl = (educationId, media) =>
  `${api.defaults.baseURL}${path(educationId)}/${media._id}/file?v=${encodeURIComponent(media.updatedAt || "")}`;
