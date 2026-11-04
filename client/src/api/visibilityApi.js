import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/visibility`,
  withCredentials: true
});

// section: experience, education, projects, certifications, achievements,
// volunteering, publications, patents, interests, recommendations or skills
// flags: { showInPortfolio?, showInResume? }
export const updateVisibility = (section, id, flags) =>
  api.patch(`/${section}/${id}`, flags);
