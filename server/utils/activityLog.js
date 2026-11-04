const mongoose = require("mongoose");
const { prepareUserDatabase, runAsUser } = require("./userDatabase");

// Records entries in a user's own activity log (models/ActivityLog.js).
// Logging never fails the request it describes.

const SECTION_NAMES = {
  profile: "Profile",
  summary: "Summary",
  experiences: "Experience",
  educations: "Education",
  projects: "Projects",
  skills: "Skills",
  "skill-associations": "Skill links",
  certifications: "Certifications",
  recommendations: "Recommendations",
  volunteering: "Volunteering",
  achievements: "Achievements",
  interests: "Interests",
  publications: "Publications",
  patents: "Patents",
  tasks: "Tasks",
  media: "Media",
  contributors: "Contributors",
  links: "Links",
  records: "Records",
  files: "Files",
  courses: "Coursework",
  certificationsHonors: "Certifications & Honors"
};

const titleCase = (segment) =>
  SECTION_NAMES[segment] ||
  segment.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const isId = (segment) => /^[a-f0-9]{24}$/i.test(segment);

// "/api/experiences/<id>/projects/<id>/tasks" -> "Experience › Projects › Tasks"
// IDs and action words ("upload", "order", and "links" after "media", as in
// adding a media link) aren't part of the section name.
function sectionFromPath(path) {
  const segments = path.replace(/^\/api\//, "").split("/").filter(Boolean);

  return segments
    .filter((segment, index) =>
      !isId(segment) &&
      !["upload", "order", "download"].includes(segment) &&
      !(segment === "links" && segments[index - 1] === "media")
    )
    .map(titleCase)
    .join(" › ");
}

function actionFor(method, path) {
  if (/\/order$/.test(path)) return "reordered";
  if (/\/upload$/.test(path)) return "uploaded";
  if (method === "POST") return "created";
  if (method === "DELETE") return "deleted";
  return "updated";
}

// A readable name for the saved item, taken from the response body
function labelFrom(body) {
  if (!body || typeof body !== "object") return "";

  for (const value of Object.values(body)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const name =
        value.title || value.name || value.jobTitle || value.role ||
        value.institution || value.description ||
        [value.firstName, value.lastName].filter(Boolean).join(" ");

      if (typeof name === "string" && name.trim()) return name.trim().slice(0, 200);
    }
  }

  return "";
}

const clientInfo = (req) => ({
  ip: String(req.ip || "").slice(0, 64),
  userAgent: String(req.get?.("user-agent") || "").slice(0, 300)
});

async function recordActivity(userId, entry) {
  try {
    await prepareUserDatabase(userId);
    const ActivityLog = require("../models/ActivityLog");

    await runAsUser(userId, () =>
      ActivityLog.create({ userId: new mongoose.Types.ObjectId(String(userId)), ...entry })
    );
  } catch (error) {
    console.error("Activity log error:", error);
  }
}

// Sign-in events for a regular user (admins have no database)
const recordAuthEvent = (req, userId, action, label = "") =>
  recordActivity(userId, { kind: "auth", action, label, ...clientInfo(req) });

// Middleware for portfolio routes: after a successful change, records what
// was created, updated or deleted. Hooks each request once.
function trackChanges(req, res) {
  if (req.activityTracked || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return;
  req.activityTracked = true;

  const path = req.originalUrl.split("?")[0];

  // Checks, building a resume and the activity log itself aren't changes
  if (/\/api\/skills\/check$/.test(path) || path.startsWith("/api/account") || path.startsWith("/api/resume")) return;

  let body;
  const json = res.json.bind(res);
  res.json = (payload) => {
    body = payload;
    return json(payload);
  };

  const userId = req.session.userId;

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    recordActivity(userId, {
      kind: "data",
      action: actionFor(req.method, path),
      section: sectionFromPath(path),
      label: req.method === "DELETE" ? "" : labelFrom(body),
      method: req.method,
      path,
      ...clientInfo(req)
    });
  });
}

module.exports = { recordActivity, recordAuthEvent, trackChanges, sectionFromPath };
