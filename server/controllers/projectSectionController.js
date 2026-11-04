const { findOwnedProject, findProjectItem } = require("./projectAccess");
const {
  ACHIEVEMENT_CATEGORIES,
  LINK_TYPES
} = require("../models/Project");
const validUrl = require("../utils/validUrl");

// CRUD handlers for a list stored inside a standalone project
// (achievements, links). validate(body, existing) returns { data } or
// { error }; existing is set for PATCH so missing fields keep their value.
function createSectionController({ list, idParam, label, responseKey, validate, maxItems }) {
  const sendError = (res, status, message) =>
    res.status(status).json({ success: false, message });

  const handleError = (res, error) => {
    if (error.name === "ValidationError") {
      return sendError(res, 400, error.message);
    }

    console.error(`Project ${label.toLowerCase()} error:`, error);
    return sendError(res, 500, `Unable to process project ${label.toLowerCase()}`);
  };

  const sorted = (items) =>
    [...items].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

  const getAll = async (req, res) => {
    try {
      const found = await findOwnedProject(req, res);
      if (!found) return;

      return res.json({ success: true, [list]: sorted(found.project[list]) });
    } catch (error) {
      return handleError(res, error);
    }
  };

  const create = async (req, res) => {
    try {
      const found = await findOwnedProject(req, res);
      if (!found) return;

      const { parent, project } = found;

      if (project[list].length >= maxItems) {
        return sendError(res, 400, `You can add up to ${maxItems} ${list}`);
      }

      const result = validate(req.body || {});
      if (result.error) return sendError(res, 400, result.error);

      project[list].push(result.data);
      await parent.save();

      return res.status(201).json({
        success: true,
        [responseKey]: project[list][project[list].length - 1]
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

  const update = async (req, res) => {
    try {
      const found = await findOwnedProject(req, res);
      if (!found) return;

      const item = findProjectItem(found.project, list, idParam, label, req, res);
      if (!item) return;

      const result = validate(req.body || {}, item);
      if (result.error) return sendError(res, 400, result.error);

      item.set(result.data);
      await found.parent.save();

      return res.json({ success: true, [responseKey]: item });
    } catch (error) {
      return handleError(res, error);
    }
  };

  const remove = async (req, res) => {
    try {
      const found = await findOwnedProject(req, res);
      if (!found) return;

      const item = findProjectItem(found.project, list, idParam, label, req, res);
      if (!item) return;

      item.deleteOne();
      await found.parent.save();

      return res.json({ success: true, message: `${label} deleted successfully` });
    } catch (error) {
      return handleError(res, error);
    }
  };

  return { getAll, create, update, remove };
}

// Picks allowed fields onto the existing values (or defaults)
function merge(body, existing, defaults) {
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(defaults, key)) return { error: `Unsupported field: ${key}` };
  }

  const data = {};
  for (const [field, fallback] of Object.entries(defaults)) {
    data[field] =
      body[field] !== undefined ? body[field] : existing ? existing[field] : fallback;
  }

  return { data };
}

const validOrder = (order) => Number.isInteger(order) && order >= 0;

function textError(data, limits) {
  for (const [field, [max, required]] of Object.entries(limits)) {
    const value = data[field];

    if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
      return required
        ? `${field[0].toUpperCase() + field.slice(1)} is required (maximum ${max} characters)`
        : `${field} must be at most ${max} characters`;
    }

    data[field] = value.trim();
  }

  return null;
}

function validateAchievement(body, existing) {
  const merged = merge(body, existing, {
    title: "",
    category: "Outcome",
    metric: "",
    description: "",
    month: null,
    year: null,
    order: 0
  });
  if (merged.error) return merged;

  const { data } = merged;

  const error = textError(data, {
    title: [200, true],
    metric: [100, false],
    description: [2000, false]
  });
  if (error) return { error };

  if (!ACHIEVEMENT_CATEGORIES.includes(data.category)) {
    return { error: "Invalid achievement category" };
  }

  if (data.month !== null && (!Number.isInteger(data.month) || data.month < 1 || data.month > 12)) {
    return { error: "Invalid month" };
  }

  if (data.year !== null && (!Number.isInteger(data.year) || data.year < 1900)) {
    return { error: "Invalid year" };
  }

  if (data.month !== null && data.year === null) {
    return { error: "Year is required when a month is selected" };
  }

  if (data.year !== null) {
    const now = new Date();
    if (data.year * 12 + (data.month || 1) > now.getFullYear() * 12 + now.getMonth() + 1) {
      return { error: "Date can't be in the future" };
    }
  }

  if (!validOrder(data.order)) return { error: "Invalid order" };

  return { data };
}

function validateLink(body, existing) {
  const merged = merge(body, existing, {
    title: "",
    linkType: "Other",
    url: "",
    description: "",
    order: 0
  });
  if (merged.error) return merged;

  const { data } = merged;

  const error = textError(data, {
    title: [200, true],
    description: [500, false]
  });
  if (error) return { error };

  if (!LINK_TYPES.includes(data.linkType)) {
    return { error: "Invalid link type" };
  }

  if (!validUrl(data.url)) {
    return { error: "URL must start with http:// or https://" };
  }

  data.url = data.url.trim();

  if (!validOrder(data.order)) return { error: "Invalid order" };

  return { data };
}

exports.achievements = createSectionController({
  list: "achievements",
  idParam: "achievementId",
  label: "Achievement",
  responseKey: "achievement",
  validate: validateAchievement,
  maxItems: 20
});

exports.links = createSectionController({
  list: "links",
  idParam: "linkId",
  label: "Link",
  responseKey: "link",
  validate: validateLink,
  maxItems: 20
});
