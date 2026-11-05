// JobPilot in the demo: the server's own rule-based matching, run in the
// browser on a resume written from the demo person's details. No AI.
import compareModule from "../../../server/services/match/resumeCompare.js";
import jobInfoModule from "../../../server/services/match/jobInfo.js";
import parserModule from "../../../server/services/resume/resumeParser.js";
import fileCheckModule from "../../../server/services/resume/atsFileCheck.js";
import recommendationsModule from "../../../server/services/match/recommendations.js";

const { compareResume } = compareModule;
const { parseResumeText } = parserModule;
const { atsFileCheck } = fileCheckModule;
const { recommendationsFor } = recommendationsModule;

export const { jobInfoOf } = jobInfoModule;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DEMO_NOTE = "This demo checks with rules only, without AI, so results can differ from the full app.";

const date = (value) => (value ? `${value.month ? `${MONTHS[value.month - 1]} ` : ""}${value.year}` : "");
const dates = (entry) => `${date(entry.start)} - ${entry.current ? "Present" : date(entry.end)}`;
const bullets = (list = []) => list.map((line) => `• ${line}`);

// sources: the same shape as the server's resume data
export function resumeText(sources) {
  const { contact } = sources;
  const blocks = [
    [contact.name, [contact.email, contact.phone, contact.location].filter(Boolean).join(" | "), [contact.linkedin, contact.github, contact.portfolio].filter(Boolean).join(" | ")],
    ["SUMMARY", sources.summary],
    ["EXPERIENCE", ...sources.experiences.flatMap((job) => [`${job.title}, ${job.organization}${job.location ? `, ${job.location}` : ""} | ${dates(job)}`, job.summary, ...bullets(job.bullets), ""])],
    ["EDUCATION", ...sources.educations.flatMap((school) => [`${school.degree} ${school.fieldOfStudy}, ${school.institution} | ${dates(school)}`, school.grade, ...bullets(school.bullets), ""])],
    ["SKILLS", sources.skills.map((skill) => skill.name).join(", ")],
    ["PROJECTS", ...sources.projects.flatMap((project) => [`${project.title} | ${dates(project)}`, project.description, ...bullets(project.bullets), ""])],
    ["CERTIFICATIONS", ...sources.certifications.map((item) => `${item.title}, ${item.subtitle}${item.date ? ` | ${date(item.date)}` : ""}`)]
  ];
  return blocks.filter((block) => block.length > 1).map((block) => block.filter((line) => line !== undefined).join("\n").trim()).join("\n\n");
}

// { resume, found, match, ats, recommendations, notes, aiUsed }
export async function runCheck({ text, jobDescription, company = "", jobTitle = "", confirmations, previous }) {
  const parsed = parseResumeText(text, { links: [] });
  const { resume, found } = parsed;
  const details = { resume, jobDescription, jobTitle, company, llm: null };
  const answered = confirmations && Object.keys(confirmations).length > 0;
  const resumeOnly = await compareResume(details);
  const match = answered ? await compareResume({ ...details, confirmations }) : resumeOnly;
  if (answered) match.resumeOnly = { overall: resumeOnly.overall, fit: resumeOnly.fit, classification: resumeOnly.classification };
  const ats = previous?.ats || atsFileCheck({ text, meta: {}, parsed, type: "text/plain", keywordScore: match.keywords.score });
  return {
    resume,
    found,
    match,
    ats,
    recommendations: recommendationsFor(match, ats),
    notes: [...match.notes, DEMO_NOTE],
    aiUsed: false,
    resumeOnlyOverall: resumeOnly.overall
  };
}
