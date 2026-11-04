const {
  findOwnedProject,
  findProjectItem
} = require("./projectAccess");

// Contributors are stored in experience.projects[].contributors, so each is
// always scoped to its user, experience and project.
const editableFields = [
  "name",
  "role",
  "contribution",
  "email",
  "profileUrl",
  "order"
];

const defaults = {
  name: "",
  role: "",
  contribution: "",
  email: "",
  profileUrl: "",
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
  for (const field of ["name", "role"]) {
    if (
      typeof data[field] !== "string" ||
      !data[field].trim() ||
      data[field].length > 150
    ) {
      return `${field} is required (maximum 150 characters)`;
    }
  }

  for (const [field, max] of [
    ["contribution", 3000],
    ["email", 254],
    ["profileUrl", 2048]
  ]) {
    if (
      typeof data[field] !== "string" ||
      data[field].length > max
    ) {
      return `Invalid ${field}`;
    }
  }

  if (
    data.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())
  ) {
    return "Invalid email address";
  }

  // URL is optional; when given it must be an http(s) link
  if (data.profileUrl.trim()) {
    try {
      const url = new URL(data.profileUrl.trim());

      if (!["https:", "http:"].includes(url.protocol)) {
        return "Enter a valid link starting with http:// or https://";
      }
    } catch {
      return "Enter a valid link starting with http:// or https://";
    }
  }

  if (!Number.isInteger(data.order) || data.order < 0) {
    return "Invalid contributor order";
  }

  return null;
}

function clean(data) {
  return {
    ...data,
    name: data.name.trim(),
    role: data.role.trim(),
    contribution: data.contribution.trim(),
    email: data.email.trim().toLowerCase(),
    profileUrl: data.profileUrl.trim()
  };
}

const findContributor = (project, req, res) =>
  findProjectItem(project, "contributors", "contributorId", "Contributor", req, res);

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
    message: "Unable to process contributor"
  });
}

exports.getContributors = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const contributors = [...found.project.contributors].sort(
      (a, b) => a.order - b.order || a.createdAt - b.createdAt
    );

    return res.json({
      success: true,
      contributors
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createContributor = async (req, res) => {
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

    project.contributors.push(clean(data));
    await parent.save();

    const contributor =
      project.contributors[project.contributors.length - 1];

    return res.status(201).json({
      success: true,
      contributor
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateContributor = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;

    const contributor = findContributor(project, req, res);
    if (!contributor) return;

    const data = {
      ...pick(contributor.toObject()),
      ...pick(req.body || {})
    };

    const error = validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    contributor.set(clean(data));
    await parent.save();

    return res.json({
      success: true,
      contributor
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteContributor = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;

    const contributor = findContributor(project, req, res);
    if (!contributor) return;

    contributor.deleteOne();
    await parent.save();

    return res.json({
      success: true,
      message: "Contributor deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
