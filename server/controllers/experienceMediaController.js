const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const Experience = require("../models/Experience");
const { deleteFile } = require("../storage/fileStorage");

// Media items are stored in the Experience document's `media` array.
const mediaTypes = [
  "Image",
  "Document",
  "Presentation",
  "Video",
  "Certificate",
  "Project",
  "GitHub",
  "Website",
  "Article",
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

function validateMedia(data) {
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.length > 200
  ) {
    return "Media title is required (maximum 200 characters)";
  }

  if (!mediaTypes.includes(data.mediaType)) {
    return "Invalid media type";
  }

  if (!validUrl(data.url)) {
    return "Enter a valid link starting with http:// or https://";
  }

  if (
    typeof data.description !== "string" ||
    data.description.length > 2000
  ) {
    return "Invalid media description";
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

function findMedia(experience, req, res) {
  if (!mongoose.isValidObjectId(req.params.mediaId)) {
    res.status(400).json({
      success: false,
      message: "Invalid media ID"
    });
    return null;
  }

  const media = experience.media.id(req.params.mediaId);

  if (!media) {
    res.status(404).json({
      success: false,
      message: "Media not found"
    });
    return null;
  }

  return media;
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
    message: "Unable to process media"
  });
}

exports.getMedia = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const media = [...experience.media].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return res.json({ success: true, media });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createMedia = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    if (rejectIfFull(res, experience, "media", "media items")) return;

    const {
      title,
      mediaType,
      url = "",
      description = ""
    } = req.body || {};

    const data = { title, mediaType, url, description };
    const error = validateMedia(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    experience.media.push({
      title: title.trim(),
      mediaType,
      url: url.trim(),
      description: description.trim()
    });
    await experience.save();

    const media = experience.media[experience.media.length - 1];

    return res.status(201).json({
      success: true,
      media
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateMedia = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const media = findMedia(experience, req, res);
    if (!media) return;

    const updates = req.body || {};

    const data = {
      title: updates.title ?? media.title,
      mediaType: updates.mediaType ?? media.mediaType,
      url: updates.url ?? media.url,
      description: updates.description ?? media.description
    };

    const error = validateMedia(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    media.title = data.title.trim();
    media.mediaType = data.mediaType;
    media.url = data.url.trim();
    media.description = data.description.trim();

    await experience.save();

    return res.json({
      success: true,
      media
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const media = findMedia(experience, req, res);
    if (!media) return;

    const fileKey = media.file?.key;

    media.deleteOne();
    await experience.save();
    await deleteFile(fileKey);

    return res.json({
      success: true,
      message: "Media deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
