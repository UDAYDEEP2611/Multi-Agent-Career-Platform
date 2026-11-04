const mongoose = require("mongoose");
const Experience = require("../models/Experience");
const { deleteFile } = require("../storage/fileStorage");

// Records are stored in the Experience document's `records` array.
const recordTypes = [
  "Performance Review",
  "Employment Verification",
  "Training",
  "Certification",
  "Compliance",
  "Project Documentation",
  "Other"
];

const editableFields = [
  "title",
  "recordType",
  "issuedBy",
  "month",
  "year",
  "description",
  "referenceUrl",
  "referenceNumber",
  "visibility"
];

const defaults = {
  title: "",
  recordType: "Other",
  issuedBy: "",
  month: null,
  year: null,
  description: "",
  referenceUrl: "",
  referenceNumber: "",
  visibility: "Private"
};

function pickFields(body = {}) {
  const result = {};

  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
}

function validate(data) {
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.length > 200
  ) {
    return "Record title is required (maximum 200 characters)";
  }

  if (!recordTypes.includes(data.recordType)) {
    return "Invalid record type";
  }

  for (const [field, max] of [
    ["issuedBy", 200],
    ["description", 3000],
    ["referenceUrl", 2048],
    ["referenceNumber", 100]
  ]) {
    if (
      typeof data[field] !== "string" ||
      data[field].length > max
    ) {
      return `Invalid ${field}`;
    }
  }

  if (
    data.month !== null &&
    (!Number.isInteger(data.month) ||
      data.month < 1 ||
      data.month > 12)
  ) {
    return "Invalid record month";
  }

  if (
    data.year !== null &&
    (!Number.isInteger(data.year) ||
      data.year < 1900 ||
      data.year > 2100)
  ) {
    return "Invalid record year";
  }

  if (data.month !== null && data.year === null) {
    return "Select a year when specifying a month";
  }

  if (!["Private", "Portfolio"].includes(data.visibility)) {
    return "Invalid record visibility";
  }

  // URL is optional; when given it must be an http(s) link
  if (data.referenceUrl.trim()) {
    try {
      const parsed = new URL(data.referenceUrl.trim());

      if (!["https:", "http:"].includes(parsed.protocol)) {
        return "Enter a valid link starting with http:// or https://";
      }
    } catch {
      return "Enter a valid link starting with http:// or https://";
    }
  }

  return null;
}

function trimStrings(data) {
  for (const field of ["title", "issuedBy", "description", "referenceUrl", "referenceNumber"]) {
    data[field] = data[field].trim();
  }

  return data;
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

function findRecord(experience, req, res) {
  if (!mongoose.isValidObjectId(req.params.recordId)) {
    res.status(400).json({
      success: false,
      message: "Invalid record ID"
    });
    return null;
  }

  const record = experience.records.id(req.params.recordId);

  if (!record) {
    res.status(404).json({
      success: false,
      message: "Record not found"
    });
    return null;
  }

  return record;
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
    message: "Unable to process record"
  });
}

exports.getRecords = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const records = [...experience.records].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return res.json({
      success: true,
      records
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createRecord = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const data = {
      ...defaults,
      ...pickFields(req.body || {})
    };

    const error = validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    experience.records.push(trimStrings(data));
    await experience.save();

    const record = experience.records[experience.records.length - 1];

    return res.status(201).json({
      success: true,
      record
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const record = findRecord(experience, req, res);
    if (!record) return;

    const data = {
      ...pickFields(record.toObject()),
      ...pickFields(req.body || {})
    };

    const error = validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    record.set(trimStrings(data));
    await experience.save();

    return res.json({
      success: true,
      record
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const record = findRecord(experience, req, res);
    if (!record) return;

    const fileKey = record.file?.key;

    record.deleteOne();
    await experience.save();
    await deleteFile(fileKey);

    return res.json({
      success: true,
      message: "Record deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
