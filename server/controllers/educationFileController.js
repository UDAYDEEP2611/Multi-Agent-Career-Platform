const mongoose = require("mongoose");
const { findOwnedEducation } = require("./educationController");
const { createFileHandlers } = require("./experienceFileController");

// Upload / view / remove the attached picture or PDF of an item in one of
// an education's lists, e.g. educationFileHandlers("volunteering", "volunteeringId", "volunteering")
exports.educationFileHandlers = (list, idParam, responseKey) =>
  createFileHandlers({
    folder: `education-${list}`,
    responseKey,
    findItem: async (req, res) => {
      const education = await findOwnedEducation(req, res);
      if (!education) return null;

      if (!mongoose.isValidObjectId(req.params[idParam])) {
        res.status(400).json({ success: false, message: "Invalid item ID" });
        return null;
      }

      const item = education[list].id(req.params[idParam]);

      if (!item) {
        res.status(404).json({ success: false, message: "Item not found" });
        return null;
      }

      return { parent: education, item };
    }
  });
