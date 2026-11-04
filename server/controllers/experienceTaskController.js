const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const Experience = require("../models/Experience");

// Tasks are stored in the Experience document's `tasks` array.
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

function findTask(experience, req, res) {
  if (!mongoose.isValidObjectId(req.params.taskId)) {
    res.status(400).json({
      success: false,
      message: "Invalid task ID"
    });
    return null;
  }

  const task = experience.tasks.id(req.params.taskId);

  if (!task) {
    res.status(404).json({
      success: false,
      message: "Task not found"
    });
    return null;
  }

  return task;
}

function validateDescription(description) {
  return (
    typeof description === "string" &&
    description.trim().length > 0 &&
    description.length <= 2000
  );
}

function sortedTasks(experience) {
  return [...experience.tasks].sort(
    (a, b) => a.order - b.order || a.createdAt - b.createdAt
  );
}

exports.getTasks = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    res.json({ success: true, tasks: sortedTasks(experience) });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to load tasks"
    });
  }
};

exports.createTask = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    if (rejectIfFull(res, experience, "tasks", "tasks")) return;

    const { description, order = 0 } = req.body || {};

    if (!validateDescription(description)) {
      return res.status(400).json({
        success: false,
        message: "Task description is required (maximum 2000 characters)"
      });
    }

    if (!Number.isInteger(order) || order < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid task order"
      });
    }

    experience.tasks.push({
      description: description.trim(),
      order
    });
    await experience.save();

    const task = experience.tasks[experience.tasks.length - 1];

    res.status(201).json({ success: true, task });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to create task"
    });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const { description } = req.body || {};

    if (!validateDescription(description)) {
      return res.status(400).json({
        success: false,
        message: "Valid task description is required"
      });
    }

    const task = findTask(experience, req, res);
    if (!task) return;

    task.description = description.trim();
    await experience.save();

    res.json({ success: true, task });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to update task"
    });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const task = findTask(experience, req, res);
    if (!task) return;

    task.deleteOne();
    await experience.save();

    res.json({
      success: true,
      message: "Task deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to delete task"
    });
  }
};
