const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const Experience = require("../models/Experience");

// Skills are stored in the Experience document's `skills` array.
const allowedProficiencies = [
  "",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert"
];

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

function findSkill(experience, req, res) {
  if (!mongoose.isValidObjectId(req.params.skillId)) {
    res.status(400).json({
      success: false,
      message: "Invalid skill ID"
    });
    return null;
  }

  const skill = experience.skills.id(req.params.skillId);

  if (!skill) {
    res.status(404).json({
      success: false,
      message: "Skill not found"
    });
    return null;
  }

  return skill;
}

function validateSkill(data) {
  if (
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 100
  ) {
    return "Skill name is required (maximum 100 characters)";
  }

  if (
    typeof data.category !== "string" ||
    data.category.length > 100
  ) {
    return "Invalid skill category";
  }

  if (!allowedProficiencies.includes(data.proficiency)) {
    return "Invalid proficiency";
  }

  if (!Number.isInteger(data.order) || data.order < 0) {
    return "Invalid skill order";
  }

  return null;
}

// Same name ignoring capitalization counts as a duplicate
function isDuplicate(experience, name, skipId) {
  const target = name.trim().toLowerCase();

  return experience.skills.some(
    (skill) =>
      skill.name.toLowerCase() === target &&
      String(skill._id) !== String(skipId)
  );
}

function sendDuplicate(res) {
  return res.status(409).json({
    success: false,
    message: "This skill already exists for this experience"
  });
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
    message: "Unable to process skill"
  });
}

function sortedSkills(experience) {
  return [...experience.skills].sort(
    (a, b) => a.order - b.order || a.createdAt - b.createdAt
  );
}

// GET all skills for one experience
exports.getSkills = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    return res.json({ success: true, skills: sortedSkills(experience) });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST add skill
exports.createSkill = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    if (rejectIfFull(res, experience, "skills", "skills")) return;

    const {
      name,
      category = "",
      proficiency = "",
      order = 0
    } = req.body || {};

    const data = { name, category, proficiency, order };
    const error = validateSkill(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    if (isDuplicate(experience, name)) {
      return sendDuplicate(res);
    }

    experience.skills.push({
      name: name.trim(),
      category: category.trim(),
      proficiency,
      order
    });
    await experience.save();

    const skill = experience.skills[experience.skills.length - 1];

    return res.status(201).json({ success: true, skill });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH edit skill
exports.updateSkill = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const skill = findSkill(experience, req, res);
    if (!skill) return;

    const updates = req.body || {};

    const data = {
      name: updates.name ?? skill.name,
      category: updates.category ?? skill.category,
      proficiency: updates.proficiency ?? skill.proficiency,
      order: updates.order ?? skill.order
    };

    const error = validateSkill(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    if (isDuplicate(experience, data.name, skill._id)) {
      return sendDuplicate(res);
    }

    skill.name = data.name.trim();
    skill.category = data.category.trim();
    skill.proficiency = data.proficiency;
    skill.order = data.order;

    await experience.save();

    return res.json({ success: true, skill });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE skill
exports.deleteSkill = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const skill = findSkill(experience, req, res);
    if (!skill) return;

    skill.deleteOne();
    await experience.save();

    return res.json({
      success: true,
      message: "Skill deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
