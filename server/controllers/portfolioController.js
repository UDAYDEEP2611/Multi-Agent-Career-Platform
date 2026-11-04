const Profile = require("../models/Profile");
const Summary = require("../models/Summary");
const Experience = require("../models/Experience");
const Education = require("../models/Education");
const Project = require("../models/Project");
const UserSkill = require("../models/UserSkill");
const Certification = require("../models/Certification");
const Recommendation = require("../models/Recommendation");
const Volunteering = require("../models/Volunteering");
const Achievement = require("../models/Achievement");
const Interest = require("../models/Interest");
const Publication = require("../models/Publication");
const Patent = require("../models/Patent");
const User = require("../models/User");
const { gatherResumeData } = require("../services/resume/resumeData");
const { shownIn } = require("../models/plugins/visibility");
const { heroSummariesFor } = require("./heroSummaryController");

const countModels = {
  experience: Experience,
  education: Education,
  projects: Project,
  skills: UserSkill,
  certifications: Certification,
  recommendations: Recommendation,
  volunteering: Volunteering,
  achievements: Achievement,
  interests: Interest,
  publications: Publication,
  patents: Patent
};

// The sections that make a portfolio complete
const CORE_SECTIONS = ["profile", "summary", "experience", "education", "skills", "projects"];

// GET /api/portfolio/overview
// How many items each section has, for the signed-in user's home page
exports.getOverview = async (req, res) => {
  try {
    const userId = req.session.userId;

    const [profile, summary, ...counts] = await Promise.all([
      Profile.findOne({ userId }).lean(),
      Summary.findOne({ userId }, { content: 1 }).lean(),
      ...Object.values(countModels).map((Model) => Model.countDocuments({ userId }))
    ]);

    const sections = Object.fromEntries(
      Object.keys(countModels).map((key, index) => [key, counts[index]])
    );

    // A profile counts once it has any contact or personal detail filled in
    const hasValue = (value) =>
      value && typeof value === "object"
        ? Object.values(value).some(hasValue)
        : Boolean(value);

    sections.profile = hasValue({ contact: profile?.contact, personal: profile?.personal }) ? 1 : 0;
    sections.summary = summary?.content?.trim() ? 1 : 0;

    const filled = CORE_SECTIONS.filter((key) => sections[key] > 0);

    return res.json({
      success: true,
      sections,
      completeness: {
        filled: filled.length,
        total: CORE_SECTIONS.length,
        missing: CORE_SECTIONS.filter((key) => !sections[key])
      }
    });
  } catch (error) {
    console.error("Portfolio overview error:", error);
    return res.status(500).json({ success: false, message: "Unable to load your portfolio overview" });
  }
};

// GET /api/portfolio/showcase[?for=resume]
// The signed-in user's whole portfolio, shaped for the portfolio designs.
// Only public recommendations are included, without the recommender's
// email or phone.
exports.getShowcase = async (req, res) => {
  try {
    const userId = req.session.userId;
    const account = await User.findById(userId).select("username email").lean();

    // ?for=resume: the designed resumes (entries with Show in resume on);
    // otherwise the portfolio websites (Show in portfolio on)
    const audience = req.query.for === "resume" ? "resume" : "portfolio";
    const [portfolio, profile, allRecommendations] = await Promise.all([
      gatherResumeData(userId, account, { audience }),
      Profile.findOne({ userId }, { contact: 1, roleDetails: 1 }).lean(),
      Recommendation.find({ userId, visibility: "Public" }).lean()
    ]);
    const recommendations = allRecommendations.filter((item) => shownIn(item, audience));

    const contact = profile?.contact || {};
    const roles = profile?.roleDetails || {};
    const headline = roles.headline?.trim() || portfolio.experiences[0]?.title || "";
    const hasProfile = Boolean(contact.firstName || contact.lastName || contact.phoneNumber ||
      contact.city || contact.linkedinUrl || contact.githubUrl || contact.portfolioUrl);

    return res.json({
      success: true,
      portfolio: {
        ...portfolio,
        hasProfile,
        // The Role Details headline, else the latest job title
        headline,
        // Each design's AI-written hero summary: { [designId]: { text, origin, stale } }
        heroSummaries: await heroSummariesFor(userId, portfolio.summary, headline),
        // What the person is looking for, from Role Details
        openTo: {
          roleTargeting: roles.roleTargeting || "",
          employmentTypes: roles.employmentTypes || [],
          workplaceTypes: roles.workplaceTypes || [],
          industries: roles.industries || [],
          services: roles.services || [],
          locations: roles.locations || []
        },
        recommendations: recommendations
          .map((item) => ({
            id: String(item._id),
            kind: item.kind,
            name: [item.firstName, item.lastName].filter(Boolean).join(" "),
            relationship: item.relationship,
            title: item.recommenderTitle || "",
            organization: item.recommenderOrganization || "",
            text: item.text || "",
            date: item.year ? { month: item.month || null, year: item.year } : null,
            featured: Boolean(item.featured)
          }))
          .sort((a, b) => (b.featured - a.featured) || ((b.date?.year || 0) - (a.date?.year || 0)))
      }
    });
  } catch (error) {
    console.error("Portfolio showcase error:", error);
    return res.status(500).json({ success: false, message: "Unable to load your portfolio" });
  }
};
