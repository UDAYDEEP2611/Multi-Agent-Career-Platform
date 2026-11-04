const mongoose = require("mongoose");
const Project = require("../models/Project");
const SkillAssociation = require("../models/SkillAssociation");
const { PROJECT_TYPES, PROJECT_STATUSES } = require("../models/Project");
const { deleteFile } = require("../storage/fileStorage");
const validUrl = require("../utils/validUrl");

const editableFields = [
  "title",
  "projectType",
  "description",
  "role",
  "startMonth",
  "startYear",
  "ongoing",
  "endMonth",
  "endYear",
  "status",
  "githubUrl",
  "demoUrl",
  "websiteUrl",
  "featured",
  "visibility"
];

const defaults = {
  projectType: "Personal",
  description: "",
  role: "Creator/Developer",
  startMonth: null,
  startYear: null,
  ongoing: false,
  endMonth: null,
  endYear: null,
  status: "Completed",
  githubUrl: "",
  demoUrl: "",
  websiteUrl: "",
  featured: false,
  visibility: "Public"
};

const urlFields = {
  githubUrl: "GitHub URL",
  demoUrl: "Live demo URL",
  websiteUrl: "Project website"
};

const toMonth = (year, month, fallback) => year * 12 + (month || fallback);

// Merges the request onto the existing project (PATCH) or the defaults
// (POST) and validates the result. Returns { data } or { error }.
function validateProject(body, existing = null) {
  for (const key of Object.keys(body)) {
    if (!editableFields.includes(key)) {
      return { error: `Unsupported field: ${key}` };
    }
  }

  const base = existing ? existing.toObject() : defaults;
  const data = {};

  for (const field of editableFields) {
    data[field] = body[field] !== undefined ? body[field] : base[field];
  }

  // No status given: an ongoing project is In Progress, else Completed (also
  // when only ongoing changes)
  if (body.status === undefined && (!existing || body.ongoing !== undefined)) {
    data.status = data.ongoing === true ? "In Progress" : "Completed";
  }

  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.length > 200
  ) {
    return { error: "Project title is required (maximum 200 characters)" };
  }

  if (!PROJECT_TYPES.includes(data.projectType)) {
    return { error: "Invalid project type" };
  }

  if (!PROJECT_STATUSES.includes(data.status)) {
    return { error: "Invalid project status" };
  }

  if (!["Public", "Private"].includes(data.visibility)) {
    return { error: "Visibility must be Public or Private" };
  }

  for (const [field, max] of [["description", 10000], ["role", 150]]) {
    if (typeof data[field] !== "string" || data[field].length > max) {
      return { error: `${field} must be at most ${max} characters` };
    }
  }

  for (const field of ["ongoing", "featured"]) {
    if (typeof data[field] !== "boolean") {
      return { error: `${field} must be true or false` };
    }
  }

  for (const field of ["startMonth", "endMonth"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) || data[field] < 1 || data[field] > 12)
    ) {
      return { error: `Invalid ${field}` };
    }
  }

  for (const field of ["startYear", "endYear"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) || data[field] < 1900 || data[field] > 2100)
    ) {
      return { error: `Invalid ${field}` };
    }
  }

  if (data.startMonth !== null && data.startYear === null) {
    return { error: "Start year is required when start month is selected" };
  }

  // Ongoing projects have no end date
  if (data.ongoing) {
    data.endMonth = null;
    data.endYear = null;
  } else if (data.endMonth !== null && data.endYear === null) {
    return { error: "End year is required when end month is selected" };
  }

  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth() + 1;

  for (const [label, year, month] of [
    ["Start", data.startYear, data.startMonth],
    ["End", data.endYear, data.endMonth]
  ]) {
    if (year !== null && toMonth(year, month, 1) > currentMonth) {
      return { error: `${label} date can't be in the future` };
    }
  }

  if (
    data.startYear !== null &&
    data.endYear !== null &&
    toMonth(data.endYear, data.endMonth, 12) <
      toMonth(data.startYear, data.startMonth, 1)
  ) {
    return { error: "End date cannot be earlier than start date" };
  }

  for (const [field, label] of Object.entries(urlFields)) {
    if (typeof data[field] !== "string") {
      return { error: `Invalid ${label}` };
    }

    data[field] = data[field].trim();

    if (data[field] && !validUrl(data[field])) {
      return { error: `${label} must start with http:// or https://` };
    }
  }

  data.title = data.title.trim();
  data.description = data.description.trim();
  data.role = data.role.trim();

  return { data };
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error("Project error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process project"
  });
}

async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.projectId)) {
    res.status(400).json({ success: false, message: "Invalid project ID" });
    return null;
  }

  const project = await Project.findOne({
    _id: req.params.projectId,
    userId: req.session.userId
  });

  if (!project) {
    res.status(404).json({ success: false, message: "Project not found" });
    return null;
  }

  return project;
}

const endMonths = (project) =>
  project.ongoing
    ? Infinity
    : project.endYear
      ? toMonth(project.endYear, project.endMonth, 12)
      : 0;

const startMonths = (project) =>
  project.startYear ? toMonth(project.startYear, project.startMonth, 1) : 0;

// Featured first, then ongoing / most recently ended, then newest start
const newestFirst = (a, b) =>
  Number(b.featured) - Number(a.featured) ||
  endMonths(b) - endMonths(a) ||
  startMonths(b) - startMonths(a) ||
  b.createdAt - a.createdAt;

// GET /api/projects
exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.session.userId });

    return res.json({
      success: true,
      projects: projects.sort(newestFirst)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/projects/:projectId
exports.getProject = async (req, res) => {
  try {
    const project = await findOwned(req, res);
    if (!project) return;

    return res.json({ success: true, project });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/projects
exports.createProject = async (req, res) => {
  try {
    const result = validateProject(req.body || {});

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const project = await Project.create({
      ...result.data,
      userId: req.session.userId
    });

    return res.status(201).json({ success: true, project });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/projects/:projectId
exports.updateProject = async (req, res) => {
  try {
    const project = await findOwned(req, res);
    if (!project) return;

    const result = validateProject(req.body || {}, project);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    project.set(result.data);
    await project.save();

    return res.json({ success: true, project });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/projects/:projectId
// Removes the project, its skill links and its uploaded files
exports.deleteProject = async (req, res) => {
  try {
    const project = await findOwned(req, res);
    if (!project) return;

    const fileKeys = project.media.map((item) => item.file?.key);

    await project.deleteOne();
    await SkillAssociation.deleteMany({
      userId: req.session.userId,
      sourceType: "project",
      sourceId: project._id
    });

    for (const key of fileKeys) {
      await deleteFile(key);
    }

    return res.json({
      success: true,
      message: "Project deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
