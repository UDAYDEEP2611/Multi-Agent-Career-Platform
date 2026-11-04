const mongoose = require("mongoose");
const Certification = require("../models/Certification");
const SkillAssociation = require("../models/SkillAssociation");
const { deleteFile } = require("../storage/fileStorage");
const validUrl = require("../utils/validUrl");

const editableFields = [
  "name",
  "issuingOrganization",
  "issueMonth",
  "issueYear",
  "expirationMonth",
  "expirationYear",
  "credentialId",
  "credentialUrl"
];

const defaults = {
  name: "",
  issuingOrganization: "",
  issueMonth: null,
  issueYear: null,
  expirationMonth: null,
  expirationYear: null,
  credentialId: "",
  credentialUrl: ""
};

const textLimits = {
  name: ["Name", 200],
  issuingOrganization: ["Issuing organization", 200],
  credentialId: ["Credential ID", 80]
};

const toMonth = (year, month, fallback) => year * 12 + (month || fallback);

// Merges the request onto the existing certification (PATCH) or the
// defaults (POST) and validates the result. Returns { data } or { error }.
function validateCertification(body, existing = null) {
  for (const key of Object.keys(body)) {
    if (!editableFields.includes(key)) {
      return { error: `Unsupported field: ${key}` };
    }
  }

  const base = existing ? existing.toObject() : defaults;
  const data = {};

  for (const field of editableFields) {
    data[field] = body[field] !== undefined ? body[field] : base[field];
  }

  for (const [field, [label, max]] of Object.entries(textLimits)) {
    if (typeof data[field] !== "string" || data[field].trim().length > max) {
      return { error: `${label} must be at most ${max} characters` };
    }

    data[field] = data[field].trim();
  }

  if (!data.name) return { error: "Name is required" };

  for (const field of ["issueMonth", "expirationMonth"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) || data[field] < 1 || data[field] > 12)
    ) {
      return { error: `Invalid ${field}` };
    }
  }

  for (const field of ["issueYear", "expirationYear"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) || data[field] < 1900 || data[field] > 2100)
    ) {
      return { error: `Invalid ${field}` };
    }
  }

  if (data.issueMonth !== null && data.issueYear === null) {
    return { error: "Issue year is required when issue month is selected" };
  }

  if (data.expirationMonth !== null && data.expirationYear === null) {
    return { error: "Expiration year is required when expiration month is selected" };
  }

  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth() + 1;

  // Expiration may be in the future; the issue date may not
  if (
    data.issueYear !== null &&
    toMonth(data.issueYear, data.issueMonth, 1) > currentMonth
  ) {
    return { error: "Issue date can't be in the future" };
  }

  if (
    data.issueYear !== null &&
    data.expirationYear !== null &&
    toMonth(data.expirationYear, data.expirationMonth, 12) <
      toMonth(data.issueYear, data.issueMonth, 1)
  ) {
    return { error: "Expiration date cannot be earlier than issue date" };
  }

  if (typeof data.credentialUrl !== "string") {
    return { error: "Invalid credential URL" };
  }

  data.credentialUrl = data.credentialUrl.trim();

  if (data.credentialUrl && !validUrl(data.credentialUrl)) {
    return { error: "Credential URL must start with http:// or https://" };
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

  console.error("Certification error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process certification"
  });
}

async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.certificationId)) {
    res.status(400).json({ success: false, message: "Invalid certification ID" });
    return null;
  }

  const certification = await Certification.findOne({
    _id: req.params.certificationId,
    userId: req.session.userId
  });

  if (!certification) {
    res.status(404).json({ success: false, message: "Certification not found" });
    return null;
  }

  return certification;
}

const issuedMonths = (item) =>
  item.issueYear ? toMonth(item.issueYear, item.issueMonth, 1) : 0;

// Most recently issued first; undated ones last, newest added first
const newestFirst = (a, b) =>
  issuedMonths(b) - issuedMonths(a) || b.createdAt - a.createdAt;

// Linked master skills for each certification, keyed by certification ID
async function skillsByCertification(userId, ids) {
  const links = await SkillAssociation.find({
    userId,
    sourceType: "certification",
    sourceId: { $in: ids }
  })
    .populate("skillId", "name rating isImportant")
    .sort({ createdAt: 1 });

  const map = {};

  for (const link of links) {
    if (!link.skillId) continue;
    (map[link.sourceId] ||= []).push(link.skillId);
  }

  return map;
}

// GET /api/certifications
// Each certification comes with its linked skills (name, rating)
exports.getCertifications = async (req, res) => {
  try {
    const userId = req.session.userId;
    const certifications = (await Certification.find({ userId })).sort(newestFirst);
    const skills = await skillsByCertification(
      userId,
      certifications.map((item) => item._id)
    );

    return res.json({
      success: true,
      certifications: certifications.map((item) => ({
        ...item.toObject(),
        skills: skills[item._id] || []
      }))
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/certifications/:certificationId
exports.getCertification = async (req, res) => {
  try {
    const certification = await findOwned(req, res);
    if (!certification) return;

    return res.json({ success: true, certification });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/certifications
exports.createCertification = async (req, res) => {
  try {
    const result = validateCertification(req.body || {});

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const certification = await Certification.create({
      ...result.data,
      userId: req.session.userId
    });

    return res.status(201).json({ success: true, certification });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/certifications/:certificationId
exports.updateCertification = async (req, res) => {
  try {
    const certification = await findOwned(req, res);
    if (!certification) return;

    const result = validateCertification(req.body || {}, certification);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    certification.set(result.data);
    await certification.save();

    return res.json({ success: true, certification });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/certifications/:certificationId
// Removes the certification, its skill links and its uploaded files
exports.deleteCertification = async (req, res) => {
  try {
    const certification = await findOwned(req, res);
    if (!certification) return;

    const fileKeys = certification.media.map((item) => item.file?.key);

    await certification.deleteOne();
    await SkillAssociation.deleteMany({
      userId: req.session.userId,
      sourceType: "certification",
      sourceId: certification._id
    });

    for (const key of fileKeys) {
      await deleteFile(key);
    }

    return res.json({
      success: true,
      message: "Certification deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
