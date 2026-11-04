const mongoose = require("mongoose");
const Experience = require("../models/Experience");
const {
  saveFile,
  getFilePath,
  deleteFile
} = require("../storage/fileStorage");

// Experience sections whose items can have one attached picture/PDF
const fileSections = ["media", "achievements", "volunteering", "records"];

function sendError(res, status, message) {
  res.status(status).json({ success: false, message });
  return null;
}

async function findOwnedItem(req, res, section, idParam) {
  if (!mongoose.isValidObjectId(req.params.experienceId)) {
    return sendError(res, 400, "Invalid experience ID");
  }

  if (!mongoose.isValidObjectId(req.params[idParam])) {
    return sendError(res, 400, "Invalid item ID");
  }

  const experience = await Experience.findOne({
    _id: req.params.experienceId,
    userId: req.session.userId
  });

  if (!experience) {
    return sendError(res, 404, "Experience not found");
  }

  const item = experience[section].id(req.params[idParam]);

  if (!item) {
    return sendError(res, 404, "Item not found");
  }

  return { parent: experience, item };
}

function handleError(res, error) {
  console.error("Experience file error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process file"
  });
}

// Builds upload/get/delete handlers for items that hold one attached
// picture/PDF in `item.file`. findItem(req, res) returns { parent, item }
// (parent is the document to save) or sends an error and returns null.
const createFileHandlers = ({ folder, responseKey, findItem }) => ({
  // POST attach or replace a picture/PDF (multipart field "file")
  uploadFile: async (req, res) => {
    try {
      const found = await findItem(req, res);
      if (!found) return;

      const { parent, item } = found;
      const oldKey = item.file?.key;

      const key = await saveFile(
        folder,
        req.file.buffer,
        req.file.detectedType
      );

      item.file = {
        key,
        originalName: req.file.originalname.slice(0, 255),
        mimeType: req.file.detectedType,
        size: req.file.size
      };

      try {
        await parent.save();
      } catch (error) {
        await deleteFile(key);
        throw error;
      }

      await deleteFile(oldKey);

      return res.json({ success: true, [responseKey]: item });
    } catch (error) {
      return handleError(res, error);
    }
  },

  // GET stream the file to its owner
  getFile: async (req, res) => {
    try {
      const found = await findItem(req, res);
      if (!found) return;

      const { item } = found;

      if (!item.file) {
        return sendError(res, 404, "No file attached");
      }

      res.set({
        "Content-Type": item.file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          item.file.originalName || "file"
        )}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600"
      });

      return res.sendFile(getFilePath(item.file.key), (error) => {
        if (error && !res.headersSent) {
          sendError(res, 404, "File not found");
        }
      });
    } catch (error) {
      return handleError(res, error);
    }
  },

  // DELETE remove the attached file but keep the item
  deleteFile: async (req, res) => {
    try {
      const found = await findItem(req, res);
      if (!found) return;

      const { parent, item } = found;
      const fileKey = item.file?.key;

      item.file = null;
      await parent.save();
      await deleteFile(fileKey);

      return res.json({ success: true, [responseKey]: item });
    } catch (error) {
      return handleError(res, error);
    }
  }
});

exports.createFileHandlers = createFileHandlers;

// Handlers for an Experience section, e.g.
// fileHandlers("records", "recordId", "record")
exports.fileHandlers = (section, idParam, responseKey) =>
  createFileHandlers({
    folder: `experience-${section}`,
    responseKey,
    findItem: (req, res) => findOwnedItem(req, res, section, idParam)
  });

// Removes every attached file of an experience from storage
exports.deleteExperienceFiles = async (experience) => {
  for (const section of fileSections) {
    for (const item of experience[section] || []) {
      await deleteFile(item.file?.key);
    }
  }

  for (const project of experience.projects || []) {
    for (const item of project.media || []) {
      await deleteFile(item.file?.key);
    }
  }
};
