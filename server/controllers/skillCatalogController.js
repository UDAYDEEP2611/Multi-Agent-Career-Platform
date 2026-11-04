const SkillCatalog = require("../models/SkillCatalog");
const { normalizeSkillName } = require("../models/UserSkill");

const MAX_SUGGESTIONS = 10;

const escapeRegex = (text) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/skill-catalog/search?q=py
// Names starting with the query come first ("Python"), then names with a
// later word starting with it ("spark" → "Apache Spark").
exports.searchSkills = async (req, res) => {
  try {
    if (typeof req.query.q !== "string" && req.query.q !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Invalid search query"
      });
    }

    const query = normalizeSkillName(req.query.q || "");

    if (!query) {
      return res.json({ success: true, suggestions: [] });
    }

    if (query.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search query is too long"
      });
    }

    const escaped = escapeRegex(query);

    const prefixMatches = await SkillCatalog.find({
      normalizedName: { $regex: `^${escaped}` }
    })
      .select("name skillType")
      .sort({ normalizedName: 1 })
      .limit(MAX_SUGGESTIONS)
      .lean();

    const remaining = MAX_SUGGESTIONS - prefixMatches.length;

    const wordMatches = remaining > 0
      ? await SkillCatalog.find({
          normalizedName: { $regex: `[ ./-]${escaped}` },
          _id: { $nin: prefixMatches.map((skill) => skill._id) }
        })
          .select("name skillType")
          .sort({ normalizedName: 1 })
          .limit(remaining)
          .lean()
      : [];

    return res.json({
      success: true,
      suggestions: [...prefixMatches, ...wordMatches]
    });
  } catch (error) {
    console.error("Skill catalog search error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to search skills"
    });
  }
};
