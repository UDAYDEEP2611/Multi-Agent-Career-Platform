const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const {
  ACHIEVEMENT_TYPES,
  CERTIFICATION_TYPES
} = require("../models/Education");
const { findOwnedEducation } = require("./educationController");
const { deleteFile } = require("../storage/fileStorage");

// Builds CRUD handlers for a list of dated entries on an education
// (achievements, certifications). Each entry is stored in that list, so it
// is always scoped to its user and education.
function createEntryController({
  list,
  types,
  defaultType,
  itemKey,
  idParam,
  label
}) {
  const editableFields = [
    "title",
    "type",
    "description",
    "date",
    "issuedBy",
    "url"
  ];

  function pickFields(body = {}) {
    const data = {};

    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        data[field] = body[field];
      }
    }

    return data;
  }

  function findEntry(education, req, res) {
    if (!mongoose.isValidObjectId(req.params[idParam])) {
      res.status(400).json({
        success: false,
        message: `Invalid ${label.toLowerCase()} ID`
      });
      return null;
    }

    const entry = education[list].id(req.params[idParam]);

    if (!entry) {
      res.status(404).json({
        success: false,
        message: `${label} not found`
      });
      return null;
    }

    return entry;
  }

  // Accepts "YYYY-MM-DD" (or empty/null for no date) and rejects
  // impossible dates like 2024-02-30
  function parseDate(value) {
    if (value === "" || value === null) {
      return { value: null };
    }

    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return { error: "Date must use YYYY-MM-DD format" };
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      return { error: "Invalid date" };
    }

    return { value: parsed };
  }

  function validateAchievement(body, existing = null) {
    const data = {
      title: existing?.title ?? "",
      type: existing?.type ?? defaultType,
      description: existing?.description ?? "",
      date: existing?.date
        ? existing.date.toISOString().slice(0, 10)
        : null,
      issuedBy: existing?.issuedBy ?? "",
      url: existing?.url ?? "",
      ...pickFields(body)
    };

    for (const [field, maxLength] of [
      ["title", 200],
      ["description", 3000],
      ["issuedBy", 200],
      ["url", 2048]
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
      return { error: "Title is required" };
    }

    if (!types.includes(data.type)) {
      return { error: `Invalid ${label.toLowerCase()} type` };
    }

    const parsedDate = parseDate(data.date);

    if (parsedDate.error) {
      return { error: parsedDate.error };
    }

    data.date = parsedDate.value;

    // URL is optional; when given it must be an http(s) link
    if (data.url) {
      try {
        const url = new URL(data.url);

        if (!["https:", "http:"].includes(url.protocol)) {
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

    console.error(`Education ${label} error:`, error);

    return res.status(500).json({
      success: false,
      message: `Unable to process ${label.toLowerCase()}`
    });
  }

  // Newest date first; undated entries last, newest added first
  function newestFirst(a, b) {
    if (a.date && b.date) return b.date - a.date || b.createdAt - a.createdAt;
    if (a.date || b.date) return a.date ? -1 : 1;
    return b.createdAt - a.createdAt;
  }

  const getAll = async (req, res) => {
    try {
      const education = await findOwnedEducation(req, res);
      if (!education) return;

      return res.json({
        success: true,
        [`${list}`]: [...education[list]].sort(newestFirst)
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

  const create = async (req, res) => {
    try {
      const education = await findOwnedEducation(req, res);
      if (!education) return;

      if (rejectIfFull(res, education, list, `${label.toLowerCase()}s`)) return;

      const result = validateAchievement(req.body || {});

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      education[list].push(result.data);
      await education.save();

      return res.status(201).json({
        success: true,
        [itemKey]: education[list][education[list].length - 1]
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

  const update = async (req, res) => {
    try {
      const education = await findOwnedEducation(req, res);
      if (!education) return;

      const entry = findEntry(education, req, res);
      if (!entry) return;

      const result = validateAchievement(req.body || {}, entry);

      if (result.error) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      entry.set(result.data);
      await education.save();

      return res.json({
        success: true,
        [itemKey]: entry
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

  const remove = async (req, res) => {
    try {
      const education = await findOwnedEducation(req, res);
      if (!education) return;

      const entry = findEntry(education, req, res);
      if (!entry) return;

      const fileKey = entry.file?.key;

      entry.deleteOne();
      await education.save();
      await deleteFile(fileKey);

      return res.json({
        success: true,
        message: `${label} deleted successfully`
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

  return { getAll, create, update, remove };
}

const achievements = createEntryController({
  list: "achievements",
  types: ACHIEVEMENT_TYPES,
  defaultType: "Achievement",
  itemKey: "achievement",
  idParam: "achievementId",
  label: "Achievement"
});

exports.getAchievements = achievements.getAll;
exports.createAchievement = achievements.create;
exports.updateAchievement = achievements.update;
exports.deleteAchievement = achievements.remove;

exports.certifications = createEntryController({
  list: "certifications",
  types: CERTIFICATION_TYPES,
  defaultType: "Certification",
  itemKey: "certification",
  idParam: "certificationId",
  label: "Certification"
});
