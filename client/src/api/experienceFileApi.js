import axios from "axios";

// One attached picture/PDF per item in these sections:
// "media", "achievements", "volunteering", "records"
const api = axios.create({
  baseURL: "http://localhost:5050/api/experiences",
  withCredentials: true
});

export const uploadItemFile = (experienceId, section, itemId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post(`/${experienceId}/${section}/${itemId}/file`, formData);
};

export const deleteItemFile = (experienceId, section, itemId) =>
  api.delete(`/${experienceId}/${section}/${itemId}/file`);

// Used directly in links; the session cookie authorizes it
export const itemFileUrl = (experienceId, section, item) =>
  `${api.defaults.baseURL}/${experienceId}/${section}/${item._id}/file?v=${encodeURIComponent(item.updatedAt || "")}`;
