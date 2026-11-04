import { AboutLead, ContactLink, Empty, ExtraSections, OtherSkills, ProjectLayout } from "./PortfolioParts";
import {
  contactLinks, counter, dateText, hasExtras, ledeOf, initials, paragraphs, rangeText, skillSplit, statsOf, levelOf
} from "./portfolioKit";

// Monochrome and minimal: a huge outlined name, black pills, thin rules
export default function MonoPortfolio({ data }) {
  const { contact } = data;
  const [first, ...rest] = contact.name.split(/\s+/);
  const links = contactLinks(contact);
  const stats = statsOf(data);
  const number = counter();
  const skills = skillSplit(data.skills);
  const heading = (title, index) => (
    <div className="mono-heading">
      {index && <span className="mono-index">{index}</span>}
      <h2>{title}</h2>
    </div>
  );

  return (
    <div className="pf pf-mono">
      <div className="mono-frame">
        <nav className="mono-nav">
          <span className="mono-available"><span className="mono-dot" />{contact.location || "Portfolio"}</span>
          <div className="mono-nav-links">
            <a href="#mono-about">About</a>
            <a href="#mono-experience">Experience</a>
            <a href="#mono-education">Education</a>
            <a href="#mono-skills">Skills</a>
            {data.projects.length > 0 && <a href="#mono-work">Work</a>}
            <a href="#mono-contact">Contact</a>
          </div>
          <a href="#mono-contact" className="mono-pill">Let's talk <i className="bi bi-arrow-up-right" aria-hidden="true" /></a>
        </nav>

        <header className="mono-hero">
          <h1 className="mono-name">
            <span className="mono-outline">{first}</span>{" "}
            {rest.length > 0 && <span>{rest.join(" ")}</span>}
          </h1>

          <div className="mono-hero-grid">
            <div>
              <p className="mono-role">{data.headline || "Your job title goes here"}</p>
              {data.summary ? (
                <p className="pf-hero-summary mono-lede">{ledeOf(data)}</p>
              ) : (
                <Empty section="about" compact />
              )}
              <a href="#mono-contact" className="mono-pill mt-3">Let's collaborate <i className="bi bi-arrow-up-right" aria-hidden="true" /></a>
            </div>

            <div className="mono-portrait" aria-hidden="true">
              <span>{initials(contact.name)}</span>
            </div>

            <ul className="mono-socials">
              {links.length ? links.map((link) => (
                <li key={link.href}><ContactLink link={link} /></li>
              )) : <li><Empty section="profile" compact /></li>}
            </ul>
          </div>

          {stats.length > 0 && (
            <div className="mono-stats">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <strong>+{String(stat.value).replace("+", "")}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </header>
      </div>

      <main className="mono-body">
        <section className="mono-section mono-section-lead" id="mono-about">
          {heading("About me", number())}
          <AboutLead data={data} />
          {data.summary ? (
            <div className="mono-about">{paragraphs(data.summary).map((text) => <p key={text}>{text}</p>)}</div>
          ) : <Empty section="about" />}
        </section>

        <section className="mono-section" id="mono-experience">
          {heading("Experience", number())}
          {data.experiences.length ? (
            <ul className="mono-rows">
              {data.experiences.map((job) => (
                <li key={job.id} className="mono-row">
                  <span className="mono-row-date">{rangeText(job)}</span>
                  <div>
                    <h3>{job.title}</h3>
                    <p className="mono-row-org">{[job.organization, job.location].filter(Boolean).join(" · ")}</p>
                    {job.bullets.length > 0 && (
                      <ul className="mono-bullets">{job.bullets.slice(0, 4).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty section="experience" />}
        </section>

        <section className="mono-section" id="mono-education">
          {heading("Education", number())}
          {data.educations.length ? (
            <ul className="mono-rows">
              {data.educations.map((school) => (
                <li key={school.id} className="mono-row">
                  <span className="mono-row-date">{rangeText(school)}</span>
                  <div>
                    <h3>{[school.degree, school.fieldOfStudy].filter(Boolean).join(", ") || school.institution}</h3>
                    <p className="mono-row-org mb-0">{school.institution}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty section="education" />}
        </section>

        <section className="mono-section" id="mono-skills">
          {heading("Skills", number())}
          {data.skills.length ? (
            <div className="mono-skills">
              {skills.featured.length > 0 && (
                <div>
                  <h3 className="mono-small-title">Key skills</h3>
                  <div className="mono-tags mono-tags-lg">
                    {skills.featured.map((skill) => <span key={skill.id} title={levelOf(skill.rating)}>{skill.name}</span>)}
                  </div>
                </div>
              )}
              <OtherSkills skills={skills.others} title={skills.featured.length ? "Other skills" : "Skills"} />
            </div>
          ) : <Empty section="skills" />}
        </section>

        {data.projects.length > 0 && (
          <section className="mono-section" id="mono-work">
            {heading("Selected Work", number())}
            <ProjectLayout count={data.projects.length} className="mono-projects">
              {data.projects.map((project, index) => (
                <article key={project.id} className="mono-project">
                  <span className="mono-project-no">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{project.title}</h3>
                  <p className="mono-project-meta">{[project.role, project.source].filter(Boolean).join(" · ")}</p>
                  {(project.description || project.bullets[0]) && (
                    <p>{project.description || project.bullets[0]}</p>
                  )}
                  {project.skills.length > 0 && (
                    <div className="mono-tags">{project.skills.slice(0, 6).map((skill) => <span key={skill}>{skill}</span>)}</div>
                  )}
                  {project.link && (
                    <a href={project.link} target="_blank" rel="noreferrer" className="mono-link">View project <i className="bi bi-arrow-up-right" aria-hidden="true" /></a>
                  )}
                </article>
              ))}
            </ProjectLayout>
          </section>
        )}

        {data.certifications.length > 0 && (
          <section className="mono-section">
            {heading("Certifications", number())}
            <ul className="mono-rows">
              {data.certifications.map((cert) => (
                <li key={cert.id} className="mono-row">
                  <span className="mono-row-date">{dateText(cert.date)}</span>
                  <div>
                    <h3>{cert.title}</h3>
                    {cert.subtitle && <p className="mono-row-org mb-0">{cert.subtitle}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.achievements.length > 0 && (
          <section className="mono-section">
            {heading("Achievements", number())}
            <ul className="mono-rows">
              {data.achievements.map((item) => (
                <li key={item.id} className="mono-row">
                  <span className="mono-row-date">{dateText(item.date)}</span>
                  <div>
                    <h3>{item.title}</h3>
                    {item.subtitle && <p className="mono-row-org">{item.subtitle}</p>}
                    {item.description && <p className="mb-0">{item.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.recommendations.length > 0 && (
          <section className="mono-section">
            {heading("Kind Words", number())}
            <div className="mono-quotes">
              {data.recommendations.map((item) => (
                <figure key={item.id} className="mono-quote">
                  <blockquote>“{item.text || item.relationship}”</blockquote>
                  <figcaption>
                    <strong>{item.name}</strong>
                    <span>{[item.title, item.organization].filter(Boolean).join(", ") || item.relationship}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {hasExtras(data) && (
          <section className="mono-section">
            <ExtraSections data={data} heading={(title) => heading(title, number())} />
          </section>
        )}

        <section className="mono-contact" id="mono-contact">
          <p className="mono-small-title">Have a project in mind?</p>
          <h2>Let's work together. <span className="mono-outline">Say hello.</span></h2>
          <div className="mono-contact-links">
            {links.length ? links.map((link) => <ContactLink key={link.href} link={link} className="mono-pill mono-pill-light" />)
              : <Empty section="profile" compact />}
          </div>
        </section>
      </main>
    </div>
  );
}
