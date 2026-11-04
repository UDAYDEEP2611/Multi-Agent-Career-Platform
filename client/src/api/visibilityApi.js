import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/visibility",
  withCredentials: true
});

// section: experience, education, projects, certifications, achievements,
// volunteering, publications, patents, interests, recommendations or skills
// flags: { showInPortfolio?, showInResume? }
export const updateVisibility = (section, id, flags) =>
  api.patch(`/${section}/${id}`, flags);
