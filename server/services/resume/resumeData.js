const Profile = require("../../models/Profile");
const Summary = require("../../models/Summary");
const Experience = require("../../models/Experience");
const Education = require("../../models/Education");
const Project = require("../../models/Project");
const UserSkill = require("../../models/UserSkill");
const Certification = require("../../models/Certification");
const Achievement = require("../../models/Achievement");
const Volunteering = require("../../models/Volunteering");
const Publication = require("../../models/Publication");
const Patent = require("../../models/Patent");
const Interest = require("../../models/Interest");
const SkillAssociation = require("../../models/SkillAssociation");
const { shownIn } = require("../../models/plugins/visibility");

// Gathers the signed-in user's portfolio into the plain shape the resume
// builder uses. Must run inside a signed-in request (user database).
// Personal details (birth date, gender, ...) are left out on purpose:
// they don't belong on a resume and ATS guidance says to omit them.

const when = (month, year) => (year ? { month: month || null, year } : null);

const byOrder = (list = []) => [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const lines = (text) =>
  String(text || "")
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-•*▪◦]\s*/, "").trim())
    .filter(Boolean);

// Newest first: current roles, then by end date, then by start date
const dateValue = (date) => (date ? date.year * 12 + (date.month || 12) : 0);
const newestFirst = (a, b) =>
  (b.current - a.current) ||
  (dateValue(b.end) - dateValue(a.end)) ||
  (dateValue(b.start) - dateValue(a.start));

function contactFrom(profile, account) {
  const contact = profile?.contact || {};
  const name = [contact.firstName, contact.middleName, contact.lastName, contact.suffix]
    .filter(Boolean)
    .join(" ");

  return {
    name: name || account.username,
    email: contact.email || account.email,
    phone: contact.phoneNumber || "",
    location: [contact.city, contact.stateProvince, contact.country].filter(Boolean).join(", "),
    linkedin: contact.linkedinUrl || "",
    github: contact.githubUrl || "",
    portfolio: contact.portfolioUrl || ""
  };
}

function nestedProject(project, source) {
  return {
    id: String(project._id),
    title: project.title,
    role: "",
    source,
    start: when(project.startMonth, project.startYear),
    end: when(project.endMonth, project.endYear),
    current: false,
    description: project.description || "",
    bullets: byOrder(project.tasks).map((task) => task.description),
    skills: byOrder(project.skills).map((skill) => skill.name),
    link: ""
  };
}

// "2024-05-17" -> { month: 5, year: 2024 }
const fromCalendar = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}/.test(value)
    ? { month: Number(value.slice(5, 7)), year: Number(value.slice(0, 4)) }
    : null;

const newestDateFirst = (a, b) => dateValue(b.date) - dateValue(a.date);

// The optional sections. Every item has { id, title, subtitle, date, ... }
// so the resume can list them the same way.
function extraSections({ certifications, achievements, volunteering, publications, patents, interests }) {
  return {
    certifications: certifications.map((item) => ({
      id: String(item._id),
      title: item.name,
      subtitle: item.issuingOrganization || "",
      date: when(item.issueMonth, item.issueYear),
      detail: item.credentialId ? `Credential ID ${item.credentialId}` : ""
    })).sort(newestDateFirst),

    achievements: achievements.map((item) => ({
      id: String(item._id),
      title: item.title,
      subtitle: [item.issuer, item.result].filter(Boolean).join(", "),
      date: when(item.month, item.year),
      description: item.description || "",
      featured: Boolean(item.featured)
    })).sort((a, b) => (b.featured - a.featured) || newestDateFirst(a, b)),

    volunteering: volunteering.map((item) => ({
      id: String(item._id),
      title: item.role,
      subtitle: item.organization,
      cause: item.cause || "",
      start: when(item.startMonth, item.startYear),
      end: item.currentlyVolunteering ? null : when(item.endMonth, item.endYear),
      current: Boolean(item.currentlyVolunteering),
      description: item.description || ""
    })).sort(newestFirst),

    publications: publications.map((item) => ({
      id: String(item._id),
      title: item.title,
      subtitle: item.publisher || "",
      date: fromCalendar(item.publishedOn),
      detail: item.url || ""
    })).sort(newestDateFirst),

    patents: patents.map((item) => ({
      id: String(item._id),
      title: item.title,
      subtitle: [item.patentNumber, item.status].filter(Boolean).join(", "),
      date: fromCalendar(item.date),
      detail: item.url || ""
    })).sort(newestDateFirst),

    interests: interests.map((item) => ({
      id: String(item._id),
      title: item.name,
      subtitle: item.category || ""
    }))
  };
}

// audience: "portfolio" or "resume" leaves out the entries switched off
// for it (Show in portfolio / Show in resume); left out, everything is kept
async function gatherResumeData(userId, account, { audience } = {}) {
  const loaded = await Promise.all([
    Profile.findOne({ userId }).lean(),
    Summary.findOne({ userId }).lean(),
    Experience.find({ userId }).lean(),
    Education.find({ userId }).lean(),
    Project.find({ userId }).lean(),
    UserSkill.find({ userId }).lean(),
    Certification.find({ userId }).lean(),
    Achievement.find({ userId }).lean(),
    Volunteering.find({ userId }).lean(),
    Publication.find({ userId }).lean(),
    Patent.find({ userId }).lean(),
    Interest.find({ userId }).lean()
  ]);
  const [profile, summary, ...lists] = loaded;
  const [
    experiences, educations, projects, skills,
    certifications, achievements, volunteering, publications, patents, interests
  ] = lists.map((list) => list.filter((entry) => shownIn(entry, audience)));

  // Skills linked to projects on the Skills page, by project ID
  const skillNames = new Map(skills.map((skill) => [String(skill._id), skill.name]));
  const links = await SkillAssociation.find({
    userId,
    sourceType: { $in: ["project", "experience_project", "education_project"] }
  }).lean();
  const linkedSkills = new Map();
  links.forEach((link) => {
    const name = skillNames.get(String(link.skillId));
    if (!name) return;
    const key = String(link.sourceId);
    linkedSkills.set(key, [...(linkedSkills.get(key) || []), name]);
  });
  const withLinked = (project) => {
    const linked = linkedSkills.get(project.id) || [];
    return { ...project, skills: [...new Set([...project.skills, ...linked])] };
  };

  const allProjects = [];

  const experienceItems = experiences.map((item) => {
    const source = `${item.jobTitle} · ${item.organization}`;
    const shownProjects = (item.projects || []).filter((project) => shownIn(project, audience));
    shownProjects.forEach((project) => allProjects.push(nestedProject(project, source)));

    return {
      id: String(item._id),
      title: item.jobTitle,
      organization: item.organization,
      // Just the place; the location type (Remote, Hybrid...) isn't shown
      location: item.location || "",
      employmentType: item.employmentType || "",
      start: when(item.startMonth, item.startYear),
      end: item.currentlyWorking ? null : when(item.endMonth, item.endYear),
      current: Boolean(item.currentlyWorking),
      summary: item.summary || "",
      highlights: item.highlights || "",
      bullets: byOrder(item.tasks).map((task) => task.description),
      skills: byOrder(item.skills).map((skill) => skill.name),
      // Projects done in this job: more facts for the bullet writer
      projects: shownProjects.map((project) => ({
        title: project.title,
        description: project.description || "",
        tasks: byOrder(project.tasks).map((task) => task.description)
      }))
    };
  }).sort(newestFirst);

  const educationItems = educations.map((item) => {
    const source = `${item.degree || "Education"} · ${item.institution}`;
    (item.projects || []).filter((project) => shownIn(project, audience)).forEach((project) => allProjects.push(nestedProject(project, source)));

    return {
      id: String(item._id),
      institution: item.institution,
      degree: item.degree || "",
      fieldOfStudy: item.fieldOfStudy || "",
      location: item.location || "",
      start: when(item.startMonth, item.startYear),
      end: item.currentlyStudying ? null : when(item.endMonth, item.endYear),
      current: Boolean(item.currentlyStudying),
      grade: item.grade || "",
      description: item.description || "",
      bullets: byOrder(item.tasks).map((task) => task.description),
      courses: byOrder(item.courses).map((course) => course.name)
    };
  }).sort(newestFirst);

  projects.forEach((project) => {
    const link = byOrder(project.links).find((entry) => ["GitHub", "Demo"].includes(entry.linkType))
      || byOrder(project.links)[0];

    allProjects.push({
      id: String(project._id),
      title: project.title,
      role: project.role || "Creator/Developer",
      source: `${project.projectType || "Personal"} project`,
      start: when(project.startMonth, project.startYear),
      end: project.ongoing ? null : when(project.endMonth, project.endYear),
      current: Boolean(project.ongoing),
      description: project.description || "",
      bullets: byOrder(project.tasks).map((task) => task.description),
      skills: [],
      link: link?.url || "",
      featured: Boolean(project.featured)
    });
  });

  allProjects.sort((a, b) => (Boolean(b.featured) - Boolean(a.featured)) || newestFirst(a, b));
  const projectItems = allProjects.map(withLinked);

  const skillItems = skills
    .map((skill) => ({
      id: String(skill._id),
      name: skill.name,
      skillType: skill.skillType,
      rating: skill.rating,
      isImportant: Boolean(skill.isImportant),
      sortOrder: skill.sortOrder
    }))
    .sort((a, b) =>
      (b.isImportant - a.isImportant) ||
      ((a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)) ||
      (b.rating - a.rating)
    )
    .map(({ sortOrder, ...skill }) => skill);

  return {
    contact: contactFrom(profile, account),
    summary: summary?.content || "",
    experiences: experienceItems,
    educations: educationItems,
    projects: projectItems,
    skills: skillItems,
    ...extraSections({ certifications, achievements, volunteering, publications, patents, interests })
  };
}

module.exports = { gatherResumeData, lines };
