import { Fragment } from "react";

import { AboutLead, Empty, OtherSkills, ProjectLayout } from "./PortfolioParts";
import {
  dateText, levelOf, paragraphs, rangeText, sectionPlan, skillSplit, titleOf
} from "./portfolioKit";

// Section content shared by the designs in ./designs. The markup is plain and
// generic (pfb-* classes); each design's stylesheet gives it its own look.

const join = (...parts) => parts.filter(Boolean).join(" · ");

function Tags({ items, max = 8 }) {
  if (!items?.length) return null;
  return (
    <div className="pfb-tags">
      {items.slice(0, max).map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

// One dated entry: date on the side, title, subtitle and details
function Item({ date, now, title, sub, children }) {
  return (
    <li className="pfb-item">
      <div className="pfb-item-side">
        {date && <span className="pfb-date">{date}</span>}
        {now && <span className="pfb-now">Now</span>}
      </div>
      <div className="pfb-item-main">
        <h3 className="pfb-title">{title}</h3>
        {sub && <p className="pfb-sub">{sub}</p>}
        {children}
      </div>
    </li>
  );
}

function Bullets({ items, max = 4 }) {
  if (!items?.length) return null;
  return <ul className="pfb-bullets">{items.slice(0, max).map((item) => <li key={item}>{item}</li>)}</ul>;
}

function Experience({ items }) {
  return (
    <ol className="pfb-list pfb-list-experience">
      {items.map((job) => (
        <Item key={job.id} date={rangeText(job)} now={job.current} title={job.title} sub={join(job.organization, job.location)}>
          <Bullets items={job.bullets} />
          <Tags items={job.skills} />
        </Item>
      ))}
    </ol>
  );
}

function Education({ items }) {
  return (
    <ol className="pfb-list pfb-list-education">
      {items.map((school) => (
        <Item
          key={school.id}
          date={rangeText(school)}
          now={school.current}
          title={[school.degree, school.fieldOfStudy].filter(Boolean).join(", ") || school.institution}
          sub={join(school.institution, school.location)}
        />
      ))}
    </ol>
  );
}

// Important skills get the design's full treatment; the rest are one plain line
function Skills({ skills }) {
  const { featured, others } = skillSplit(skills);

  return (
    <div className="pfb-skills">
      {featured.length > 0 && (
        <div className="pfb-skill-group">
          <h3 className="pfb-skill-group-title">Key skills</h3>
          <ul className="pfb-skill-list">
            {featured.map((skill) => (
              <li key={skill.id} className="pfb-skill" data-level={skill.rating || 0} title={levelOf(skill.rating)}>
                <span className="pfb-skill-name">{skill.name}</span>
                {skill.rating > 0 && skill.skillType !== "soft" && (
                  <span className="pfb-meter" aria-hidden="true"><i style={{ width: `${skill.rating * 20}%` }} /></span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <OtherSkills skills={others} title={featured.length ? "Other skills" : "Skills"} className="pfb-skill-plain" />
    </div>
  );
}

function Projects({ items }) {
  return (
    <ProjectLayout count={items.length} className="pfb-cards">
      {items.map((project, index) => (
        <article key={project.id} className="pfb-card">
          <div className="pfb-card-top">
            <span className="pfb-card-no">{String(index + 1).padStart(2, "0")}</span>
            {project.link && (
              <a href={project.link} target="_blank" rel="noreferrer" className="pfb-card-link" aria-label={`Open ${project.title}`}>
                <i className="bi bi-arrow-up-right" aria-hidden="true" />
              </a>
            )}
          </div>
          <h3 className="pfb-title">{project.title}</h3>
          {(project.role || project.source) && <p className="pfb-sub">{join(project.role, project.source)}</p>}
          {(project.description || project.bullets[0]) && (
            <p className="pfb-text">{project.description || project.bullets[0]}</p>
          )}
          <Tags items={project.skills} max={6} />
        </article>
      ))}
    </ProjectLayout>
  );
}

function Dated({ items, describe }) {
  return (
    <ol className="pfb-list pfb-list-compact">
      {items.map((item) => (
        <Item key={item.id} date={dateText(item.date)} title={item.title} sub={item.subtitle}>
          {describe && item.description && <p className="pfb-text">{item.description}</p>}
        </Item>
      ))}
    </ol>
  );
}

function Recommendations({ items }) {
  return (
    <div className="pfb-quotes">
      {items.map((item) => (
        <figure key={item.id} className="pfb-quote">
          <blockquote>{item.text || item.relationship}</blockquote>
          <figcaption>
            <strong>{item.name}</strong>
            <span>{[item.title, item.organization].filter(Boolean).join(", ") || item.relationship}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Extras({ items }) {
  return (
    <ol className="pfb-list pfb-list-compact">
      {items.map((item) => (
        <Item
          key={item.id}
          date={item.start ? rangeText(item) : dateText(item.date)}
          title={item.title}
          sub={join(item.subtitle, item.cause)}
        />
      ))}
    </ol>
  );
}

const CORE_EMPTY = { about: "about", experience: "experience", education: "education", skills: "skills" };

// The content of one section, or "please add it" for an empty core section
export function SectionBody({ id, data }) {
  const empty = CORE_EMPTY[id];

  switch (id) {
    case "about":
      return (
        <>
          <AboutLead data={data} />
          {data.summary
            ? <div className="pfb-about">{paragraphs(data.summary).map((text) => <p key={text}>{text}</p>)}</div>
            : <Empty section={empty} />}
        </>
      );
    case "experience":
      return data.experiences.length ? <Experience items={data.experiences} /> : <Empty section={empty} />;
    case "education":
      return data.educations.length ? <Education items={data.educations} /> : <Empty section={empty} />;
    case "skills":
      return data.skills.length ? <Skills skills={data.skills} /> : <Empty section={empty} />;
    case "projects":
      return <Projects items={data.projects} />;
    case "certifications":
      return <Dated items={data.certifications} />;
    case "achievements":
      return <Dated items={data.achievements} describe />;
    case "recommendations":
      return <Recommendations items={data.recommendations} />;
    default:
      return <Extras items={data[id] || []} />;
  }
}

// Every section the portfolio shows, in order. `render` wraps each one in the
// design's own frame: render({ id, title, number, index, body }).
// `only` / `skip` split sections between columns.
export function Sections({ data, only, skip, titles, render }) {
  const plan = sectionPlan(data)
    .filter((id) => !only || only.includes(id))
    .filter((id) => !skip || !skip.includes(id));

  return plan.map((id, index) => (
    <Fragment key={id}>
      {render({
        id,
        index,
        number: String(index + 1).padStart(2, "0"),
        title: titles?.[id] || titleOf(data, id),
        body: <SectionBody id={id} data={data} />
      })}
    </Fragment>
  ));
}
