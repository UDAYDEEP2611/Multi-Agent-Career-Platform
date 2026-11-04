const express = require("express");

const router = express.Router({
  mergeParams: true
});

const requireAuth = require("../middleware/authMiddleware");

const {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse
} = require("../controllers/educationCourseController");

router.use(requireAuth);

router.get("/", getCourses);
router.post("/", createCourse);
router.patch("/:courseId", updateCourse);
router.delete("/:courseId", deleteCourse);

module.exports = router;
