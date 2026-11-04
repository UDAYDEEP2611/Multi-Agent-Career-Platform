const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const Experience = require("../models/Experience");
const { deleteFile } = require("../storage/fileStorage");

// Achievements are stored in the Experience document's `achievements` array.
const types = [
  "Achievement",
  "Award",
  "Recognition",
  "Milestone",
  "Activity",
  "Other"
];

// URL is optional; when given it must be an http(s) link
function validUrl(value) {
  if (typeof value !== "string" || value.length > 2048) {
    return false;
  }

  if (!value.trim()) {
    return true;
  }

  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateAchievement(data) {
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.length > 200
  ) {
    return "Title is required (maximum 200 characters)";
  }

  if (!types.includes(data.type)) {
    return "Invalid achievement type";
  }

  if (
    typeof data.description !== "string" ||
    data.description.length > 3000
  ) {
    return "Invalid description";
  }

  if (
    typeof data.issuedBy !== "string" ||
    data.issuedBy.length > 200
  ) {
    return "Invalid issuing organization";
  }

  if (
    data.month !== null &&
    (!Number.isInteger(data.month) ||
      data.month < 1 ||
      data.month > 12)
  ) {
    return "Invalid month";
  }

  if (
    data.year !== null &&
    (!Number.isInteger(data.year) ||
      data.year < 1900 ||
      data.year > 2100)
  ) {
    return "Invalid year";
  }

  if (data.month !== null && data.year === null) {
    return "Select a year when specifying a month";
  }

  if (!validUrl(data.url)) {
    return "Enter a valid link starting with http:// or https://";
  }

  return null;
}

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

function findAchievement(experience, req, res) {
  if (!mongoose.isValidObjectId(req.params.achievementId)) {
    res.status(400).json({
      success: false,
      message: "Invalid achievement ID"
    });
    return null;
  }

  const achievement = experience.achievements.id(req.params.achievementId);

  if (!achievement) {
    res.status(404).json({
      success: false,
      message: "Achievement not found"
    });
    return null;
  }

  return achievement;
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
    message: "Unable to process achievement"
  });
}

exports.getAchievements = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const achievements = [...experience.achievements].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return res.json({
      success: true,
      achievements
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createAchievement = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    if (rejectIfFull(res, experience, "achievements", "achievements")) return;

    const {
      title,
      type = "Achievement",
      description = "",
      month = null,
      year = null,
      issuedBy = "",
      url = ""
    } = req.body || {};

    const data = {
      title, type, description, month, year, issuedBy, url
    };

    const error = validateAchievement(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    experience.achievements.push({
      title: title.trim(),
      type,
      description: description.trim(),
      month,
      year,
      issuedBy: issuedBy.trim(),
      url: url.trim()
    });
    await experience.save();

    const achievement =
      experience.achievements[experience.achievements.length - 1];

    return res.status(201).json({
      success: true,
      achievement
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateAchievement = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const achievement = findAchievement(experience, req, res);
    if (!achievement) return;

    const updates = req.body || {};

    const data = {
      title: updates.title ?? achievement.title,
      type: updates.type ?? achievement.type,
      description: updates.description ?? achievement.description,
      month: updates.month !== undefined
        ? updates.month
        : achievement.month,
      year: updates.year !== undefined
        ? updates.year
        : achievement.year,
      issuedBy: updates.issuedBy ?? achievement.issuedBy,
      url: updates.url ?? achievement.url
    };

    const error = validateAchievement(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    achievement.title = data.title.trim();
    achievement.type = data.type;
    achievement.description = data.description.trim();
    achievement.month = data.month;
    achievement.year = data.year;
    achievement.issuedBy = data.issuedBy.trim();
    achievement.url = data.url.trim();

    await experience.save();

    return res.json({
      success: true,
      achievement
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteAchievement = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const achievement = findAchievement(experience, req, res);
    if (!achievement) return;

    const fileKey = achievement.file?.key;

    achievement.deleteOne();
    await experience.save();
    await deleteFile(fileKey);

    return res.json({
      success: true,
      message: "Achievement deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
