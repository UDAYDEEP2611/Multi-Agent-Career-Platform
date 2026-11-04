import { EXTRA_SECTIONS } from "./resumeTemplates";

// Plain-text copy of a built resume: the safest format for pasting into
// application forms and ATS text boxes

const contactLine = (contact) =>
  [contact.email, contact.phone, contact.location, contact.linkedin, contact.github, contact.portfolio]
    .filter(Boolean)
    .join(" | ");

export const degreeLine = (item) =>
  [item.degree, item.fieldOfStudy].filter(Boolean).join(", ");

export function resumeToText(resume) {
  const out = [resume.contact.name.toUpperCase(), contactLine(resume.contact), ""];
  const heading = (title) => out.push(title.toUpperCase(), "");

  if (resume.sections.summary && resume.summary) {
    heading("Professional Summary");
    out.push(resume.summary, "");
  }

  if (resume.experience.length) {
    heading("Experience");
    resume.experience.forEach((item) => {
      out.push(`${item.title} | ${item.organization}${item.location ? ` | ${item.location}` : ""}`);
      if (item.dates) out.push(item.dates);
      item.bullets.forEach((bullet) => out.push(`• ${bullet}`));
      out.push("");
    });
  }

  if (resume.projects.length) {
    heading("Projects");
    resume.projects.forEach((item) => {
      out.push([item.title, item.dates].filter(Boolean).join(" | "));
      item.bullets.forEach((bullet) => out.push(`• ${bullet}`));
      out.push("");
    });
  }

  if (resume.education.length) {
    heading("Education");
    resume.education.forEach((item) => {
      out.push([degreeLine(item), item.institution].filter(Boolean).join(" | "));
      out.push([item.location, item.dates, item.grade && `GPA/Grade: ${item.grade}`].filter(Boolean).join(" | "));
      item.bullets.forEach((bullet) => out.push(`• ${bullet}`));
      if (item.courses.length) out.push(`Relevant coursework: ${item.courses.join(", ")}`);
      out.push("");
    });
  }

  const { technical, soft, groups } = resume.skills;
  if (technical.length || soft.length) {
    heading("Technical Skills");
    (groups || [{ label: "Technical", skills: technical }, { label: "Professional Skills", skills: soft }])
      .filter((group) => group.skills.length)
      .forEach((group) => out.push(`• ${group.label}: ${group.skills.join(", ")}`));
  }

  const extras = resume.extras || {};
  EXTRA_SECTIONS.forEach(({ key, title }) => {
    const items = extras[key] || [];
    if (!items.length) return;

    out.push("");
    heading(title);
    if (key === "interests") {
      out.push(items.join(", "));
      return;
    }
    if (key === "certifications") {
      items.forEach((item) => out.push(`• ${item.title}`));
      return;
    }
    items.forEach((item) => {
      out.push([[item.title, item.subtitle].filter(Boolean).join(", "), item.dates].filter(Boolean).join(" | "));
      if (item.detail) out.push(item.detail);
      item.bullets.forEach((bullet) => out.push(`• ${bullet}`));
    });
  });

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export { contactLine };
