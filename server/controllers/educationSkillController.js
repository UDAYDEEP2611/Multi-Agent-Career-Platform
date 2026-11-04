const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const { findOwnedEducation } = require("./educationController");

// Education skills are stored in education.skills, so each skill is always
// scoped to its user and education.
const allowedProficiencies = [
  "",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert"
];

function findSkill(education, req, res) {
  if (!mongoose.isValidObjectId(req.params.skillId)) {
    res.status(400).json({
      success: false,
      message: "Invalid skill ID"
    });
    return null;
  }

  const skill = education.skills.id(req.params.skillId);

  if (!skill) {
    res.status(404).json({
      success: false,
      message: "Skill not found"
    });
    return null;
  }

  return skill;
}

function validateSkill(body, existing = null) {
  const name =
    body.name !== undefined
      ? body.name
      : existing?.name;

  const category =
    body.category !== undefined
      ? body.category
      : existing?.category ?? "";

  const proficiency =
    body.proficiency !== undefined
      ? body.proficiency
      : existing?.proficiency ?? "";

  const order =
    body.order !== undefined
      ? body.order
      : existing?.order ?? 0;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 100
  ) {
    return {
      error: "Skill name is required (maximum 100 characters)"
    };
  }

  if (
    typeof category !== "string" ||
    category.length > 100
  ) {
    return {
      error: "Invalid skill category"
    };
  }

  if (!allowedProficiencies.includes(proficiency)) {
    return {
      error: "Invalid proficiency"
    };
  }

  if (!Number.isInteger(order) || order < 0) {
    return {
      error: "Order must be a non-negative integer"
    };
  }

  return {
    data: {
      name: name.trim(),
      category: category.trim(),
      proficiency,
      order
    }
  };
}

// Same name ignoring capitalization counts as a duplicate
function isDuplicate(education, name, skipId) {
  const target = name.toLowerCase();

  return education.skills.some(
    (skill) =>
      skill.name.toLowerCase() === target &&
      String(skill._id) !== String(skipId)
  );
}

function sendDuplicate(res) {
  return res.status(409).json({
    success: false,
    message: "This skill already exists for this education"
  });
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error("Education Skill error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process education skill"
  });
}

exports.getSkills = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const skills = [...education.skills].sort(
      (a, b) => a.order - b.order || a.createdAt - b.createdAt
    );

    return res.json({
      success: true,
      skills
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createSkill = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    if (rejectIfFull(res, education, "skills", "skills")) return;

    const result = validateSkill(req.body || {});

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    if (isDuplicate(education, result.data.name)) {
      return sendDuplicate(res);
    }

    education.skills.push(result.data);
    await education.save();

    return res.status(201).json({
      success: true,
      skill: education.skills[education.skills.length - 1]
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateSkill = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const skill = findSkill(education, req, res);
    if (!skill) return;

    const result = validateSkill(req.body || {}, skill);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    if (isDuplicate(education, result.data.name, skill._id)) {
      return sendDuplicate(res);
    }

    skill.set(result.data);
    await education.save();

    return res.json({
      success: true,
      skill
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteSkill = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const skill = findSkill(education, req, res);
    if (!skill) return;

    skill.deleteOne();
    await education.save();

    return res.json({
      success: true,
      message: "Skill deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
