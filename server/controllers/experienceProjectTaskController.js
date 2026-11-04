const {
  findOwnedProject,
  findProjectItem
} = require("./projectAccess");

// Project tasks are stored in experience.projects[].tasks, so a task is
// always scoped to its user, experience and project.
const findTask = (project, req, res) =>
  findProjectItem(project, "tasks", "taskId", "Task", req, res);

function validDescription(description) {
  return (
    typeof description === "string" &&
    description.trim().length > 0 &&
    description.length <= 2000
  );
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
    message: "Unable to process project task"
  });
}

exports.getTasks = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const tasks = [...found.project.tasks].sort(
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
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;
    const { description, order = 0 } = req.body || {};

    if (!validDescription(description)) {
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

    project.tasks.push({
      description: description.trim(),
      order
    });
    await parent.save();

    const task = project.tasks[project.tasks.length - 1];

    return res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateTask = async (req, res) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;

    const task = findTask(project, req, res);
    if (!task) return;

    const updates = req.body || {};

    if (updates.description !== undefined) {
      if (!validDescription(updates.description)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task description"
        });
      }

      task.description = updates.description.trim();
    }

    if (updates.order !== undefined) {
      if (
        !Number.isInteger(updates.order) ||
        updates.order < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid task order"
        });
      }

      task.order = updates.order;
    }

    await parent.save();

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
    const found = await findOwnedProject(req, res);
    if (!found) return;

    const { parent, project } = found;

    const task = findTask(project, req, res);
    if (!task) return;

    task.deleteOne();
    await parent.save();

    return res.json({
      success: true,
      message: "Project task deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
