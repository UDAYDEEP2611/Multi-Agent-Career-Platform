const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const { findOwnedEducation } = require("./educationController");

// Education tasks are stored in education.tasks, so each task is always
// scoped to its user and education.
function findTask(education, req, res) {
  if (!mongoose.isValidObjectId(req.params.taskId)) {
    res.status(400).json({
      success: false,
      message: "Invalid task ID"
    });
    return null;
  }

  const task = education.tasks.id(req.params.taskId);

  if (!task) {
    res.status(404).json({
      success: false,
      message: "Task not found"
    });
    return null;
  }

  return task;
}

function validateTask(body, existing = null) {
  const description =
    body.description !== undefined
      ? body.description
      : existing?.description;

  const order =
    body.order !== undefined
      ? body.order
      : existing?.order ?? 0;

  if (
    typeof description !== "string" ||
    !description.trim() ||
    description.trim().length > 2000
  ) {
    return {
      error: "Description is required (maximum 2000 characters)"
    };
  }

  if (!Number.isInteger(order) || order < 0) {
    return {
      error: "Order must be a non-negative integer"
    };
  }

  return {
    data: {
      description: description.trim(),
      order
    }
  };
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error("Education Task error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process education task"
  });
}

exports.getTasks = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const tasks = [...education.tasks].sort(
      (a, b) => a.order - b.order || a.createdAt - b.createdAt
    );

    return res.json({
      success: true,
      tasks
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createTask = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    if (rejectIfFull(res, education, "tasks", "tasks")) return;

    const result = validateTask(req.body || {});

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    education.tasks.push(result.data);
    await education.save();

    return res.status(201).json({
      success: true,
      task: education.tasks[education.tasks.length - 1]
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateTask = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const task = findTask(education, req, res);
    if (!task) return;

    const result = validateTask(req.body || {}, task);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    task.set(result.data);
    await education.save();

    return res.json({
      success: true,
      task
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const task = findTask(education, req, res);
    if (!task) return;

    task.deleteOne();
    await education.save();

    return res.json({
      success: true,
      message: "Task deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
