const JSZip = require("jszip");
const { PDFParse } = require("pdf-parse");
const { dictionaryKeywords } = require("./skillDictionary");

// Reads an uploaded resume (PDF or DOCX) into the same shape the resume
// builder produces, so the job-match code can score it. Plain rules, no AI:
// sections by their headings, jobs by their date ranges, bullets by line.

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const decodeXml = (text) => text
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// RTF stores non-ASCII as Windows-1252 bytes: 0x96 is an en dash, not a control character
const CP1252 = { 0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ" };
const cp1252 = (code) => CP1252[code] || String.fromCharCode(code);

// RTF to plain text: paragraphs become lines, formatting codes are dropped
function rtfText(rtf) {
  return rtf
    // Font, color and style tables, document info: not text
    .replace(/\{\\(fonttbl|colortbl|stylesheet|info)(?:[^{}]|\{[^{}]*\})*\}/g, "")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => cp1252(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, code) => String.fromCharCode((Number(code) + 65536) % 65536))
    .replace(/\\(par|line)\b ?/g, "\n")
    .replace(/\\tab\b ?/g, "\t")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\\([\\{}])/g, "$1");
}

// The text of a PDF, DOCX, RTF or plain-text resume, one paragraph or
// visual line per line
const docxText = (xml) => decodeXml(xml
  .replace(/<w:tab\/>/g, "\t")
  .replace(/<w:br\/>|<\/w:p>/g, "\n")
  .replace(/<[^>]+>/g, ""));

// The resume's text plus what an ATS cares about in the file itself:
// { text, meta: { pages, tables, images, textBoxes, columns, headerText, links } }
// links: [{ url, text }] behind clickable text ("LinkedIn" that opens the profile)
async function readResume(buffer, type) {
  if (type === "text/plain") return { text: buffer.toString("utf8"), meta: {} };
  if (type === "application/rtf") return { text: rtfText(buffer.toString("latin1")), meta: {} };
  if (type === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      // Link annotations: the URL behind "LinkedIn: jane-doe"
      let links = [];
      try {
        const info = await parser.getInfo({ parsePageInfo: true });
        links = (info.pages || []).flatMap((page) => page.links || []).filter((link) => typeof link?.url === "string").map((link) => ({ url: link.url, text: String(link.text || "").trim() }));
      } catch {
        // Text is enough to compare; links are a bonus
      }
      return { text: result.text, meta: { pages: result.total ?? result.pages?.length, links } };
    } finally {
      await parser.destroy();
    }
  }
  if (type === DOCX) {
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml").async("string");
    // Page headers and footers: many ATS never read them
    const headerFiles = zip.file(/^word\/(header|footer)\d*\.xml$/);
    const headerText = (await Promise.all(headerFiles.map((file) => file.async("string")))).map(docxText).join("\n").trim();
    // Hyperlinks: <w:hyperlink r:id="rId5"> text, with the URL in the relationships file
    const rels = await zip.file("word/_rels/document.xml.rels")?.async("string") || "";
    const targets = Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [
      (tag.match(/\bId="([^"]+)"/) || [])[1], /TargetMode="External"/.test(tag) ? decodeXml((tag.match(/\bTarget="([^"]+)"/) || [])[1] || "") : ""
    ]));
    const links = [...xml.matchAll(/<w:hyperlink\b[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g)]
      .map(([, id, inner]) => ({ url: targets[id] || "", text: decodeXml([...inner.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) => match[1]).join("")).trim() }))
      .filter((link) => link.url);
    return {
      text: docxText(xml),
      meta: {
        tables: (xml.match(/<w:tbl>/g) || []).length,
        images: (xml.match(/<w:drawing>|<w:pict>/g) || []).length,
        textBoxes: (xml.match(/<w:txbxContent>/g) || []).length,
        columns: Math.max(1, ...[...xml.matchAll(/<w:cols [^>]*w:num="(\d+)"/g)].map((match) => Number(match[1]))),
        headerText,
        links
      }
    };
  }
  throw new Error(`Unsupported type ${type}`);
}

const extractResumeText = async (buffer, type) => (await readResume(buffer, type)).text;

const SECTIONS = [
  ["summary", /^(professional |career |executive )?(summary|profile|objective|about me)$/i],
  ["experience", /^((work|professional|employment|relevant) )?(experience|history)$/i],
  ["projects", /^((academic|personal|key|selected) )?projects$/i],
  ["education", /^education( & training)?$/i],
  ["skills", /^((technical|core|key) )?(skills|competencies)( & tools| and tools)?$|^technologies$/i],
  ["certifications", /^((professional )?(licenses|licences)( (&|and) certifications)?|(professional )?(certifications?|certificates?)( (&|and) (licenses|licences|training))?|credentials)$/i],
  ["other", /^(achievements|awards|honors|publications|volunteer(ing)?|interests|languages|patents|references)$/i]
];

const BULLET = /^[•●▪◦‣∙·\-*–]\s*/;
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const DATE = `(?:${MONTH}\\s+\\d{4}|\\d{1,2}\\/\\d{4}|\\d{4})`;
const RANGE = new RegExp(`(${DATE})\\s*(?:–|—|-|to)\\s*(${DATE}|present|current|now|till date)`, "i");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "Sep 2021" -> { year: 2021, month: 9 }
function parseDate(text) {
  const year = Number((text.match(/\d{4}/) || [])[0]);
  if (!year) return null;
  const slash = text.match(/^(\d{1,2})\//);
  const name = MONTHS.findIndex((month) => text.toLowerCase().startsWith(month));
  const month = slash ? Number(slash[1]) : name >= 0 ? name + 1 : undefined;
  return month ? { year, month } : { year };
}

const headingOf = (line) => {
  const text = line.replace(/[:\s]+$/, "").trim();
  if (text.length > 40 || BULLET.test(line)) return null;
  return (SECTIONS.find(([, pattern]) => pattern.test(text)) || [])[0] || null;
};

// A short line that names something (a company, title, project), not a sentence
const looksLikeHeader = (line) => line.length <= 90 && !/[.;]$/.test(line) && !BULLET.test(line);

const cleanHeader = (text) => text.replace(RANGE, "").replace(/\s*[|,–—-]\s*$/, "").replace(/^\s*[|,–—-]\s*/, "").replace(/\s{2,}/g, " ").trim();

// A bullet line that stops mid-phrase: the next line continues it
const UNFINISHED = /(?:[,(&/–-]|\b(?:a|an|the|and|or|of|to|in|on|for|with|by|via|using|from|into|that|which|at|as|across|over|under|within))$/i;

// Splits a section into entries: header lines, dates, bullets. Wrapped
// bullet lines (common in PDFs) are joined back onto their bullet.
function entriesOf(lines, { byDates }) {
  const entries = [];
  let current = null;
  let pending = [];
  const startEntry = (header, range) => {
    current = { header: header.filter(Boolean), range, bullets: [] };
    entries.push(current);
  };

  lines.forEach((line, index) => {
    const range = line.match(RANGE);
    const upcomingDate = lines.slice(index + 1, index + 3).some((next) => RANGE.test(next));
    const lastBullet = current?.bullets[current.bullets.length - 1];

    if (lastBullet && !range && !BULLET.test(line) && (/^[a-z(&,]/.test(line) || UNFINISHED.test(lastBullet))) {
      // A wrapped line continues the bullet above, even right before the next
      // job's dates (otherwise it would be read as that job's employer)
      current.bullets[current.bullets.length - 1] += ` ${line}`;
    } else if (BULLET.test(line)) {
      if (!current) startEntry(pending, null);
      pending = [];
      current.bullets.push(line.replace(BULLET, "").trim());
    } else if (range && byDates) {
      startEntry([...pending, cleanHeader(line)], range);
      pending = [];
    } else if (current && !current.bullets.length && current.header.length < (current.range ? 2 : 3) && looksLikeHeader(line) && !UNFINISHED.test(line)) {
      // Under the dates, a title and employer are already read: a third line
      // is the first bullet (PDFs drop unstyled bullet marks), and a line that
      // stops mid-phrase always is
      current.header.push(cleanHeader(line));
    } else if (byDates ? upcomingDate : looksLikeHeader(line) && (!current || current.bullets.length)) {
      if (byDates) pending.push(cleanHeader(line));
      else startEntry([cleanHeader(line), ...pending], range);
    } else {
      if (!current) startEntry(pending, null);
      pending = [];
      current.bullets.push(line);
    }
  });

  return entries.filter((entry) => entry.header.length || entry.bullets.length);
}

const SKILL_SPLIT = /\s*[,;|•·]\s*/;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const LINKEDIN = /(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\/[\w%-]+\/?/i;
const GITHUB = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?/i;
const URL = /(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|io|dev|me|net|org)\b\S*/i;

// Name, links and the role line from the top of the resume. The role is the
// line under the name that isn't contact details ("AI/LLM Engineer"),
// else the latest job title.
// "LinkedIn: jane-doe" / "GitHub: janedoe" written as text, no URL
const LINKEDIN_LABEL = /\blinked\s?in\s*[:|-]?\s*(?:\/in\/)?([a-z0-9][\w-]{2,99})\b/i;
const GITHUB_LABEL = /\bgithub\s*[:|-]?\s*@?([a-z0-9][\w-]{0,38})\b/i;
const PORTFOLIO_SKIP = /linkedin\.com|github\.com|mailto:|tel:/i;

// links: URLs behind clickable text in the file (readResume meta.links)
// *From: "text" (the URL is written out), "link" (clickable text opens it) or
// "label" (only "LinkedIn: handle" is written; the URL is built from it)
function contactOf(headerLines, text, experience, links = []) {
  const find = (pattern) => (text.match(pattern) || [""])[0].replace(/[),.;]+$/, "");
  const linked = (pattern) => (links.find((link) => pattern.test(link.url))?.url || "").replace(/[),.;]+$/, "");
  const head = headerLines.join("\n");
  const profile = (pattern, labelPattern, base) => {
    const written = find(pattern);
    if (written) return [written, "text"];
    const behind = linked(pattern);
    if (behind) return [behind, "link"];
    const label = head.match(labelPattern);
    return label && !/^(com|in|profile|url)$/i.test(label[1]) ? [`${base}${label[1]}`, "label"] : ["", ""];
  };
  const [linkedin, linkedinFrom] = profile(LINKEDIN, LINKEDIN_LABEL, "linkedin.com/in/");
  const [github, githubFrom] = profile(GITHUB, GITHUB_LABEL, "github.com/");
  const portfolio = links.find((link) => /^https?:/i.test(link.url) && !PORTFOLIO_SKIP.test(link.url))?.url || "";
  const isContact = (line) => EMAIL.test(line) || PHONE.test(line) || URL.test(line) || /\|/.test(line) ||
    /^[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(line);
  const roleLine = headerLines.slice(1, 4).find((line) => !isContact(line) && line.length <= 70 && !/[.!?]$/.test(line));
  return {
    name: headerLines[0] && !isContact(headerLines[0]) ? headerLines[0] : "",
    phone: (text.slice(0, 600).match(PHONE) || [""])[0].trim(),
    linkedin, github,
    ...(linkedinFrom ? { linkedinFrom } : {}),
    ...(githubFrom ? { githubFrom } : {}),
    ...(portfolio ? { portfolio } : {}),
    email: find(EMAIL) || (links.find((link) => /^mailto:/i.test(link.url))?.url || "").replace(/^mailto:/i, "").split("?")[0],
    role: roleLine || experience[0]?.title || "",
    roleFrom: roleLine ? "headline" : experience[0] ? "latest job" : ""
  };
}

// Words that make a line a job title rather than an employer
const JOB_TITLE = /\b(engineer|developer|scientist|analyst|manager|intern|lead|architect|consultant|designer|specialist|director|administrator|associate|researcher|programmer|technician|officer|head|vp|president|coordinator|assistant|fellow)s?\b/i;

// text: the resume's text. Returns { resume, found } where found says what
// could be read, for the user to check.
// links: optional URLs behind clickable text (readResume meta.links)
function parseResumeText(text, { links = [] } = {}) {
  // PDF page markers ("-- 1 of 2 --") aren't resume text
  const lines = String(text || "").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line && !/^-*\s*(?:page\s+)?\d+\s*(?:of|\/)\s*\d+\s*-*$/i.test(line));
  const sections = { header: [] };
  let section = "header";
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) {
      section = heading;
      sections[section] = sections[section] || [];
    } else {
      (sections[section] = sections[section] || []).push(line);
    }
  }

  const experience = entriesOf(sections.experience || [], { byDates: true }).map((entry) => {
    const [start, end] = entry.range ? [parseDate(entry.range[1]), parseDate(entry.range[2])] : [null, null];
    const current = Boolean(entry.range && /present|current|now|till/i.test(entry.range[2]));
    // The employer usually comes first; "AI Engineer" then "Oracle" is the
    // other way round (a role word in the first line and not the second)
    const header = JOB_TITLE.test(entry.header[0] || "") && entry.header[1] && !JOB_TITLE.test(entry.header[1])
      ? [entry.header[1], entry.header[0], ...entry.header.slice(2)]
      : entry.header;
    // "AI Engineer | Cloud AI Fremont, CA": the trailing city and state is the location
    const titleLine = header.slice(1).join(", ");
    const place = titleLine.match(/\s+((?:[A-Z][a-z.]+ ){0,2}[A-Z][a-z.]+, [A-Z]{2}|Remote)$/);
    return {
      organization: header[0] || "Unnamed job",
      title: (place ? titleLine.slice(0, place.index) : titleLine).trim() || "Role",
      ...(place ? { location: place[1] } : {}),
      dates: entry.range ? entry.range[0] : "",
      start, end: current ? null : end, current,
      bullets: entry.bullets
    };
  });

  const projects = entriesOf(sections.projects || [], { byDates: false }).map((entry) => ({
    title: (entry.header[0] || "Project").split(/\s+[|–—-]\s+/)[0],
    bullets: entry.bullets
  }));

  // "Languages: Python, SQL" -> Python, SQL; plus known tools anywhere in the section
  const skillLines = sections.skills || [];
  const listed = skillLines
    .flatMap((line) => line.replace(/^[^:]{1,40}:\s*/, "").split(SKILL_SPLIT))
    .map((skill) => skill.replace(BULLET, "").replace(/\.$/, "").trim())
    .filter((skill) => skill.length >= 1 && skill.length <= 40);
  const technical = [...new Set([...listed, ...dictionaryKeywords(skillLines.join("\n"))])];

  const resume = {
    contact: contactOf(sections.header, lines.join("\n"), experience, links),
    summary: (sections.summary || []).join(" "),
    experience,
    projects,
    education: (sections.education || []).map((line) => ({ degree: line, fieldOfStudy: "", institution: "" })),
    skills: { technical, soft: [] },
    certifications: (sections.certifications || []).flatMap((line) => line.replace(BULLET, "").split(/\s*[;|•]\s*/)).filter(Boolean),
    // Certifications, licenses, awards, languages...: evidence too
    other: [...(sections.certifications || []), ...(sections.other || [])]
  };

  // Nothing recognizable: score the whole text as one block of work
  const bulletCount = [...experience, ...projects].reduce((total, item) => total + item.bullets.length, 0);
  if (!bulletCount) {
    resume.experience = [{ organization: "Resume", title: "Text", dates: "", start: null, end: null, current: false, bullets: lines }];
    if (!technical.length) resume.skills.technical = dictionaryKeywords(lines.join("\n"));
  }

  return {
    resume,
    found: {
      sections: Object.keys(sections).filter((key) => key !== "header" && sections[key].length),
      jobs: experience.length,
      projects: projects.length,
      bullets: bulletCount,
      skills: resume.skills.technical.length,
      structured: bulletCount > 0
    }
  };
}

module.exports = { readResume, extractResumeText, parseResumeText, DOCX };
