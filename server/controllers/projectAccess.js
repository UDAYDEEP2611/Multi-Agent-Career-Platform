const mongoose = require("mongoose");
const Experience = require("../models/Experience");
const Education = require("../models/Education");
const Project = require("../models/Project");
const Certification = require("../models/Certification");
const Volunteering = require("../models/Volunteering");
const Achievement = require("../models/Achievement");
const MAX_PROJECT_MEDIA = 30;
const MAX_CERTIFICATION_MEDIA = 50;
const MAX_VOLUNTEERING_MEDIA = 50;
const MAX_ACHIEVEMENT_MEDIA = 50;

// Project routes are mounted under
//   /api/experiences/:experienceId/projects/:projectId/...
//   /api/educations/:educationId/projects/:projectId/...
//   /api/projects/:projectId/...   (standalone project)
//   /api/certifications/:certificationId/media/...
//   /api/volunteering/:volunteeringId/media/...
//   /api/achievements/:activityId/media/...
// ("activityId", because project achievements already use "achievementId")
// so the parent model is chosen from the route params. A standalone
// project, certification, volunteering role or achievement is its own parent.
function parentFor(req) {
  if (req.params.activityId !== undefined) {
    return {
      Model: Achievement,
      id: req.params.activityId,
      label: "Achievement",
      standalone: true,
      maxMedia: MAX_ACHIEVEMENT_MEDIA
    };
  }

  if (req.params.volunteeringId !== undefined) {
    return {
      Model: Volunteering,
      id: req.params.volunteeringId,
      label: "Volunteering",
      standalone: true,
      maxMedia: MAX_VOLUNTEERING_MEDIA
    };
  }

  if (req.params.certificationId !== undefined) {
    return {
      Model: Certification,
      id: req.params.certificationId,
      label: "Certification",
      standalone: true,
      maxMedia: MAX_CERTIFICATION_MEDIA
    };
  }

  if (req.params.educationId !== undefined) {
    return { Model: Education, id: req.params.educationId, label: "Education" };
  }

  if (req.params.experienceId !== undefined) {
    return { Model: Experience, id: req.params.experienceId, label: "Experience" };
  }

  return { Model: Project, id: req.params.projectId, label: "Project", standalone: true };
}

// Loads the logged-in user's parent record (experience, education, or the
// standalone project itself) and the project from the route params. Returns { parent, project },
// or sends a 400/404 and returns null.
exports.findOwnedProject = async (req, res) => {
  const { Model, id, label, standalone } = parentFor(req);
  const projectId = standalone ? id : req.params.projectId;

  if (
    !mongoose.isValidObjectId(id) ||
    !mongoose.isValidObjectId(projectId)
  ) {
    res.status(400).json({
      success: false,
      message: standalone
        ? `Invalid ${label.toLowerCase()} ID`
        : `Invalid ${label.toLowerCase()} or project ID`
    });
    return null;
  }

  const parent = await Model.findOne({
    _id: id,
    userId: req.session.userId
  });

  if (!parent) {
    res.status(404).json({
      success: false,
      message: `${label} not found`
    });
    return null;
  }

  const project = standalone ? parent : parent.projects.id(projectId);

  if (!project) {
    res.status(404).json({
      success: false,
      message: "Project not found"
    });
    return null;
  }

  return { parent, project };
};

// Upload folder for a project's files, e.g. "education-project-media"
exports.projectMediaFolder = (req) => {
  const { label, standalone } = parentFor(req);
  return standalone
    ? `${label.toLowerCase()}-media`
    : `${label.toLowerCase()}-project-media`;
};

// How many media items the record can hold, and what to call it
exports.projectMediaLimit = (req) => {
  const { label, standalone, maxMedia } = parentFor(req);

  return {
    max: maxMedia ?? MAX_PROJECT_MEDIA,
    label: standalone ? label.toLowerCase() : "project"
  };
};

// Finds a child item (task, contributor, ...) of a project by route param
exports.findProjectItem = (project, list, idParam, label, req, res) => {
  if (!mongoose.isValidObjectId(req.params[idParam])) {
    res.status(400).json({
      success: false,
      message: `Invalid ${label.toLowerCase()} ID`
    });
    return null;
  }

  const item = project[list].id(req.params[idParam]);

  if (!item) {
    res.status(404).json({
      success: false,
      message: `${label} not found`
    });
    return null;
  }

  return item;
};
