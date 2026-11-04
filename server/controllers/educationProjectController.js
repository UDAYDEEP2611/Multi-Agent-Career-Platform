const SkillAssociation = require("../models/SkillAssociation");
const mongoose = require("mongoose");
const { findOwnedEducation } = require("./educationController");
const { deleteFile } = require("../storage/fileStorage");
const {
  pick,
  validate,
  validateWithinParent
} = require("../utils/projectValidation");

// Projects are stored in the Education document's `projects` array, using
// the same structure as Experience projects.
const validateWithinEducation = (data, education) =>
  validateWithinParent(
    data,
    { ...education.toObject(), ongoing: education.currentlyStudying },
    "education"
  );

function findProject(education, req, res) {
  if (!mongoose.isValidObjectId(req.params.projectId)) {
    res.status(400).json({
      success: false,
      message: "Invalid project ID"
    });
    return null;
  }

  const project = education.projects.id(req.params.projectId);

  if (!project) {
    res.status(404).json({
      success: false,
      message: "Project not found"
    });
    return null;
  }

  return project;
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error("Education Project error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process education project"
  });
}

exports.getProjects = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const projects = [...education.projects].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return res.json({
      success: true,
      projects
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getProject = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const project = findProject(education, req, res);
    if (!project) return;

    return res.json({
      success: true,
      project
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createProject = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const data = {
      title: "",
      description: "",
      startMonth: null,
      startYear: null,
      endMonth: null,
      endYear: null,
      status: "Planned",
      ...pick(req.body || {})
    };

    const error =
      validate(data) || validateWithinEducation(data, education);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    education.projects.push({
      ...data,
      title: data.title.trim(),
      description: data.description.trim()
    });
    await education.save();

    return res.status(201).json({
      success: true,
      project: education.projects[education.projects.length - 1]
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateProject = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const project = findProject(education, req, res);
    if (!project) return;

    const data = {
      ...pick(project.toObject()),
      ...pick(req.body || {})
    };

    const error =
      validate(data) || validateWithinEducation(data, education);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    project.set({
      ...data,
      title: data.title.trim(),
      description: data.description.trim()
    });
    await education.save();

    return res.json({
      success: true,
      project
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const project = findProject(education, req, res);
    if (!project) return;

    const fileKeys = project.media.map((item) => item.file?.key);

    project.deleteOne();
    await education.save();
    await SkillAssociation.deleteMany({
      userId: req.session.userId,
      sourceType: "education_project",
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
