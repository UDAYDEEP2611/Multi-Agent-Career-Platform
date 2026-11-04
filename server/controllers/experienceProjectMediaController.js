const path = require("path");
const {
  findOwnedProject,
  findProjectItem,
  projectMediaFolder,
  projectMediaLimit
} = require("./projectAccess");
const {
  saveFile,
  getFilePath,
  deleteFile
} = require("../storage/fileStorage");

// Project media is stored in experience.projects[].media. Each item is an
// uploaded file (bytes in private storage, metadata here) or a link.
// Also serves standalone projects and certifications (see projectAccess).

function mediaFull(req, res, project) {
  const { max, label } = projectMediaLimit(req);

  if (project.media.length < max) return false;

  badRequest(res, `You can add up to ${max} media items per ${label}`);
  return true;
}

function validUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) {
    return false;
  }

  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validateText(title, description) {
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 200
  ) {
    return "Title is required (maximum 200 characters)";
  }

  if (
    typeof description !== "string" ||
    description.length > 2000
  ) {
    return "Invalid description";
  }

  return null;
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

const findMedia = (project, req, res) =>
  findProjectItem(project, "media", "mediaId", "Media", req, res);

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return badRequest(res, error.message);
  }

  console.error(error);

  return res.status(500).json({
    success: false,
    message: "Unable to process project media"
  });
}

exports.getMedia = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const media = [...found.project.media].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return res.json({ success: true, media });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /links — JSON { title, description, url }
exports.createLink = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;
    const { title, description = "", url } = req.body || {};

    const error = validateText(title, description);
    if (error) return badRequest(res, error);

    if (!validUrl(url)) {
      return badRequest(res, "Enter a valid link starting with http:// or https://");
    }

    if (mediaFull(req, res, project)) return;

    project.media.push({
      title: title.trim(),
      description: description.trim(),
      mediaType: "Link",
      url: url.trim()
    });
    await parent.save();

    return res.status(201).json({
      success: true,
      media: project.media[project.media.length - 1]
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /upload — multipart: title, description, file
exports.uploadFile = async (req, res) => {
  let key = null;

  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;
    const title = req.body?.title || "";
    const description = req.body?.description || "";

    const error = validateText(title, description);
    if (error) return badRequest(res, error);

    if (mediaFull(req, res, project)) return;

    key = await saveFile(
      projectMediaFolder(req),
      req.file.buffer,
      req.file.detectedType
    );

    project.media.push({
      title: title.trim(),
      description: description.trim(),
      mediaType: "File",
      file: {
        key,
        originalName: path.basename(req.file.originalname).slice(0, 255),
        mimeType: req.file.detectedType,
        size: req.file.size
      }
    });
    await parent.save();
    key = null; // now referenced by the database

    return res.status(201).json({
      success: true,
      media: project.media[project.media.length - 1]
    });
  } catch (error) {
    return handleError(res, error);
  } finally {
    // Remove a stored file the database never ended up referencing
    if (key) await deleteFile(key);
  }
};

// PATCH /:mediaId — title, description, and url for links
exports.updateMedia = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;

    const media = findMedia(project, req, res);
    if (!media) return;

    const title = req.body?.title ?? media.title;
    const description = req.body?.description ?? media.description;

    const error = validateText(title, description);
    if (error) return badRequest(res, error);

    if (media.mediaType === "Link") {
      const url = req.body?.url ?? media.url;

      if (!validUrl(url)) {
        return badRequest(res, "Enter a valid link starting with http:// or https://");
      }

      media.url = url.trim();
    }

    media.title = title.trim();
    media.description = description.trim();
    await parent.save();

    return res.json({ success: true, media });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /:mediaId/download — sends the file with its original name
exports.downloadFile = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const media = findMedia(found.project, req, res);
    if (!media) return;

    if (media.mediaType !== "File" || !media.file) {
      return res.status(404).json({
        success: false,
        message: "File not found"
      });
    }

    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });

    return res.download(
      getFilePath(media.file.key),
      media.file.originalName || "download",
      (error) => {
        if (error && !res.headersSent) {
          res.status(404).json({
            success: false,
            message: "Unable to download file"
          });
        }
      }
    );
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;

    const media = findMedia(project, req, res);
    if (!media) return;

    const fileKey = media.file?.key;

    media.deleteOne();
    await parent.save();
    await deleteFile(fileKey);

    return res.json({
      success: true,
      message: "Media deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
