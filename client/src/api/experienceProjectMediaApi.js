import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
  withCredentials: true
});

const path = (experienceId, projectId) =>
  `/${experienceId}/projects/${projectId}/media`;

export const getProjectMedia = (experienceId, projectId) =>
  api.get(path(experienceId, projectId));

export const createProjectMediaLink = (
  experienceId,
  projectId,
  data
) =>
  api.post(
    `${path(experienceId, projectId)}/links`,
    data
  );

export const uploadProjectMediaFile = (
  experienceId,
  projectId,
  formData
) =>
  api.post(
    `${path(experienceId, projectId)}/upload`,
    formData
  );

export const updateProjectMedia = (
  experienceId,
  projectId,
  mediaId,
  data
) =>
  api.patch(
    `${path(experienceId, projectId)}/${mediaId}`,
    data
  );

export const deleteProjectMedia = (
  experienceId,
  projectId,
  mediaId
) =>
  api.delete(
    `${path(experienceId, projectId)}/${mediaId}`
  );

// Downloads through Axios so the session cookie is sent and errors can be shown
export const downloadProjectMedia = async (
  experienceId,
  projectId,
  media
) => {
  const response = await api.get(
    `${path(experienceId, projectId)}/${media._id}/download`,
    { responseType: "blob" }
  );

  const blobUrl = URL.createObjectURL(response.data);

  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = media.file?.originalName || "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};
