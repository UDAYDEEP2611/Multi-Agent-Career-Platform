const SkillAssociation = require("../models/SkillAssociation");
const mongoose = require("mongoose");
const Experience = require("../models/Experience");
const { deleteFile } = require("../storage/fileStorage");

const {
  pick,
  validate,
  validateWithinParent
} = require("../utils/projectValidation");

// Projects are stored in the Experience document's `projects` array.
const validateWithinExperience = (data, experience) =>
  validateWithinParent(
    data,
    { ...experience.toObject(), ongoing: experience.currentlyWorking },
    "job"
  );

async function findOwnedExperience(req, res) {
  if (!mongoose.isValidObjectId(req.params.experienceId)) {
    res.status(400).json({
      success: false,
      message: "Invalid experience ID"
    });
    return null;
  }

  const experience = await Experience.findOne({
    _id: req.params.experienceId,
    userId: req.session.userId
  });

  if (!experience) {
    res.status(404).json({
      success: false,
      message: "Experience not found"
    });
    return null;
  }

  return experience;
}

function findProject(experience, req, res) {
  if (!mongoose.isValidObjectId(req.params.projectId)) {
    res.status(400).json({
      success: false,
      message: "Invalid project ID"
    });
    return null;
  }

  const project = experience.projects.id(req.params.projectId);

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

  console.error(error);

  return res.status(500).json({
    success: false,
    message: "Unable to process project"
  });
}

exports.getProjects = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const projects = [...experience.projects].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return res.json({ success: true, projects });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getProject = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const project = findProject(experience, req, res);
    if (!project) return;

    return res.json({ success: true, project });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createProject = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const data = {
      title: "",
      description: "",
      startMonth: null,
      startYear: null,
      endMonth: null,
      endYear: null,
      status: "In Progress",
      ...pick(req.body || {})
    };

    const error =
      validate(data) || validateWithinExperience(data, experience);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    experience.projects.push({
      ...data,
      title: data.title.trim(),
      description: data.description.trim()
    });
    await experience.save();

    const project = experience.projects[experience.projects.length - 1];

    return res.status(201).json({
      success: true,
      project
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateProject = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const project = findProject(experience, req, res);
    if (!project) return;

    const data = {
      ...pick(project.toObject()),
      ...pick(req.body || {})
    };

    const error =
      validate(data) || validateWithinExperience(data, experience);

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
    await experience.save();

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
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const project = findProject(experience, req, res);
    if (!project) return;

    const fileKeys = project.media.map((item) => item.file?.key);

    project.deleteOne();
    await experience.save();
    await SkillAssociation.deleteMany({
      userId: req.session.userId,
      sourceType: "experience_project",
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
