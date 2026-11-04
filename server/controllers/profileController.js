
const Profile = require("../models/Profile");
const {
  ROLE_LIMITS, EMPLOYMENT_TYPES, WORKPLACE_TYPES, SERVICES, INDUSTRIES
} = require("../utils/roleOptions");

const contactFields = [
  "firstName", "middleName", "lastName",
  "preferredName", "suffix", "email",
  "phoneType", "phoneNumber", "alternateMobile",
  "addressLine", "country", "stateProvince",
  "city", "county", "postalCode",
  "linkedinUrl", "portfolioUrl", "githubUrl"
];

const personalFields = [
  "dateOfBirth", "maritalStatus", "gender",
  "veteranStatus", "disabilityStatus",
  "ethnicity", "authorizedToWork",
  "futureSponsorship"
];

const requiredContactFields = [
  "firstName", "lastName", "email",
  "phoneNumber", "addressLine", "country",
  "stateProvince", "city", "postalCode",
  "linkedinUrl"
];

const phoneTypes = ["", "Mobile", "Home", "Work", "Other"];

const maritalStatuses = [
  "", "Single", "Married", "Divorced",
  "Widowed", "Separated", "Prefer not to say"
];

const allowedGenders = [
  "", "Male", "Female", "Non-binary",
  "Self-describe", "Prefer not to say"
];

const allowedEthnicities = [
  "", "American Indian or Alaska Native",
  "Asian", "Black or African American",
  "Hispanic or Latino",
  "Middle Eastern or North African",
  "Native Hawaiian or Other Pacific Islander",
  "White", "Two or more races",
  "Self-describe", "Prefer not to say"
];

function pickFields(input, allowedFields) {
  const result = {};

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      result[key] = input[key];
    }
  }

  return result;
}

function validateContact(contact, requireAll = false) {
  if (!contact || typeof contact !== "object" ||
      Array.isArray(contact)) {
    return "Invalid contact details";
  }

  for (const [key, value] of Object.entries(contact)) {
    if (!contactFields.includes(key)) {
      return `Unsupported contact field: ${key}`;
    }

    if (typeof value !== "string") {
      return `${key} must be text`;
    }

    if (value.length > 500) {
      return `${key} exceeds the maximum length`;
    }
  }

  if (requireAll) {
    for (const key of requiredContactFields) {
      if (!contact[key]?.trim()) {
        return `${key} is required`;
      }
    }
  }

  if (contact.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    return "Invalid email address";
  }

  if (contact.phoneType &&
      !phoneTypes.includes(contact.phoneType)) {
    return "Invalid phone type";
  }

  for (const field of ["linkedinUrl", "portfolioUrl", "githubUrl"]) {
    if (contact[field]) {
      try {
        const url = new URL(contact[field]);
        if (!["https:", "http:"].includes(url.protocol)) {
          return `Invalid ${field}`;
        }
      } catch {
        return `Invalid ${field}`;
      }
    }
  }

  return null;
}

function validatePersonal(personal) {
  if (!personal || typeof personal !== "object" ||
      Array.isArray(personal)) {
    return "Invalid personal details";
  }

  for (const [key, value] of Object.entries(personal)) {
    if (!personalFields.includes(key)) {
      return `Unsupported personal field: ${key}`;
    }

    if ([
      "veteranStatus", "disabilityStatus",
      "authorizedToWork", "futureSponsorship"
    ].includes(key)) {
      if (value !== null && typeof value !== "boolean") {
        return `${key} must be Yes, No, or unanswered`;
      }
    } else if (key === "dateOfBirth") {
      if (value !== null && value !== "") {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime()) ||
            parsed > new Date()) {
          return "Invalid date of birth";
        }
      }
    } else if (typeof value !== "string") {
      return `${key} must be text`;
    } else if (value.length > 150) {
      return `${key} exceeds the maximum length`;
    }
  }

  if (personal.maritalStatus !== undefined &&
      !maritalStatuses.includes(personal.maritalStatus)) {
    return "Invalid marital status";
  }

  if (personal.gender !== undefined &&
      !allowedGenders.includes(personal.gender)) {
    return "Invalid gender";
  }

  if (personal.ethnicity !== undefined &&
      !allowedEthnicities.includes(personal.ethnicity)) {
    return "Invalid ethnicity";
  }

  return null;
}

// Free-text lists (roles, locations): trimmed, blanks dropped, duplicates
// removed ignoring case. Returns the clean list or an error message.
function cleanTextList(value, { label, max, maxLength }) {
  if (!Array.isArray(value)) return { error: `${label} must be a list` };

  const seen = new Set();
  const list = [];

  for (const item of value) {
    if (typeof item !== "string") return { error: `${label} must be text` };
    const text = item.trim().replace(/\s+/g, " ");
    if (!text) continue;
    if (text.length > maxLength) {
      return { error: `Each of your ${label.toLowerCase()} can be at most ${maxLength} characters` };
    }
    if (seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    list.push(text);
  }

  if (list.length > max) return { error: `You can add up to ${max} ${label.toLowerCase()}` };
  return { list };
}

// Lists picked from fixed choices: every item must be one of them
function cleanChoiceList(value, { label, choices, max = choices.length }) {
  if (!Array.isArray(value)) return { error: `${label} must be a list` };
  const list = [...new Set(value)];
  const unknown = list.find((item) => !choices.includes(item));
  if (unknown !== undefined) return { error: `Unsupported ${label.toLowerCase()}: ${unknown}` };
  if (list.length > max) return { error: `You can pick up to ${max} ${label.toLowerCase()}` };
  // Keep the order the choices are listed in
  return { list: choices.filter((choice) => list.includes(choice)) };
}

const roleListRules = {
  targetRoles: (value) => cleanTextList(value, {
    label: "Roles", max: ROLE_LIMITS.maxRoles, maxLength: ROLE_LIMITS.maxRoleLength
  }),
  locations: (value) => cleanTextList(value, {
    label: "Locations", max: ROLE_LIMITS.maxLocations, maxLength: ROLE_LIMITS.maxLocationLength
  }),
  employmentTypes: (value) => cleanChoiceList(value, { label: "Employment types", choices: EMPLOYMENT_TYPES }),
  workplaceTypes: (value) => cleanChoiceList(value, { label: "Workplace types", choices: WORKPLACE_TYPES }),
  services: (value) => cleanChoiceList(value, { label: "Services", choices: SERVICES }),
  industries: (value) => cleanChoiceList(value, {
    label: "Industries", choices: INDUSTRIES, max: ROLE_LIMITS.maxIndustries
  })
};

// { updates } with the cleaned role details, or { error }
function cleanRoleDetails(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Invalid role details" };
  }

  const updates = {};

  for (const [key, value] of Object.entries(input)) {
    if (key === "headline") {
      if (typeof value !== "string") return { error: "Headline must be text" };
      const headline = value.trim();
      if (headline.length > ROLE_LIMITS.maxHeadlineLength) {
        return { error: `Headline can be at most ${ROLE_LIMITS.maxHeadlineLength} characters` };
      }
      updates.headline = headline;
    } else if (roleListRules[key]) {
      const { list, error } = roleListRules[key](value);
      if (error) return { error };
      updates[key] = list;
    } else {
      return { error: `Unsupported role detail: ${key}` };
    }
  }

  if (!Object.keys(updates).length) return { error: "No fields provided" };
  return { updates };
}

// GET — Read profile
exports.getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({
      userId: req.session.userId
    }).populate("userId", "username");

    return res.json({ success: true, profile });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load profile"
    });
  }
};

// POST — Create profile
exports.createProfile = async (req, res) => {
  try {
    const contact = req.body?.contact;

    const error = validateContact(contact, true);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    const existing = await Profile.exists({
      userId: req.session.userId
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Profile already exists"
      });
    }

    const profile = await Profile.create({
      userId: req.session.userId,
      contact: pickFields(contact, contactFields)
    });

    return res.status(201).json({
      success: true,
      profile
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Profile already exists"
      });
    }

    console.error("Create profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create profile"
    });
  }
};

// PATCH — Update contact details
exports.updateContact = async (req, res) => {
  try {
    const contact = req.body;

    const error = validateContact(contact);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    const updates = pickFields(contact, contactFields);

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No fields provided"
      });
    }

    const profile = await Profile.findOne({
      userId: req.session.userId
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }

    const merged = {
      ...profile.contact.toObject(),
      ...updates
    };

    const mergedError = validateContact(merged, true);

    if (mergedError) {
      return res.status(400).json({
        success: false,
        message: mergedError
      });
    }

    profile.set("contact", merged);
    await profile.save();

    return res.json({ success: true, profile });
  } catch (error) {
    console.error("Update contact error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update contact details"
    });
  }
};

// PATCH — Update personal details
exports.updatePersonal = async (req, res) => {
  try {
    const personal = req.body;

    const error = validatePersonal(personal);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    const updates = pickFields(personal, personalFields);

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No fields provided"
      });
    }

    if (updates.dateOfBirth === "") {
      updates.dateOfBirth = null;
    }

    const $set = {};

    for (const [key, value] of Object.entries(updates)) {
      $set[`personal.${key}`] = value;
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: req.session.userId },
      { $set },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }

    return res.json({ success: true, profile });
  } catch (error) {
    console.error("Update personal error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update personal details"
    });
  }
};

// PATCH — Update role details (target roles, job types, locations...)
exports.updateRoleDetails = async (req, res) => {
  try {
    const { updates, error } = cleanRoleDetails(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    const $set = {};

    for (const [key, value] of Object.entries(updates)) {
      $set[`roleDetails.${key}`] = value;
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: req.session.userId },
      { $set },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Create your Contact Details first"
      });
    }

    return res.json({ success: true, profile });
  } catch (error) {
    console.error("Update role details error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update role details"
    });
  }
};

// DELETE — Delete profile
exports.deleteProfile = async (req, res) => {
  try {
    const profile = await Profile.findOneAndDelete({
      userId: req.session.userId
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }

    return res.json({
      success: true,
      message: "Profile deleted successfully"
    });
  } catch (error) {
    console.error("Delete profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete profile"
    });
  }
};
