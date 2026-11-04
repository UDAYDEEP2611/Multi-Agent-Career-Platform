import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api",
  withCredentials: true
});

// Every function takes the media path of the record that owns the media,
// e.g. "/educations/:id/projects/:id/media", "/projects/:id/media" or
// "/certifications/:id/media" (see mediaPath in EducationProjectMediaSection)

export const getEducationProjectMedia = (mediaPath) =>
  api.get(mediaPath);

export const createEducationProjectMediaLink = (mediaPath, data) =>
  api.post(`${mediaPath}/links`, data);

export const uploadEducationProjectMediaFile = (mediaPath, formData) =>
  api.post(`${mediaPath}/upload`, formData);

export const updateEducationProjectMedia = (mediaPath, mediaId, data) =>
  api.patch(`${mediaPath}/${mediaId}`, data);

export const deleteEducationProjectMedia = (mediaPath, mediaId) =>
  api.delete(`${mediaPath}/${mediaId}`);

// Downloads through Axios so the session cookie is sent and errors can be shown
export const downloadEducationProjectMedia = async (mediaPath, media) => {
  const response = await api.get(
    `${mediaPath}/${media._id}/download`,
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
