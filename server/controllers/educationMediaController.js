const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const { MEDIA_TYPES } = require("../models/Education");
const { findOwnedEducation } = require("./educationController");
const { createFileHandlers } = require("./experienceFileController");
const { deleteFile } = require("../storage/fileStorage");

// Media items are stored in education.media. Each can have a link and/or
// an attached picture/PDF (uploaded through the /:mediaId/file routes).
function sendError(res, status, message) {
  res.status(status).json({ success: false, message });
  return null;
}

function findMedia(education, req, res) {
  if (!mongoose.isValidObjectId(req.params.mediaId)) {
    return sendError(res, 400, "Invalid media ID");
  }

  const media = education.media.id(req.params.mediaId);

  if (!media) {
    return sendError(res, 404, "Media not found");
  }

  return media;
}

function validateMedia(body, existing = null) {
  const data = {
    title: existing?.title ?? "",
    mediaType: existing?.mediaType ?? "Link",
    url: existing?.url ?? "",
    description: existing?.description ?? ""
  };

  for (const field of Object.keys(data)) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  }

  for (const [field, maxLength] of [
    ["title", 200],
    ["url", 2048],
    ["description", 3000]
  ]) {
    if (
      typeof data[field] !== "string" ||
      data[field].trim().length > maxLength
    ) {
      return { error: `Invalid ${field}` };
    }

    data[field] = data[field].trim();
  }

  if (!data.title) {
    return { error: "Media title is required" };
  }

  if (!MEDIA_TYPES.includes(data.mediaType)) {
    return { error: "Invalid media type" };
  }

  // URL is optional; when given it must be an http(s) link
  if (data.url) {
    try {
      const url = new URL(data.url);

      if (
        !["https:", "http:"].includes(url.protocol) ||
        !url.hostname
      ) {
        return { error: "Enter a valid link starting with http:// or https://" };
      }

      if (url.username || url.password) {
        return { error: "URL cannot contain credentials" };
      }
    } catch {
      return { error: "Enter a valid link starting with http:// or https://" };
    }
  }

  return { data };
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error("Education Media error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process education media"
  });
}

exports.getMedia = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const media = [...education.media].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return res.json({
      success: true,
      media
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createMedia = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    if (rejectIfFull(res, education, "media", "media items")) return;

    const result = validateMedia(req.body || {});

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    education.media.push(result.data);
    await education.save();

    return res.status(201).json({
      success: true,
      media: education.media[education.media.length - 1]
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateMedia = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const media = findMedia(education, req, res);
    if (!media) return;

    const result = validateMedia(req.body || {}, media);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    media.set(result.data);
    await education.save();

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
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const media = findMedia(education, req, res);
    if (!media) return;

    const fileKey = media.file?.key;

    media.deleteOne();
    await education.save();
    await deleteFile(fileKey);

    return res.json({
      success: true,
      message: "Media deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Attach / view / remove the media item's picture or PDF
exports.files = createFileHandlers({
  folder: "education-media",
  responseKey: "media",
  findItem: async (req, res) => {
    const education = await findOwnedEducation(req, res);
    if (!education) return null;

    const media = findMedia(education, req, res);
    if (!media) return null;

    return { parent: education, item: media };
  }
});
