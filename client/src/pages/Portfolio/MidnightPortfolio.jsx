import { AboutLead, ContactLink, Empty, ExtraSections, OtherSkills, ProjectLayout } from "./PortfolioParts";
import {
  contactLinks, counter, dateText, hasExtras, ledeOf, initials, paragraphs, rangeText, skillSplit, statsOf, levelOf
} from "./portfolioKit";

// Dark navy with a glowing orb, glass cards and an italic serif accent
export default function MidnightPortfolio({ data }) {
  const { contact } = data;
  const links = contactLinks(contact);
  const stats = statsOf(data);
  const number = counter();
  const role = data.headline || "Your job title";
  const skills = skillSplit(data.skills);
  const [lead, ...tail] = role.split(/\s+/);
  const heading = (eyebrow, title) => (
    <div className="mid-heading">
      <span className="mid-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );

  return (
    <div className="pf pf-midnight">
      <div className="mid-glow mid-glow-1" aria-hidden="true" />
      <div className="mid-glow mid-glow-2" aria-hidden="true" />

      <nav className="mid-nav">
        <span className="mid-logo">{contact.name}</span>
        <div className="mid-nav-links">
          <a href="#mid-about">About</a>
          <a href="#mid-education">Education</a>
          <a href="#mid-skills">Skills</a>
          {data.projects.length > 0 && <a href="#mid-work">Work</a>}
          <a href="#mid-contact">Contact</a>
        </div>
      </nav>

      <header className="mid-hero">
        <div className="mid-orb" aria-hidden="true"><span>{initials(contact.name)}</span></div>
        <h1 className={`mid-title ${role.length > 60 ? "mid-title-long" : role.length > 30 ? "mid-title-mid" : ""}`}>
          <span className="mid-gradient">{lead}</span>
          {tail.length > 0 && <> <em>{tail.join(" ")}</em></>}
        </h1>
        <p className="mid-sub">
          {contact.name}
          {contact.location && <> · <i className="bi bi-geo-alt" aria-hidden="true" /> {contact.location}</>}
        </p>
        {data.summary && <p className="pf-hero-summary mid-lede">{ledeOf(data)}</p>}
        {stats.length > 0 && (
          <div className="mid-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="mid-glass mid-stat">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mid-hero-links">
          {links.length ? links.slice(0, 4).map((link) => (
            <ContactLink key={link.href} link={link} className="mid-chip" />
          )) : <Empty section="profile" compact />}
        </div>
      </header>

      <main className="mid-body">
        <section id="mid-about" className="mid-section">
          {heading(`${number()} — About me`, "A little about me")}
          {data.summary ? (
            <div className="mid-glass mid-about">
              <AboutLead data={data} />
              {paragraphs(data.summary).map((text) => <p key={text}>{text}</p>)}
            </div>
          ) : <Empty section="about" />}
        </section>

        <section className="mid-section">
          {heading(`${number()} — Experience`, "Where I've worked")}
          {data.experiences.length ? (
            <ol className="mid-timeline">
              {data.experiences.map((job) => (
                <li key={job.id} className="mid-glass mid-job">
                  <span className="mid-date">{rangeText(job)}</span>
                  <h3>{job.title}</h3>
                  <p className="mid-org">{[job.organization, job.location].filter(Boolean).join(" · ")}</p>
                  {job.bullets.length > 0 && (
                    <ul>{job.bullets.slice(0, 4).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                  )}
                  {job.skills.length > 0 && (
                    <div className="mid-tags">{job.skills.slice(0, 8).map((skill) => <span key={skill}>{skill}</span>)}</div>
                  )}
                </li>
              ))}
            </ol>
          ) : <Empty section="experience" />}
        </section>

        <section id="mid-education" className="mid-section">
          {heading(`${number()} — Education`, "Learning")}
          {data.educations.length ? (
            <div className="mid-bento">
              {data.educations.map((school) => (
                <div key={school.id} className="mid-glass mid-card">
                  <h3>{[school.degree, school.fieldOfStudy].filter(Boolean).join(", ") || school.institution}</h3>
                  <p className="mid-org">{school.institution}</p>
                  <span className="mid-date">{rangeText(school)}</span>
                </div>
              ))}
            </div>
          ) : <Empty section="education" />}
        </section>

        <section id="mid-skills" className="mid-section">
          {heading(`${number()} — Skills`, "What I work with")}
          {data.skills.length ? (
            <div className="mid-skill-grid">
              {skills.featured.map((skill) => (
                <div key={skill.id} className="mid-glass mid-skill">
                  <div className="d-flex justify-content-between gap-2">
                    <span>{skill.name}</span>
                    <small>{levelOf(skill.rating)}</small>
                  </div>
                  <div className="mid-bar"><span style={{ width: `${(skill.rating || 0) * 20}%` }} /></div>
                </div>
              ))}
              {skills.others.length > 0 && (
                <div className="mid-glass mid-soft">
                  <OtherSkills skills={skills.others} title={skills.featured.length ? "Other skills" : "Skills"} />
                </div>
              )}
            </div>
          ) : <Empty section="skills" />}
        </section>

        {data.projects.length > 0 && (
          <section id="mid-work" className="mid-section">
            {heading(`${number()} — Work`, "Selected projects")}
            <ProjectLayout count={data.projects.length} className="mid-bento">
              {data.projects.map((project) => (
                <article key={project.id} className="mid-glass mid-project">
                  <span className="mid-project-source">{project.source}</span>
                  <h3>{project.title}</h3>
                  {(project.description || project.bullets[0]) && <p>{project.description || project.bullets[0]}</p>}
                  {project.skills.length > 0 && (
                    <div className="mid-tags">{project.skills.slice(0, 6).map((skill) => <span key={skill}>{skill}</span>)}</div>
                  )}
                  {project.link && (
                    <a href={project.link} target="_blank" rel="noreferrer" className="mid-arrow" aria-label={`Open ${project.title}`}>
                      <i className="bi bi-arrow-up-right" aria-hidden="true" />
                    </a>
                  )}
                </article>
              ))}
            </ProjectLayout>
          </section>
        )}

        {data.certifications.length > 0 && (
          <section className="mid-section">
            {heading(`${number()} — Certifications`, "Credentials")}
            <div className="mid-bento">
              {data.certifications.map((cert) => (
                <div key={cert.id} className="mid-glass mid-card">
                  <h3><i className="bi bi-patch-check me-2" aria-hidden="true" />{cert.title}</h3>
                  <p className="mid-org">{cert.subtitle}</p>
                  <span className="mid-date">{dateText(cert.date)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.achievements.length > 0 && (
          <section className="mid-section">
            {heading(`${number()} — Achievements`, "Milestones")}
            <div className="mid-bento">
              {data.achievements.map((item) => (
                <div key={item.id} className="mid-glass mid-card">
                  <i className="bi bi-trophy mid-trophy" aria-hidden="true" />
                  <h3>{item.title}</h3>
                  {item.subtitle && <p className="mid-org">{item.subtitle}</p>}
                  {item.description && <p className="mb-0">{item.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.recommendations.length > 0 && (
          <section className="mid-section">
            {heading(`${number()} — Testimonials`, "What people say")}
            <div className="mid-bento">
              {data.recommendations.map((item) => (
                <figure key={item.id} className="mid-glass mid-card mb-0">
                  <blockquote className="mid-quote">“{item.text || item.relationship}”</blockquote>
                  <figcaption className="mid-org mb-0">
                    <strong className="text-white">{item.name}</strong> · {[item.title, item.organization].filter(Boolean).join(", ") || item.relationship}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {hasExtras(data) && (
          <section className="mid-section">
            <ExtraSections data={data} heading={(title) => heading(`${number()} — More`, title)} />
          </section>
        )}

        <section id="mid-contact" className="mid-contact mid-glass">
          <h2>Let's create something <em>remarkable</em></h2>
          <div className="mid-hero-links">
            {links.length ? links.map((link) => <ContactLink key={link.href} link={link} className="mid-chip" />)
              : <Empty section="profile" compact />}
          </div>
        </section>
      </main>
    </div>
  );
}
