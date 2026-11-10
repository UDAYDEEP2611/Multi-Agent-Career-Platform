const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");
const summaryRoutes = require("./routes/summaryRoutes");
const profileRoutes = require("./routes/profileRoutes");
const experienceRoutes = require("./routes/experienceRoutes");
const experienceTaskRoutes = require("./routes/experienceTaskRoutes");
const experienceSkillRoutes = require("./routes/experienceSkillRoutes");
const experienceMediaRoutes = require("./routes/experienceMediaRoutes");
const experienceAchievementRoutes = require("./routes/experienceAchievementRoutes");
const experienceVolunteeringRoutes = require("./routes/experienceVolunteeringRoutes");
const experienceRecordRoutes = require("./routes/experienceRecordRoutes");
const experienceProjectRoutes = require("./routes/experienceProjectRoutes");
const experienceProjectTaskRoutes = require("./routes/experienceProjectTaskRoutes");
const experienceProjectContributorRoutes = require("./routes/experienceProjectContributorRoutes");
const experienceProjectSkillRoutes = require("./routes/experienceProjectSkillRoutes");
const experienceProjectMediaRoutes = require("./routes/experienceProjectMediaRoutes");
const educationRoutes = require("./routes/educationRoutes");
const userSkillRoutes = require("./routes/userSkillRoutes");
const skillCatalogRoutes = require("./routes/skillCatalogRoutes");
const skillAssociationRoutes = require("./routes/skillAssociationRoutes");
const projectRoutes = require("./routes/projectRoutes");
const certificationRoutes = require("./routes/certificationRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const volunteeringRoutes = require("./routes/volunteeringRoutes");
const achievementRoutes = require("./routes/achievementRoutes");
const interestRoutes = require("./routes/interestRoutes");
const publicationRoutes = require("./routes/publicationRoutes");
const patentRoutes = require("./routes/patentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const portfolioRoutes = require("./routes/portfolioRoutes");
const chatRoutes = require("./routes/chatRoutes");
const draftRoutes = require("./routes/draftRoutes");
const customDesignRoutes = require("./routes/customDesignRoutes");
const resumeSettingsRoutes = require("./routes/resumeSettingsRoutes");
const visibilityRoutes = require("./routes/visibilityRoutes");
const resumeChatRoutes = require("./routes/resumeChatRoutes");
const agentChangeRoutes = require("./routes/agentChangeRoutes");
const accountRoutes = require("./routes/accountRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const contactRoutes = require("./routes/contactRoutes");

// Builds the Express app without connecting to MongoDB or listening.
// options.sessionStore: replace the MongoDB session store (tests)
// options.enableTestAuth: add POST /__test/login (NODE_ENV=test only)
function createApp(options = {}) {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";

  // Required when deployed behind a reverse proxy
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  // CORS middleware
  app.use(
    cors({
      origin: process.env.CLIENT_URL,
      credentials: true
    })
  );

  // Parse incoming JSON
  app.use(express.json({ limit: "1mb" }));

  // Session middleware
  app.use(
    session({
      name: "portfolio.sid",

      secret: process.env.SESSION_SECRET,

      resave: false,

      saveUninitialized: false,

      store:
        options.sessionStore ||
        MongoStore.create({
          clientPromise: mongoose.connection
            .asPromise()
            .then((connection) => connection.getClient()),
          collectionName: "sessions"
        }),

      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000
      }
    })
  );

  // Signs in as any user ID so tests can act as several users.
  // Refuses to exist outside NODE_ENV=test.
  if (options.enableTestAuth === true) {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("Test authentication is only allowed in test mode");
    }

    app.post("/__test/login", (req, res) => {
      const userId = req.body?.userId;

      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid test user ID"
        });
      }

      req.session.regenerate((error) => {
        if (error) {
          return res.status(500).json({
            success: false,
            message: "Session creation failed"
          });
        }

        req.session.userId = userId;

        req.session.save((saveError) => {
          if (saveError) {
            return res.status(500).json({
              success: false,
              message: "Session save failed"
            });
          }

          return res.json({ success: true });
        });
      });
    });
  }

  // Health check
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      success: true,
      message: "AgenticAgentPortfolioSystem API is running"
    });
  });

  // Uploaded files are only served through authenticated endpoints;
  // there is intentionally no express.static("uploads").
  app.use("/api/auth", authRoutes);
  app.use("/api/summary", summaryRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/experiences", experienceRoutes);
  app.use(
    "/api/experiences/:experienceId/tasks",
    experienceTaskRoutes
  );
  app.use(
    "/api/experiences/:experienceId/skills",
    experienceSkillRoutes
  );
  app.use(
    "/api/experiences/:experienceId/media",
    experienceMediaRoutes
  );
  app.use(
    "/api/experiences/:experienceId/achievements",
    experienceAchievementRoutes
  );
  app.use(
    "/api/experiences/:experienceId/volunteering",
    experienceVolunteeringRoutes
  );
  app.use(
    "/api/experiences/:experienceId/records",
    experienceRecordRoutes
  );
  app.use(
    "/api/experiences/:experienceId/projects",
    experienceProjectRoutes
  );
  app.use(
    "/api/experiences/:experienceId/projects/:projectId/tasks",
    experienceProjectTaskRoutes
  );
  app.use(
    "/api/experiences/:experienceId/projects/:projectId/contributors",
    experienceProjectContributorRoutes
  );
  app.use(
    "/api/experiences/:experienceId/projects/:projectId/skills",
    experienceProjectSkillRoutes
  );
  app.use(
    "/api/experiences/:experienceId/projects/:projectId/media",
    experienceProjectMediaRoutes
  );
  app.use("/api/educations", educationRoutes);
  app.use("/api/skills", userSkillRoutes);
  app.use("/api/skill-catalog", skillCatalogRoutes);
  app.use("/api/skill-associations", skillAssociationRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/certifications", certificationRoutes);
  app.use("/api/recommendations", recommendationRoutes);
  app.use("/api/volunteering", volunteeringRoutes);
  app.use("/api/achievements", achievementRoutes);
  app.use("/api/interests", interestRoutes);
  app.use("/api/publications", publicationRoutes);
  app.use("/api/patents", patentRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/portfolio", portfolioRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/drafts", draftRoutes);
  app.use("/api/custom-designs", customDesignRoutes);
  app.use("/api/resume-settings", resumeSettingsRoutes);
  app.use("/api/visibility", visibilityRoutes);
  app.use("/api/resume-chat", resumeChatRoutes);
  app.use("/api/agent-changes", agentChangeRoutes);
  app.use("/api/account", accountRoutes);
  app.use("/api/resume", resumeRoutes);
  app.use("/api/contact", contactRoutes);

  // In production the server also hosts the built app, so sign-in cookies stay
  // first-party in every browser. Anything that isn't /api is an app page.
  const clientBuild = path.join(__dirname, "..", "client", "dist");
  if (isProduction && fs.existsSync(path.join(clientBuild, "index.html"))) {
    app.use(express.static(clientBuild));
    app.get(/^\/(?!api(\/|$)).*/, (req, res) => res.sendFile(path.join(clientBuild, "index.html")));
  }

  // Handle unknown routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "API endpoint not found"
    });
  });

  // General error handler
  app.use((error, req, res, next) => {
    console.error("Server error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  });

  return app;
}

module.exports = createApp;
