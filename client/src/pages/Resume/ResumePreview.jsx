import { degreeLine } from "./resumeText";
import { EXTRA_SECTIONS, sectionOrder } from "./resumeTemplates";

// Numbers like 40%, $1.2M, 250+ (bolded by templates with boldNumbers)
const NUMBER = /(\$?\d[\d,.]*(?:%|\+|[KMB]\b)?\+?)/g;

function withBoldNumbers(text) {
  return text.split(NUMBER).map((part, index) =>
    index % 2 ? <strong key={index}>{part}</strong> : part
  );
}

// Text you can click and edit in place; saved when you click away
function Editable({ as: Tag = "span", className = "", value, onSave, boldNumbers = false }) {
  return (
    <Tag
      className={`resume-editable ${className}`.trim()}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onBlur={(e) => {
        const text = e.currentTarget.innerText.replace(/\s+/g, " ").trim();
        if (text !== value) onSave(text);
      }}
    >
      {boldNumbers ? withBoldNumbers(value) : value}
    </Tag>
  );
}

function Bullets({ bullets, onSave, boldNumbers }) {
  if (!bullets.some(Boolean)) return null;

  return (
    <ul>
      {bullets.map((bullet, index) =>
        bullet ? (
          <Editable
            key={`${index}-${bullet}`}
            as="li"
            value={bullet}
            boldNumbers={boldNumbers}
            onSave={(text) => onSave(bullets.map((item, i) => (i === index ? text : item)))}
          />
        ) : null
      )}
    </ul>
  );
}

// Small outline icons drawn as SVG, so they add no stray characters to
// the PDF's text layer (ATS parsers only see the words next to them)
const ICONS = {
  phone: "M3 2h4l2 5-2.5 1.5a11 11 0 0 0 5 5L13 11l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 2 3a1 1 0 0 1 1-1z",
  email: "M2 4h16v12H2zM2 4l8 7 8-7",
  location: "M10 18s6-5.5 6-10a6 6 0 0 0-12 0c0 4.5 6 10 6 10zM10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  linkedin: "M3 3h14v14H3zM6.5 8.5V14M6.5 6v.01M9.5 14v-3.5a2 2 0 0 1 4 0V14M9.5 8.5V14",
  github: "M7 16c-4 1-4-2-6-2m12 4v-3a3 3 0 0 0-1-2.5c3 0 5-1.5 5-5a4 4 0 0 0-1-3 3.5 3.5 0 0 0 0-3s-1 0-3 1.5a10 10 0 0 0-5 0C6 1.5 5 1.5 5 1.5a3.5 3.5 0 0 0 0 3 4 4 0 0 0-1 3c0 3.5 2 5 5 5a3 3 0 0 0-1 2.5v3",
  portfolio: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM2 10h16M10 2a12 12 0 0 1 0 16M10 2a12 12 0 0 0 0 16"
};

function Icon({ name }) {
  return (
    <svg className="resume-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const shortUrl = (url) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

const withProtocol = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// [type, text shown, link] — links stay clickable in the saved PDF
function contactItems(contact) {
  return [
    ["phone", contact.phone, null],
    ["email", contact.email, contact.email && `mailto:${contact.email}`],
    ["location", contact.location, null],
    ["linkedin", contact.linkedin && shortUrl(contact.linkedin), contact.linkedin && withProtocol(contact.linkedin)],
    ["github", contact.github && shortUrl(contact.github), contact.github && withProtocol(contact.github)],
    ["portfolio", contact.portfolio && shortUrl(contact.portfolio), contact.portfolio && withProtocol(contact.portfolio)]
  ].filter(([, value]) => value);
}

const ContactValue = ({ value, href }) =>
  href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : value;

function Header({ resume, template }) {
  const { contact } = resume;
  const items = contactItems(contact);

  return (
    <header className="resume-header">
      <h1>{contact.name}</h1>
      {template.icons ? (
        <p className="resume-contact resume-contact-icons">
          {items.map(([type, value, href]) => (
            <span key={type}><Icon name={type} /><ContactValue value={value} href={href} /></span>
          ))}
        </p>
      ) : (
        <p className="resume-contact">
          {items.map(([type, value, href], index) => (
            <span key={type}>
              {index > 0 && template.contactSeparator}
              <ContactValue value={value} href={href} />
            </span>
          ))}
        </p>
      )}
    </header>
  );
}

// The heading lines of one job, degree or project (see resumeTemplates.js)
function EntryHead({ layout, datesFirst, role, org, location, dates }) {
  if (layout === "stacked") {
    const meta = [org, dates].filter(Boolean).join(" | ");
    return (
      <div className="resume-entry-head">
        {meta && <div className="resume-entry-meta">{meta}</div>}
        <div className="resume-entry-role">{role}</div>
        {location && <div className="resume-entry-meta">{location}</div>}
      </div>
    );
  }

  // orgFirst with datesFirst: "Oracle … Aug 2025 – Present" / "AI Engineer … Fremont, CA"
  const lines = layout === "orgFirst"
    ? datesFirst
      ? [[org || role, dates, true], [org ? role : "", location, false]]
      : [[org || role, location, true], [org ? role : "", dates, false]]
    : [[role, datesFirst ? dates : location, true], [org, datesFirst ? location : dates, false]];

  return (
    <div className="resume-entry-head">
      {lines
        .filter(([left, right]) => left || right)
        .map(([left, right, first], index) => (
          <div key={index} className={`resume-entry-line ${first ? "first" : "second"}`}>
            <span>{left}</span>
            <span>{right}</span>
          </div>
        ))}
    </div>
  );
}

// TECHNICAL SKILLS as category bullets, the same in every template:
//   • Languages & Engineering: Python, SQL, FastAPI
function SkillsBlock({ skills }) {
  const groups = skills.groups || [
    { label: "Technical", skills: skills.technical },
    { label: "Professional Skills", skills: skills.soft }
  ].filter((group) => group.skills.length);

  return (
    <ul className="resume-skill-groups">
      {groups.map((group) => (
        <li key={group.label}>
          <strong>{group.label}:</strong> {group.skills.join(", ")}
        </li>
      ))}
    </ul>
  );
}

// One certification, award, publication... : title, details, date
function ExtraEntry({ item, boldNumbers, onSave }) {
  return (
    <div className="resume-entry resume-entry-compact">
      <div className="resume-entry-line first">
        <span>
          {item.title}
          {item.subtitle && <span className="resume-sub">, {item.subtitle}</span>}
        </span>
        <span>{item.dates}</span>
      </div>
      {item.detail && <p className="resume-meta">{item.detail}</p>}
      <Bullets bullets={item.bullets} boldNumbers={boldNumbers} onSave={onSave} />
    </div>
  );
}

// The resume, drawn in the chosen template
export default function ResumePreview({ resume, template, order = "default", margin = "0.5in", onChange }) {
  const { labels } = template;
  const boldNumbers = Boolean(template.boldNumbers);

  const extras = resume.extras || {};

  const updateItem = (listKey, id, bullets) =>
    onChange({
      ...resume,
      [listKey]: resume[listKey].map((item) => (item.id === id ? { ...item, bullets } : item))
    });

  const updateExtra = (key, id, bullets) =>
    onChange({
      ...resume,
      extras: { ...extras, [key]: extras[key].map((item) => (item.id === id ? { ...item, bullets } : item)) }
    });

  const extraSections = Object.fromEntries(
    EXTRA_SECTIONS.map(({ key, title }) => {
      const items = extras[key] || [];
      if (!items.length) return [key, null];

      // Certifications: just the names, one bullet each
      if (key === "certifications") {
        return [key, (
          <section key={key}>
            <h2>{title}</h2>
            <ul className="resume-plain-list">
              {items.map((item) => <li key={item.id}>{item.title}</li>)}
            </ul>
          </section>
        )];
      }

      if (key === "interests") {
        return [key, (
          <section key={key}>
            <h2>{title}</h2>
            <p>{items.join(", ")}</p>
          </section>
        )];
      }

      return [key, (
        <section key={key}>
          <h2>{title}</h2>
          {items.map((item) => (
            <ExtraEntry
              key={item.id}
              item={item}
              boldNumbers={boldNumbers}
              onSave={(bullets) => updateExtra(key, item.id, bullets)}
            />
          ))}
        </section>
      )];
    })
  );

  const sections = {
    summary: resume.sections.summary && resume.summary && (
      <section key="summary">
        <h2>{labels.summary}</h2>
        <Editable
          key={resume.summary}
          as="p"
          className="resume-summary"
          value={resume.summary}
          onSave={(summary) => onChange({ ...resume, summary })}
        />
      </section>
    ),

    experience: resume.experience.length > 0 && (
      <section key="experience">
        <h2>{labels.experience}</h2>
        {resume.experience.map((item) => (
          <div key={item.id} className="resume-entry">
            <EntryHead
              layout={template.entry}
              datesFirst={template.datesFirst}
              role={item.title}
              org={item.organization}
              location={item.location}
              dates={item.dates}
            />
            <Bullets
              bullets={item.bullets}
              boldNumbers={boldNumbers}
              onSave={(bullets) => updateItem("experience", item.id, bullets)}
            />
          </div>
        ))}
      </section>
    ),

    projects: resume.projects.length > 0 && (
      <section key="projects">
        <h2>{labels.projects}</h2>
        {/* The project name, then one bullet */}
        {resume.projects.map((item) => (
          <div key={item.id} className="resume-entry">
            <div className="resume-project-head">
              <strong className="resume-project-title">{item.title}</strong>
              {item.dates && <span>{item.dates}</span>}
            </div>
            <Bullets
              bullets={item.bullets}
              boldNumbers={boldNumbers}
              onSave={(bullets) => updateItem("projects", item.id, bullets)}
            />
          </div>
        ))}
      </section>
    ),

    education: resume.education.length > 0 && (
      <section key="education">
        <h2>{labels.education}</h2>
        {resume.education.map((item) => {
          const degree = degreeLine(item);
          const layout = template.degreeFirst && template.entry !== "stacked" ? "roleFirst" : template.entry;

          return (
            <div key={item.id} className="resume-entry">
              <EntryHead
                layout={layout}
                datesFirst={template.datesFirst}
                role={degree || item.institution}
                org={degree ? item.institution : ""}
                location={item.location}
                dates={item.dates}
              />
              {item.grade && <p className="resume-meta">GPA/Grade: {item.grade}</p>}
              <Bullets
                bullets={item.bullets}
                boldNumbers={boldNumbers}
                onSave={(bullets) => updateItem("education", item.id, bullets)}
              />
              {item.courses.length > 0 && <p className="resume-meta">Relevant coursework: {item.courses.join(", ")}</p>}
            </div>
          );
        })}
      </section>
    ),

    skills: (resume.skills.technical.length > 0 || resume.skills.soft.length > 0) && (
      <section key="skills">
        <h2>{labels.skills}</h2>
        <SkillsBlock skills={resume.skills} />
      </section>
    ),

    ...extraSections
  };

  return (
    <article data-bs-theme="light" className={`resume-doc tpl-${template.id}`} style={{ "--margin": margin }} aria-label="Resume preview">
      <Header resume={resume} template={template} />
      {sectionOrder(template, order).map((key) => sections[key] || null)}
    </article>
  );
}
