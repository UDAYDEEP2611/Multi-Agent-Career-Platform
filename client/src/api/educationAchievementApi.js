import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api/educations",
  withCredentials: true
});

const path = (educationId) =>
  `/${educationId}/achievements`;

export const getEducationAchievements = (educationId) =>
  api.get(path(educationId));

export const createEducationAchievement = (educationId, data) =>
  api.post(path(educationId), data);

export const updateEducationAchievement = (
  educationId,
  achievementId,
  data
) =>
  api.patch(`${path(educationId)}/${achievementId}`, data);

export const deleteEducationAchievement = (
  educationId,
  achievementId
) =>
  api.delete(`${path(educationId)}/${achievementId}`);

const certificationPath = (educationId) =>
  `/${educationId}/certifications`;

export const getEducationCertifications = (educationId) =>
  api.get(certificationPath(educationId));

export const createEducationCertification = (educationId, data) =>
  api.post(certificationPath(educationId), data);

export const updateEducationCertification = (
  educationId,
  certificationId,
  data
) =>
  api.patch(`${certificationPath(educationId)}/${certificationId}`, data);

export const deleteEducationCertification = (
  educationId,
  certificationId
) =>
  api.delete(`${certificationPath(educationId)}/${certificationId}`);
