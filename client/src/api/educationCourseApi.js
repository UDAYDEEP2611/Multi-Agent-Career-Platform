import axios from "axios";
import { API_URL } from "../staticSite";

const api = axios.create({
  baseURL: `${API_URL}/api/educations`,
  withCredentials: true
});

const path = (educationId) =>
  `/${educationId}/courses`;

export const getEducationCourses = (educationId) =>
  api.get(path(educationId));

export const createEducationCourse = (educationId, data) =>
  api.post(path(educationId), data);

export const updateEducationCourse = (educationId, courseId, data) =>
  api.patch(`${path(educationId)}/${courseId}`, data);

export const deleteEducationCourse = (educationId, courseId) =>
  api.delete(`${path(educationId)}/${courseId}`);
