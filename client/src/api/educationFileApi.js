import axios from "axios";
import { API_URL } from "../staticSite";

// One attached picture/PDF per item in these Education sections:
// "achievements", "certifications", "volunteering"
const api = axios.create({
  baseURL: `${API_URL}/api/educations`,
  withCredentials: true
});

export const uploadEducationItemFile = (educationId, section, itemId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post(`/${educationId}/${section}/${itemId}/file`, formData);
};

export const deleteEducationItemFile = (educationId, section, itemId) =>
  api.delete(`/${educationId}/${section}/${itemId}/file`);

// Used directly in links; the session cookie authorizes it
export const educationItemFileUrl = (educationId, section, item) =>
  `${api.defaults.baseURL}/${educationId}/${section}/${item._id}/file?v=${encodeURIComponent(item.updatedAt || "")}`;
