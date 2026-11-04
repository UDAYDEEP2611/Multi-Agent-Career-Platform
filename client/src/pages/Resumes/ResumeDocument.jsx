import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";

import { dateText, initials, paragraphs, rangeText, yearsOfWork } from "../Portfolio/portfolioKit";

// US resume standard fonts: a template is sans or serif; either way the
// text uses a standard family (Calibri, else Helvetica or Arial; Garamond,
// else Cambria or Times New Roman), never a display font
const SANS = "Calibri, Carlito, Arial, Helvetica, sans-serif";
const SERIF = "Garamond, \"EB Garamond\", Cambria, \"Times New Roman\", Times, serif";
const isSerif = (stack = "") => /serif/i.test(stack) && !/sans-serif/i.test(stack);

// Body text 10pt with 3+ years of experience, 11pt early in a career
const bodySize = (experiences) => (yearsOfWork(experiences) >= 3 ? "10pt" : "11pt");

// A resume shows at most this many key skills
const KEY_SKILL_LIMIT = 15;

// Key skills only (the ones marked important), at most 15; the rest only
// when asked for. With none marked, the 15 highest rated stand in.
function resumeSkills(skills, allSkills) {
  if (allSkills) return skills;
  // The very important skills: the first 15 important ones in the user's
  // order (the Skills page shows them as "Very important"), else the top rated
  const key = skills.filter((skill) => skill.isImportant);
  const chosen = key.length ? key : [...skills].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return chosen.slice(0, KEY_SKILL_LIMIT);
}

// How many bullets a job gets: the latest 3 or 4, the others 2 or 3. Short
// bullets get the higher count, long ones the lower, so the page stays full
// but not crowded.
const RESULT = /\d|%|\$|\b(cut|reduc\w*|increas\w*|improv\w*|grew|saved|boost\w*|users?|customers?|employees?|revenue|latency|faster)\b/i;

function resumeBullets(bullets = [], index) {
  const [fewer, more] = index === 0 ? [3, 4] : [2, 3];
  if (bullets.length <= fewer) return bullets;
  const average = bullets.reduce((sum, bullet) => sum + bullet.length, 0) / bullets.length;
  const count = Math.min(bullets.length, average <= 110 ? more : fewer);
  // Measured results first, then the rest, shown in the original order
  const ranked = bullets
    .map((bullet, position) => ({ bullet, position, score: (RESULT.test(bullet) ? 2 : 0) + (/\d/.test(bullet) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, count)
    .sort((a, b) => a.position - b.position);
  return ranked.map((item) => item.bullet);
}

// The resume's summary: the agent's 3–4 sentence version, else the first
// 3 or 4 whole sentences of About me (up to about 75 words)
function resumeSummaryOf(data) {
  if (data.rewrittenSummary) return data.rewrittenSummary;
  if (data.heroSummaries?.resume?.text) return data.heroSummaries.resume.text;
  const sentences = paragraphs(data.summary).join(" ").split(/(?<=[.!?])\s+/).filter(Boolean);
  const kept = [];
  for (const sentence of sentences) {
    if (kept.length >= 4) break;
    if (kept.length >= 3 && [...kept, sentence].join(" ").split(/\s+/).length > 75) break;
    kept.push(sentence);
  }
  return kept.join(" ");
}

// A project on the resume: one whole sentence, never cut off. The first
// sentence of its description, else its first point.
function projectSentence(project) {
  const text = (project.description || project.bullets?.[0] || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const first = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)[0].trim();
  return /[.!?]$/.test(first) ? first : `${first}.`;
}

// In a narrow sidebar a project is its title, plus its sentence only when that
// is very short (up to 12 words); a longer one is left out
const SIDE_PROJECT_WORDS = 12;
function sideProjectSentence(project) {
  const sentence = projectSentence(project);
  return sentence.split(/\s+/).length <= SIDE_PROJECT_WORDS ? sentence : "";
}

// The portfolio as the resume shows it: the top or latest few of each
// section and only the optional sections asked for (resume settings)
const DATA_KEYS = { experience: "experiences", education: "educations", projects: "projects", certifications: "certifications" };
const OPTIONAL = ["achievements", "volunteering", "publications", "patents", "interests", "recommendations"];

// Portfolio lists -> entry sections, for entries left off one resume ("projects:<id>")
const ENTRY_SECTIONS = {
  experiences: "experience", educations: "education", projects: "projects", skills: "skills", certifications: "certifications",
  achievements: "achievements", volunteering: "volunteering", publications: "publications", patents: "patents", interests: "interests", recommendations: "recommendations"
};

// Wording changed in the chat, for resumes only: the portfolio keeps the
// original. Whole words, any case; ids and links' targets stay as they are.
const reworded = (value, rules) => {
  if (typeof value === "string") return rules.reduce((text, [pattern, to]) => text.replace(pattern, () => to), value);
  if (Array.isArray(value)) return value.map((item) => reworded(item, rules));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "id" || key === "_id" ? item : reworded(item, rules)]));
  return value;
};
function withRewrites(data, rewrites) {
  const rules = (rewrites?.replace || []).map(({ from, to }) => [new RegExp(`(?<![\\w])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`, "gi"), to]);
  const changed = rules.length ? reworded(data, rules) : data;
  return { ...changed, contact: { ...changed.contact, ...(rewrites?.contact || {}) }, rewrittenSummary: rewrites?.summary || "", rewrittenLine: rewrites?.line || "" };
}

// One detail left off one entry ("education:<id>:grade"), for this resume only
const FIELD_BLANKS = {
  grade: { grade: "" },
  location: { location: "" },
  dates: { start: null, end: null, current: false, date: null },
  description: { description: "", summary: "", bullets: [], text: "" },
  bullets: { bullets: [] },
  issuer: { subtitle: "", organization: "", institution: "" },
  degree: { degree: "" },
  field: { fieldOfStudy: "" },
  source: { source: "" }
};
// A job's role is its title; a project's title is its name, so only its role goes
const blanksFor = (id, section) => (id === "role" ? (section === "projects" ? { role: "" } : { title: "" }) : FIELD_BLANKS[id]);
function withoutFields(item, section, fields) {
  const blanks = [...Object.keys(FIELD_BLANKS), "role"].filter((id) => fields.has(`${section}:${item.id}:${id}`));
  return blanks.length ? Object.assign({ ...item }, ...blanks.map((id) => blanksFor(id, section))) : item;
}

function forResume(portfolio, settings) {
  const hidden = new Set(settings?.hiddenEntries || []);
  const fields = new Set(settings?.hiddenFields || []);
  const data = hidden.size || fields.size
    ? { ...portfolio, ...Object.fromEntries(Object.entries(ENTRY_SECTIONS).map(([key, section]) => [key, (portfolio[key] || []).filter((item) => !hidden.has(`${section}:${item.id}`)).map((item) => withoutFields(item, section, fields))])) }
    : portfolio;
  const limited = Object.fromEntries(Object.entries(DATA_KEYS).map(([id, key]) => {
    const count = settings?.limits?.[id];
    return [key, count ? (data[key] || []).slice(0, count) : data[key] || []];
  }));
  const optional = Object.fromEntries(OPTIONAL.map((id) => [id, settings?.extras?.includes(id) ? data[id] || [] : []]));
  // Parts of the page left off in the chat: "contact:phone", "page:summary"
  const contact = Object.fromEntries(Object.entries(portfolio.contact || {}).map(([key, value]) => [key, fields.has(`contact:${key}`) ? "" : value]));
  return withRewrites({
    ...data, ...limited, ...optional, contact,
    leftOffPage: { summary: fields.has("page:summary"), line: fields.has("page:line"), roles: fields.has("page:roles") }
  }, settings?.rewrites);
}

// One resume page (US Letter, 816 × 1056 px at 96 dpi), laid out by a design
// from resumeDesigns.js and filled from the portfolio. Long resumes flow onto
// more pages when printed; sidebars are painted on the page itself, so they
// run the full height of every page.

const SECTION_TITLES = {
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  achievements: "Key Achievements",
  volunteering: "Volunteering",
  publications: "Publications",
  patents: "Patents",
  interests: "Interests",
  recommendations: "Recommendations"
};

const SECTION_ICONS = {
  contact: "bi-person-lines-fill",
  summary: "bi-person",
  experience: "bi-briefcase",
  projects: "bi-kanban",
  education: "bi-mortarboard",
  skills: "bi-lightning-charge",
  certifications: "bi-patch-check",
  achievements: "bi-trophy",
  volunteering: "bi-people",
  publications: "bi-journal-text",
  patents: "bi-lightbulb",
  interests: "bi-heart",
  recommendations: "bi-chat-quote"
};

// Resume section order, in both columns: summary, skills, experience,
// education, certifications, then projects
const MAIN_ORDER = ["summary", "skills", "experience", "education", "certifications", "projects", "achievements", "volunteering", "publications", "patents", "interests", "recommendations"];
const SIDE_ORDER = ["contact", ...MAIN_ORDER];
// A section's place: the order asked for in the resume chat, else the usual one
const rankIn = (order) => (id) => {
  const asked = order?.indexOf(id) ?? -1;
  return id === "contact" ? -1 : asked >= 0 ? asked : order?.length ? order.length + SIDE_ORDER.indexOf(id) : SIDE_ORDER.indexOf(id);
};
const inOrder = (ids, order) => {
  const rank = rankIn(order);
  return [...ids].sort((a, b) => rank(a) - rank(b));
};

const isDark = (hex = "#ffffff") => {
  const value = hex.replace("#", "");
  if (value.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};

const shortUrl = (url = "") => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

// Links saved without https:// would otherwise open as a page of this site
const withProtocol = (url = "") => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// The username at the end of a profile link: linkedin.com/in/jane-doe -> jane-doe
const handleOf = (url = "") => shortUrl(url).split(/[?#]/)[0].split("/").filter(Boolean).pop() || shortUrl(url);

function contactItems(contact) {
  return [
    contact.email && { icon: "bi-envelope", text: contact.email, href: `mailto:${contact.email}` },
    contact.phone && { icon: "bi-telephone", text: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, "")}` },
    contact.location && { icon: "bi-geo-alt", text: contact.location },
    contact.linkedin && { icon: "bi-linkedin", text: handleOf(contact.linkedin), href: withProtocol(contact.linkedin) },
    contact.github && { icon: "bi-github", text: handleOf(contact.github), href: withProtocol(contact.github) },
    contact.portfolio && { icon: "bi-globe", text: shortUrl(contact.portfolio), href: withProtocol(contact.portfolio) }
  ].filter(Boolean);
}

function Heading({ id, design }) {
  return (
    <h2 className="rd-h">
      {design.heading === "icon" && <span className="rd-h-badge" aria-hidden="true"><i className={`bi ${SECTION_ICONS[id]}`} /></span>}
      <span className="rd-h-text">{design.sectionTitles?.[id] || SECTION_TITLES[id]}</span>
    </h2>
  );
}

function Contact({ contact, inline }) {
  const items = contactItems(contact);
  if (!items.length) return null;
  return (
    <ul className={`rd-contact ${inline ? "rd-contact-inline" : ""}`}>
      {items.map((item) => (
        <li key={item.icon}>
          <i className={`bi ${item.icon}`} aria-hidden="true" />
          {item.href ? <a href={item.href}>{item.text}</a> : <span>{item.text}</span>}
        </li>
      ))}
    </ul>
  );
}

function Avatar({ name, design, big }) {
  if (design.avatar === "none") return null;
  return <div className={`rd-avatar rd-avatar-${design.avatar} ${big ? "rd-avatar-big" : ""}`} aria-hidden="true"><span>{initials(name)}</span></div>;
}

// A job, degree or project: heading lines, dates, then details
function Entry({ title, sub, place, dates, children, design }) {
  const head = (
    <div className="rd-entry-head">
      <div className="rd-entry-titles">
        {title && <h3 className="rd-entry-title">{title}</h3>}
        {(sub || place) && <p className="rd-entry-sub">{[sub, design.entries === "dates" ? place : null].filter(Boolean).join(" · ")}</p>}
      </div>
      {design.entries !== "dates" && (dates || place) && (
        <div className="rd-entry-meta">
          {dates && <span className="rd-entry-dates">{dates}</span>}
          {place && <span className="rd-entry-place">{place}</span>}
        </div>
      )}
    </div>
  );

  if (design.entries === "dates") {
    return (
      <div className="rd-entry rd-entry-dated">
        <div className="rd-entry-when">{dates}</div>
        <div>{head}{children}</div>
      </div>
    );
  }
  return <div className={`rd-entry ${design.entries === "timeline" ? "rd-entry-timeline" : ""}`}>{head}{children}</div>;
}

const Bullets = ({ items }) => (items?.length ? <ul className="rd-bullets">{items.map((item) => <li key={item}>{item}</li>)}</ul> : null);

// Skill tags packed into full rows: each row takes the next skill in order,
// then fills its leftover space with later skills that fit (Python, PySpark,
// then Generative AI beside them instead of a gap). Measured after layout,
// and again once the fonts load or the column changes width.
function PackedTags({ names }) {
  const list = useRef(null);
  const [order, setOrder] = useState(names);
  const key = names.join("\n");

  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return undefined;
    const pack = () => {
      const items = [...element.children];
      if (!items.length) return;
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      const room = element.clientWidth;
      // offsetWidth ignores the gallery thumbnails' scale transform
      const width = new Map(items.map((item) => [item.dataset.name, item.offsetWidth]));
      const left = names.filter((name) => width.has(name));
      const packed = [];
      while (left.length) {
        let used = 0;
        for (let i = 0; i < left.length;) {
          const next = width.get(left[i]) + (used ? gap : 0);
          if (!used || used + next <= room) {
            used += next;
            packed.push(...left.splice(i, 1));
          } else i += 1;
        }
      }
      setOrder((current) => (current.join("\n") === packed.join("\n") ? current : packed));
    };
    pack();
    document.fonts?.ready.then(pack);
    const resize = new ResizeObserver(pack);
    resize.observe(element);
    return () => resize.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Until a new list of skills is measured, show it in its own order
  const sameSkills = order.length === names.length && order.every((name) => names.includes(name));
  const shown = sameSkills ? order : names;
  return <ul className="rd-skills-tags" ref={list}>{shown.map((name) => <li key={name} data-name={name}>{name}</li>)}</ul>;
}

function Skills({ skills, style }) {
  if (!skills.length) return null;
  const sorted = [...skills.filter((skill) => skill.isImportant), ...skills.filter((skill) => !skill.isImportant)];
  if (style === "inline") {
    const technical = sorted.filter((skill) => skill.skillType !== "soft").map((skill) => skill.name);
    const soft = sorted.filter((skill) => skill.skillType === "soft").map((skill) => skill.name);
    return (
      <div className="rd-skills-inline">
        {technical.length > 0 && <p><strong>Technical:</strong> {technical.join(", ")}</p>}
        {soft.length > 0 && <p><strong>Soft skills:</strong> {soft.join(", ")}</p>}
      </div>
    );
  }
  if (style === "tags") return <PackedTags names={sorted.map((skill) => skill.name)} />;
  if (style === "boxes") return <div className="rd-skills-boxed"><PackedTags names={sorted.map((skill) => skill.name)} /></div>;
  if (style === "list") return <ul className="rd-skills-list">{sorted.map((skill) => <li key={skill.name}>{skill.name}</li>)}</ul>;
  const level = (skill) => Math.max(1, Math.min(5, skill.rating || 3));
  return (
    <ul className={`rd-skills-rated rd-skills-${style}`}>
      {sorted.slice(0, KEY_SKILL_LIMIT).map((skill) => (
        <li key={skill.name}>
          <span className="rd-skill-name">{skill.name}</span>
          {style === "bars" ? (
            <span className="rd-skill-bar" aria-label={`${level(skill)} of 5`}><i style={{ width: `${level(skill) * 20}%` }} /></span>
          ) : (
            <span className="rd-skill-dots" aria-label={`${level(skill)} of 5`}>
              {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= level(skill) ? "is-on" : ""} />)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// "Add it in the portfolio" hints show on screen only, never in print
const Empty = ({ what }) => <p className="rd-empty d-print-none">Add your {what} in your portfolio and it appears here.</p>;

function sectionBody(id, data, design, inSide) {
  switch (id) {
    case "contact":
      return <Contact contact={data.contact} />;
    case "summary": {
      const summary = resumeSummaryOf(data);
      return summary ? <p className="rd-text">{summary}</p> : <Empty what="summary" />;
    }
    case "experience":
      return data.experiences.length ? data.experiences.map((job, index) => (
        <Entry key={job.id} design={inSide ? { ...design, entries: "standard" } : design} title={job.title} sub={job.organization} place={job.location} dates={rangeText(job)}>
          {job.summary && index === 0 && <p className="rd-text">{job.summary}</p>}
          <Bullets items={resumeBullets(job.bullets, index)} />
        </Entry>
      )) : <Empty what="experience" />;
    case "education":
      return data.educations.length ? data.educations.map((school) => (
        <Entry
          key={school.id}
          design={inSide ? { ...design, entries: "standard" } : design}
          title={[school.degree, school.fieldOfStudy].filter(Boolean).join(" in ") || school.institution}
          sub={school.degree || school.fieldOfStudy ? school.institution : ""}
          place={inSide ? "" : school.location}
          dates={rangeText(school)}
        >
          {school.grade && <p className="rd-text rd-small">Grade: {school.grade}</p>}
        </Entry>
      )) : <Empty what="education" />;
    case "projects":
      return data.projects.map((project) => (
        <Entry
          key={project.id}
          design={inSide ? { ...design, entries: "standard" } : design}
          title={project.title}
          sub={inSide ? "" : [project.role, project.source].filter(Boolean).join(" · ")}
          dates={inSide ? "" : rangeText(project)}
        >
          {(inSide ? sideProjectSentence(project) : projectSentence(project)) && (
            <p className={`rd-text rd-project-text ${inSide ? "rd-project-side" : ""}`}>{inSide ? sideProjectSentence(project) : projectSentence(project)}</p>
          )}
        </Entry>
      ));
    case "skills": {
      if (!data.skills.length) return <Empty what="skills" />;
      const noneMarked = !design.allSkills && !data.skills.some((skill) => skill.isImportant);
      return (
        <>
          {/* Across the page, skills sit in a grid of boxes */}
          <Skills skills={resumeSkills(data.skills, design.allSkills)} style={design.skillStyle || (inSide ? design.skills : "tags")} />
          {noneMarked && <p className="rd-empty d-print-none mt-2">Showing your highest-rated skills. Mark your key skills on the Skills page to choose them.</p>}
        </>
      );
    }
    case "achievements":
      return data.achievements.map((item) => (
        <div key={item.id} className="rd-mini">
          <h3 className="rd-mini-title"><i className="bi bi-award" aria-hidden="true" /> {item.title}</h3>
          {(item.subtitle || item.date) && <p className="rd-mini-sub">{[item.subtitle, dateText(item.date)].filter(Boolean).join(" · ")}</p>}
          {item.description && !inSide && <p className="rd-text">{item.description}</p>}
        </div>
      ));
    case "volunteering":
      return data.volunteering.map((item) => (
        <Entry key={item.id} design={design} title={item.title} sub={item.subtitle} dates={rangeText(item)}>
          {item.description && <p className="rd-text">{item.description}</p>}
        </Entry>
      ));
    case "recommendations":
      // A short quote: the first two sentences, and in the sidebar only who said it
      return data.recommendations.map((item) => (
        <div key={item.id} className="rd-mini">
          <h3 className="rd-mini-title">{item.name}</h3>
          {(item.title || item.organization) && <p className="rd-mini-sub">{[item.title, item.organization, dateText(item.date)].filter(Boolean).join(" · ")}</p>}
          {item.text && !inSide && <p className="rd-text">“{paragraphs(item.text).join(" ").split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")}”</p>}
        </div>
      ));
    case "interests":
      return <ul className="rd-skills-tags rd-interests">{data.interests.map((item) => <li key={item.id}>{item.title}</li>)}</ul>;
    default: {
      // certifications, publications, patents: title, subtitle, date. The
      // main column has the width for one line each: "Title – Issuer · 2024"
      const items = data[id] || [];
      if (!inSide) {
        return items.map((item) => {
          const detail = [item.subtitle, dateText(item.date)].filter(Boolean).join(" · ");
          return (
            <p key={item.id} className="rd-mini rd-mini-line">
              <strong className="rd-mini-title">{item.title}</strong>
              {detail && <span className="rd-mini-sub"> – {detail}</span>}
            </p>
          );
        });
      }
      return items.map((item) => (
        <div key={item.id} className="rd-mini">
          <h3 className="rd-mini-title">{item.title}</h3>
          {(item.subtitle || item.date) && <p className="rd-mini-sub">{[item.subtitle, dateText(item.date)].filter(Boolean).join(" · ")}</p>}
        </div>
      ));
    }
  }
}

// Sections with nothing to show are left out, except the core ones (which
// show a hint on screen)
function hasContent(id, data) {
  if (id === "summary" && data.leftOffPage?.summary) return false;
  if (id === "contact") return contactItems(data.contact).length > 0;
  if (["summary", "experience", "education", "skills"].includes(id)) return true;
  if (id === "projects") return data.projects.length > 0;
  return (data[id] || []).length > 0;
}

function Section({ id, data, design, inSide }) {
  if (!hasContent(id, data)) return null;
  return (
    <section className={`rd-section rd-section-${id}`}>
      <Heading id={id} design={design} />
      {sectionBody(id, data, design, inSide)}
    </section>
  );
}

// Names never break mid-word: the longest word caps the font size so it fits
// its column (about 0.7em per capital letter in these fonts). Each design's
// own size applies below the cap (see --rd-name-max in resumes.css).
function nameCap(name, width) {
  const longest = Math.max(...String(name || "").split(/\s+/).map((word) => word.length), 1);
  return `${Math.floor(width / (longest * 0.7))}px`;
}

// Under the name: the roles being targeted, else the headline
const MAX_HEADER_ROLES = 6;
const headerLine = (data) => (data.leftOffPage?.line ? "" : data.rewrittenLine || (data.leftOffPage?.roles ? [] : data.openTo?.targetRoles || []).map((role) => String(role).trim()).filter(Boolean).slice(0, MAX_HEADER_ROLES).join(" | ") || data.headline);

function NameBlock({ data, width = 700 }) {
  const line = headerLine(data);
  return (
    <div className="rd-nameblock">
      <h1 className="rd-name" style={{ "--rd-name-max": nameCap(data.contact.name, width) }}>{data.contact.name}</h1>
      {line && <p className="rd-headline">{line}</p>}
    </div>
  );
}

// Short sections that may move from the main column into the sidebar when
// the sidebar ends well above the main column (certifications first)
const BALANCE_IDS = ["certifications", "achievements", "publications", "patents", "interests"];

// How far down a column's content reaches, in the page's own pixels
const contentHeight = (column) => {
  const last = column?.lastElementChild;
  return last ? last.getBoundingClientRect().bottom - column.getBoundingClientRect().top : 0;
};

// settings: what the resume includes (useResumeSettings): how many of each
// section, which optional sections, and every skill or the key ones
export default function ResumeDocument({ data: portfolio, design: baseDesign, accent, settings }) {
  const data = forResume(portfolio, settings);
  const design = settings?.allSkills || settings?.skillStyle || settings?.rewrites?.titles
    ? { ...baseDesign, allSkills: Boolean(settings.allSkills), skillStyle: settings.skillStyle, sectionTitles: settings.rewrites?.titles }
    : baseDesign;
  const color = accent || design.accent;
  const recolor = Boolean(accent) && accent !== design.accent;
  // A new accent also recolours a coloured sidebar or band, kept dark enough
  // for light text
  // and a light one takes a tint of it (a white one stays white)
  const plainSide = !design.sideBg || /^#f{3,6}$/i.test(design.sideBg);
  const sideBg = !recolor || plainSide
    ? design.sideBg || "#ffffff"
    : isDark(design.sideBg) ? `color-mix(in srgb, ${accent} 72%, #0b1020)` : `color-mix(in srgb, ${accent} 13%, #ffffff)`;
  const band = !recolor || !design.band ? design.band || color : design.headerDark ? `color-mix(in srgb, ${accent} 62%, #0b1020)` : accent;
  const hasSide = design.layout !== "single";
  // Sections the user moved ("move Education to the right column"): left and
  // right are the page's sides, so which column that is depends on the design
  const columns = settings?.columns || {};
  const asksSide = (id) => columns[id] === "side" || columns[id] === design.layout;
  const baseSideIds = hasSide
    ? inOrder(new Set([...design.side.filter((id) => !columns[id] || asksSide(id)), ...Object.keys(columns).filter(asksSide)]), settings?.order).filter((id) => hasContent(id, data))
    : [];
  const baseMainIds = inOrder(MAIN_ORDER, settings?.order).filter((id) => !baseSideIds.includes(id) && (hasSide || id !== "contact"));

  // Balancing the columns: while the main column runs well past the end of
  // the sidebar, its short sections (certifications first) move across one at
  // a time. Each move is measured and kept only if the resume gets shorter.
  const article = useRef(null);
  const [fontsReady, setFontsReady] = useState(false);
  const balanceKey = `${design.id}|${fontsReady}|${JSON.stringify(data).length}|${baseSideIds.join()}|${baseMainIds.join()}`;
  const [balance, setBalance] = useState({ key: "", moved: [], tried: [], pending: null, before: 0 });
  const current = balance.key === balanceKey ? balance : { key: balanceKey, moved: [], tried: [], pending: null, before: 0 };
  const sideIds = inOrder([...baseSideIds, ...current.moved], settings?.order);
  const mainIds = baseMainIds.filter((id) => !current.moved.includes(id));

  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!hasSide || !article.current) return;
    const main = article.current.querySelector(".rd-main");
    const side = article.current.querySelector(".rd-side");
    const mainHeight = contentHeight(main);
    const sideHeight = contentHeight(side);
    const total = Math.max(mainHeight, sideHeight);

    if (current.pending) {
      const better = total < current.before - 1;
      setBalance({
        ...current,
        moved: better ? current.moved : current.moved.filter((id) => id !== current.pending),
        tried: [...current.tried, current.pending],
        pending: null
      });
      return;
    }

    // A section the user placed stays where they put it
    const next = BALANCE_IDS.find((id) => !columns[id] && mainIds.includes(id) && !current.tried.includes(id) && main.querySelector(`.rd-section-${id}`));
    if (!next) return;
    const height = main.querySelector(`.rd-section-${next}`).getBoundingClientRect().height;
    // The sidebar is narrower, so the section grows there: move it only when
    // the free space clearly takes it
    if (mainHeight - sideHeight > height * 1.5) {
      setBalance({ ...current, moved: [...current.moved, next], pending: next, before: total });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceKey, current.moved.join(), current.pending, current.tried.join()]);
  const sideIsDark = hasSide && isDark(design.sideBg) ;

  const style = {
    "--rd-accent": color,
    // Headings in a new colour stay readable on white, even in a pale one
    "--rd-accent-text": isDark(color) ? color : `color-mix(in srgb, ${color} 62%, #000000)`,
    "--rd-band": band,
    "--rd-side-bg": sideBg,
    "--rd-side-ink": design.sideInk || "#1f2937",
    "--rd-side-width": `${design.sideWidth || 32}%`,
    "--rd-side-width-number": (design.sideWidth || 32) / 100,
    "--rd-font": isSerif(design.font) ? SERIF : SANS,
    "--rd-head-font": isSerif(design.headFont || design.font) ? SERIF : SANS,
    "--rd-body": bodySize(portfolio.experiences)
  };

  const headerContact = !sideIds.includes("contact");
  // Room for the name: the whole page, or the main column beside a sidebar
  // (the header's own badge and contact take some of it in split headers)
  const across = !hasSide || ["band", "banner", "bar", "boxed"].includes(design.header) || (design.header === "split" && design.headerDark);
  const nameWidth = (across ? 740 : 816 * (100 - (design.sideWidth || 32)) / 100 - 76) * (design.header === "split" ? 0.62 : 1)
    - (design.header === "split" && design.avatar !== "none" && !design.avatarInSide ? 60 : 0);
  const avatarInHeader = design.avatar !== "none" && !design.avatarInSide && design.header !== "side";

  const header = (() => {
    switch (design.header) {
      case "band":
      case "banner":
        return (
          <header className={`rd-header rd-header-${design.header}`}>
            {avatarInHeader && <Avatar name={data.contact.name} design={design} />}
            <NameBlock data={data} width={nameWidth} />
            {headerContact && <Contact contact={data.contact} inline />}
          </header>
        );
      case "centered":
      case "boxed":
        return (
          <header className={`rd-header rd-header-${design.header}`}>
            <NameBlock data={data} width={nameWidth} />
            {headerContact && <Contact contact={data.contact} inline />}
          </header>
        );
      case "split":
      case "bar":
        return (
          <header className={`rd-header rd-header-${design.header} ${design.headerDark ? "is-dark" : ""} ${design.avatarRight ? "avatar-right" : ""}`}>
            {avatarInHeader && <Avatar name={data.contact.name} design={design} />}
            <NameBlock data={data} width={nameWidth} />
            {headerContact && <Contact contact={data.contact} inline={design.header === "bar"} />}
          </header>
        );
      case "side":
        return null;
      default:
        return (
          <header className={`rd-header rd-header-plain ${design.avatarRight ? "avatar-right" : ""}`}>
            {avatarInHeader && <Avatar name={data.contact.name} design={design} />}
            <NameBlock data={data} width={nameWidth} />
            {headerContact && <Contact contact={data.contact} inline />}
          </header>
        );
    }
  })();

  // A header inside the main column (plain/split with a sidebar) vs across the page
  const headerAcross = across;

  const side = hasSide && (
    <aside className={`rd-side ${sideIsDark ? "is-dark" : ""}`}>
      {(design.header === "side" || design.avatarInSide) && (
        <div className="rd-side-top">
          {design.avatar !== "none" && <Avatar name={data.contact.name} design={design} big={design.bigAvatar} />}
          {design.header === "side" && <NameBlock data={data} width={816 * (design.sideWidth || 32) / 100 - 52} />}
        </div>
      )}
      {sideIds.map((id) => <Section key={id} id={id} data={data} design={design} inSide />)}
    </aside>
  );

  const main = (
    <main className="rd-main">
      {!headerAcross && header}
      {mainIds.map((id) => (
        <Fragment key={id}><Section id={id} data={data} design={design} /></Fragment>
      ))}
    </main>
  );

  return (
    <article
      ref={article}
      className={[
        "rd", `rd-${design.id}`, `rd-layout-${design.layout}`, `rd-h-${design.heading}`, `rd-entries-${design.entries}`,
        design.divider ? "rd-divider" : "", design.topRule ? "rd-top-rule" : "", recolor ? "rd-recolored" : ""
      ].filter(Boolean).join(" ")}
      style={style}
    >
      {/* Printing: the sidebar colour is repeated down every page */}
      {hasSide && <div className={`rd-print-side rd-print-side-${design.layout}`} aria-hidden="true" />}
      {headerAcross && header}
      <div className="rd-body">
        {design.layout === "left" && side}
        {main}
        {design.layout === "right" && side}
      </div>
    </article>
  );
}
