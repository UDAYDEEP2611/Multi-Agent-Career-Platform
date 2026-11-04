const mongoose = require("mongoose");
const { findOwnedEducation } = require("./educationController");

// Courses are stored in education.courses, so each course is always
// scoped to its user and education.
function findCourse(education, req, res) {
  if (!mongoose.isValidObjectId(req.params.courseId)) {
    res.status(400).json({
      success: false,
      message: "Invalid course ID"
    });
    return null;
  }

  const course = education.courses.id(req.params.courseId);

  if (!course) {
    res.status(404).json({
      success: false,
      message: "Course not found"
    });
    return null;
  }

  return course;
}

function validateCourse(body, existing = null) {
  const name = body.name !== undefined ? body.name : existing?.name;
  const code = body.code !== undefined ? body.code : existing?.code ?? "";
  const order = body.order !== undefined ? body.order : existing?.order ?? 0;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 200
  ) {
    return { error: "Course name is required (maximum 200 characters)" };
  }

  if (typeof code !== "string" || code.trim().length > 50) {
    return { error: "Course ID must be 50 characters or fewer" };
  }

  if (!Number.isInteger(order) || order < 0) {
    return { error: "Order must be a non-negative integer" };
  }

  return {
    data: {
      name: name.trim(),
      code: code.trim(),
      order
    }
  };
}

// The same course ID (ignoring case and spaces) can't be added twice
const normalizeCode = (code) => code.replace(/\s+/g, "").toLowerCase();

function isDuplicate(education, code, skipId) {
  if (!code) return false;

  const target = normalizeCode(code);

  return education.courses.some(
    (course) =>
      course.code &&
      normalizeCode(course.code) === target &&
      String(course._id) !== String(skipId)
  );
}

function sendDuplicate(res) {
  return res.status(409).json({
    success: false,
    message: "A course with this ID already exists for this education"
  });
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error("Education Course error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process course"
  });
}

exports.getCourses = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const courses = [...education.courses].sort(
      (a, b) => a.order - b.order || a.createdAt - b.createdAt
    );

    return res.json({ success: true, courses });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createCourse = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const result = validateCourse(req.body || {});

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    if (isDuplicate(education, result.data.code)) {
      return sendDuplicate(res);
    }

    education.courses.push(result.data);
    await education.save();

    return res.status(201).json({
      success: true,
      course: education.courses[education.courses.length - 1]
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const course = findCourse(education, req, res);
    if (!course) return;

    const result = validateCourse(req.body || {}, course);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    if (isDuplicate(education, result.data.code, course._id)) {
      return sendDuplicate(res);
    }

    course.set(result.data);
    await education.save();

    return res.json({ success: true, course });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const course = findCourse(education, req, res);
    if (!course) return;

    course.deleteOne();
    await education.save();

    return res.json({
      success: true,
      message: "Course deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
