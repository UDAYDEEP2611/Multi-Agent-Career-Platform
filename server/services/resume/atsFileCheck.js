const { bulletProblems } = require("./atsRules");

// Checks an uploaded resume file the way an applicant tracking system reads
// it: can the text be read, are the contact details and standard sections
// where a parser looks, do layouts (tables, text boxes, columns, icons)
// get in the way, and do the bullets and keywords hold up.
// Each check is { id, label, status: "pass" | "warn" | "fail", detail }.

const ICON_GLYPHS = /[-�]/g;
const NUMBER = /\d/;
const LONG_BULLET = 300;

const check = (id, label, status, detail) => ({ id, label, status, detail });

// text: the file's text; meta: readResume() details; parsed: parseResumeText()
// output; type: the file's type; keywordScore: the job match's keyword score
function atsFileCheck({ text, meta = {}, parsed, type, keywordScore = null }) {
  const { resume, found } = parsed;
  const contact = resume.contact || {};
  const words = (text.match(/\S+/g) || []).length;
  const bullets = [...resume.experience, ...resume.projects].flatMap((item) => item.bullets);
  const checks = [];

  // The file
  checks.push(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(type)
    ? check("file", "File type", "pass", "PDF and DOCX are read by every major ATS.")
    : check("file", "File type", "warn", "Most ATS accept RTF and TXT, but PDF or DOCX is safer and keeps your layout."));
  checks.push(check("text", "Text can be read", "pass", `${words} words of selectable text.`));

  // Contact details
  const missing = [["email", contact.email], ["phone number", contact.phone]].filter(([, value]) => !value).map(([name]) => name);
  checks.push(!contact.email
    ? check("contact", "Contact details", "fail", "No email address found in the text. Put it in the body, near your name.")
    : missing.length
      ? check("contact", "Contact details", "warn", `No ${missing.join(" or ")} found in the text.`)
      : check("contact", "Contact details", "pass", "Email and phone found in the text."));
  // A clickable "LinkedIn" works for people; an ATS that keeps only the text sees no URL
  checks.push(!contact.linkedin
    ? check("linkedin", "LinkedIn", "warn", "No LinkedIn URL found; recruiters look for it.")
    : contact.linkedinFrom === "link"
      ? check("linkedin", "LinkedIn", "pass", `${contact.linkedin} (behind clickable text). Some ATS keep only the visible text, so writing the URL itself is safest.`)
      : contact.linkedinFrom === "label"
        ? check("linkedin", "LinkedIn", "pass", `${contact.linkedin} (from "LinkedIn: ${contact.linkedin.split("/").pop()}"). Writing the full URL is safest for ATS.`)
        : check("linkedin", "LinkedIn", "pass", contact.linkedin));
  if (meta.headerText && /[\w.+-]+@[\w-]+\.|\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/.test(meta.headerText)) {
    checks.push(check("header", "Contact details in the page header", "fail",
      "Your email or phone is in the Word page header or footer, which many ATS never read. Move it into the body."));
  }

  // Sections a parser looks for by name
  const has = (section) => found.sections.includes(section);
  const recommended = ["summary", "skills"].filter((section) => !has(section));
  checks.push(!has("experience")
    ? check("sections", "Standard section headings", "fail", "No \"Experience\" heading found. Use a plain heading like \"Experience\" or \"Work Experience\".")
    : !has("education")
      ? check("sections", "Standard section headings", "warn", "No \"Education\" heading found.")
      : recommended.length
        ? check("sections", "Standard section headings", "warn", `Found Experience and Education; no ${recommended.map((section) => `"${section[0].toUpperCase()}${section.slice(1)}"`).join(" or ")} heading.`)
        : check("sections", "Standard section headings", "pass", "Summary, Experience, Education and Skills found."));

  // Dates an ATS can read
  const undated = resume.experience.filter((item) => item.organization !== "Resume" && !item.start);
  if (resume.experience.length && found.structured) {
    checks.push(undated.length
      ? check("dates", "Job dates", "warn", `No readable dates for ${undated.map((item) => item.organization).join(", ")}. Use "Jan 2022 – Present" or "01/2022 – 12/2023".`)
      : check("dates", "Job dates", "pass", "Every job has dates an ATS can read."));
  }

  // Layout that confuses parsers
  const layout = [
    meta.tables ? `${meta.tables} table${meta.tables === 1 ? "" : "s"}` : "",
    meta.textBoxes ? `${meta.textBoxes} text box${meta.textBoxes === 1 ? "" : "es"}` : "",
    meta.columns > 1 ? `${meta.columns} columns` : "",
    meta.images ? `${meta.images} image${meta.images === 1 ? "" : "s"} or graphic${meta.images === 1 ? "" : "s"}` : ""
  ].filter(Boolean);
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    checks.push(layout.length
      ? check("layout", "Simple layout", meta.textBoxes ? "fail" : "warn", `Found ${layout.join(", ")}. ATS often read these out of order or skip them; use a single column of plain text.`)
      : check("layout", "Simple layout", "pass", "Single column, no tables, text boxes or images."));
  }
  const icons = (text.match(ICON_GLYPHS) || []).length;
  if (icons) {
    checks.push(check("icons", "Icons and special characters", "warn", `${icons} icon or unreadable character${icons === 1 ? "" : "s"} found (often from icon fonts). Write "Email:" or "Phone:" instead.`));
  }

  // Bullets
  if (!found.structured) {
    checks.push(check("bullets", "Bullet points", "fail", "No bullet points under your jobs were found. List what you did as bullets under each job."));
  } else {
    const firstPerson = bullets.filter((bullet) => bulletProblems(bullet, Infinity).some((problem) => /first-person|weak phrase/.test(problem)));
    checks.push(firstPerson.length
      ? check("bullets", "Bullet points", "warn", `${firstPerson.length} of ${bullets.length} bullets start with "I", "responsible for" or another weak phrase; start with an action verb.`)
      : check("bullets", "Bullet points", "pass", `${bullets.length} bullets, each starting with an action.`));
    const long = bullets.filter((bullet) => bullet.length > LONG_BULLET).length;
    if (long) checks.push(check("bulletLength", "Bullet length", long / bullets.length > 0.25 ? "warn" : "pass", `${long} bullet${long === 1 ? " runs" : "s run"} past 3 lines; keep each to 1–3 lines.`));
    const measured = bullets.filter((bullet) => NUMBER.test(bullet)).length;
    const share = bullets.length ? Math.round((100 * measured) / bullets.length) : 0;
    checks.push(check("results", "Measured results", share >= 30 ? "pass" : "warn", `${share}% of bullets include a number (results, scale, counts); aim for at least a third.`));
  }

  // Length
  const pages = meta.pages;
  checks.push(pages > 2
    ? check("length", "Length", "warn", `${pages} pages; keep it to 1–2.`)
    : words < 250
      ? check("length", "Length", "warn", `${words} words is short; most resumes have 400–900.`)
      : words > 1200
        ? check("length", "Length", "warn", `${words} words is long; aim for 400–900 (1–2 pages).`)
        : check("length", "Length", "pass", `${pages ? `${pages} page${pages === 1 ? "" : "s"}, ` : ""}${words} words.`));

  // How well the wording matches the job (the ATS ranks on this)
  if (keywordScore !== null) {
    checks.push(check("keywords", "Job keyword match", keywordScore >= 70 ? "pass" : keywordScore >= 40 ? "warn" : "fail",
      `${keywordScore}% of the job's keywords are on the resume. See the Job match tab for which ones are missing.`));
  }

  const points = { pass: 1, warn: 0.5, fail: 0 };
  const score = Math.round((100 * checks.reduce((sum, item) => sum + points[item.status], 0)) / checks.length);
  return { score, checks };
}

module.exports = { atsFileCheck };
