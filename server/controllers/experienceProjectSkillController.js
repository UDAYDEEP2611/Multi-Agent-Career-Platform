const {
  findOwnedProject,
  findProjectItem
} = require("./projectAccess");

// Project skills are stored in experience.projects[].skills, so each is
// always scoped to its user, experience and project.
const proficiencies = [
  "",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert"
];

const editableFields = [
  "name",
  "category",
  "proficiency",
  "order"
];

const defaults = {
  name: "",
  category: "",
  proficiency: "",
  order: 0
};

function pick(body = {}) {
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

  if (!proficiencies.includes(data.proficiency)) {
    return "Invalid proficiency level";
  }

  if (
    !Number.isInteger(data.order) ||
    data.order < 0
  ) {
    return "Invalid skill order";
  }

  return null;
}

// Same name ignoring capitalization counts as a duplicate within a project
function isDuplicate(project, name, skipId) {
  const target = name.trim().toLowerCase();

  return project.skills.some(
    (skill) =>
      skill.name.toLowerCase() === target &&
      String(skill._id) !== String(skipId)
  );
}

function sendDuplicate(res) {
  return res.status(409).json({
    success: false,
    message: "This skill already exists in the project"
  });
}

const findSkill = (project, req, res) =>
  findProjectItem(project, "skills", "skillId", "Skill", req, res);

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
    message: "Unable to process project skill"
  });
}

exports.getSkills = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const skills = [...found.project.skills].sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name)
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
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;

    const data = {
      ...defaults,
      ...pick(req.body || {})
    };

    const error = validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    if (isDuplicate(project, data.name)) {
      return sendDuplicate(res);
    }

    project.skills.push({
      ...data,
      name: data.name.trim(),
      category: data.category.trim()
    });
    await parent.save();

    const skill = project.skills[project.skills.length - 1];

    return res.status(201).json({
      success: true,
      skill
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateSkill = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;

    const skill = findSkill(project, req, res);
    if (!skill) return;

    const data = {
      ...pick(skill.toObject()),
      ...pick(req.body || {})
    };

    const error = validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    if (isDuplicate(project, data.name, skill._id)) {
      return sendDuplicate(res);
    }

    skill.set({
      ...data,
      name: data.name.trim(),
      category: data.category.trim()
    });
    await parent.save();

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
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;

    const skill = findSkill(project, req, res);
    if (!skill) return;

    skill.deleteOne();
    await parent.save();

    return res.json({
      success: true,
      message: "Project skill deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
