import { AboutLead, ContactLink, Empty, ExtraSections, OtherSkills, ProjectLayout } from "./PortfolioParts";
import {
  contactLinks, dateText, hasExtras, ledeOf, firstName, initials, paragraphs, rangeText, skillSplit, statsOf, topSkills, levelOf
} from "./portfolioKit";

// Light and friendly: a lime gradient hero, rounded cards, numbered steps
export default function FreshPortfolio({ data }) {
  const { contact } = data;
  const links = contactLinks(contact);
  const stats = statsOf(data);
  const skills = skillSplit(data.skills);
  const marquee = topSkills(data.skills);
  const heading = (title, sub) => (
    <div className="fresh-heading">
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
  );

  return (
    <div className="pf pf-fresh">
      <nav className="fresh-nav">
        <span className="fresh-logo">{firstName(contact.name)}<span>.</span></span>
        <div className="fresh-nav-links">
          <a href="#fresh-about">About</a>
          <a href="#fresh-journey">Journey</a>
          <a href="#fresh-education">Education</a>
          <a href="#fresh-skills">Skills</a>
          {data.projects.length > 0 && <a href="#fresh-work">Work</a>}
          <a href="#fresh-contact" className="fresh-btn fresh-btn-dark">Contact</a>
        </div>
      </nav>

      <header className="fresh-hero">
        <div className="fresh-hero-text">
          <span className="fresh-badge"><span className="fresh-dot" />{contact.location || "Portfolio"}</span>
          <h1>
            Hi, I'm {firstName(contact.name)}
            <span className="fresh-script">{data.headline || "Your job title"}</span>
          </h1>
          {data.summary ? <p className="pf-hero-summary fresh-lede">{ledeOf(data)}</p> : <Empty section="about" compact />}
          <div className="d-flex flex-wrap gap-2 mt-4">
            <a href="#fresh-about" className="fresh-btn fresh-btn-dark">About me <i className="bi bi-arrow-right" aria-hidden="true" /></a>
            <a href="#fresh-contact" className="fresh-btn">Get in touch</a>
          </div>
        </div>

        <div className="fresh-hero-visual">
          <div className="fresh-avatar" aria-hidden="true">{initials(contact.name)}</div>
          {stats.map((stat, index) => (
            <div key={stat.label} className={`fresh-float fresh-float-${index + 1}`}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </header>

      {data.skills.length > 0 && (
        <div className="fresh-marquee" aria-label="Skills">
          <div className="fresh-marquee-track">
            {[...marquee, ...marquee].map((skill, index) => (
              <span key={`${skill}-${index}`}><i className="bi bi-asterisk" aria-hidden="true" />{skill}</span>
            ))}
          </div>
        </div>
      )}

      <main className="fresh-body">
        <section id="fresh-about" className="fresh-section">
          {heading("About me", "A quick introduction")}
          {data.summary ? (
            <div className="fresh-card fresh-about">
              <AboutLead data={data} />
              {paragraphs(data.summary).map((text) => <p key={text}>{text}</p>)}
              {contact.location && <p className="fresh-muted mb-0"><i className="bi bi-geo-alt me-1" aria-hidden="true" />{contact.location}</p>}
            </div>
          ) : <Empty section="about" />}
        </section>

        <section id="fresh-journey" className="fresh-section">
          {heading("My journey", "Here's how it's gone so far")}
          {data.experiences.length ? (
            <div className="fresh-steps">
              {data.experiences.map((job, index) => (
                <article key={job.id} className="fresh-card fresh-step">
                  <span className="fresh-step-no">{String(index + 1).padStart(2, "0")}</span>
                  <p className="fresh-muted small mb-1">{rangeText(job)}</p>
                  <h3>{job.title}</h3>
                  <p className="fresh-org">{job.organization}</p>
                  {job.bullets.length > 0 && (
                    <ul>{job.bullets.slice(0, 3).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                  )}
                </article>
              ))}
            </div>
          ) : <Empty section="experience" />}
        </section>

        <section id="fresh-education" className="fresh-section">
          {heading("Education", "Where I learned")}
          {data.educations.length ? (
            <div className="fresh-works">
              {data.educations.map((school) => (
                <div key={school.id} className="fresh-card fresh-mini">
                  <i className="bi bi-mortarboard" aria-hidden="true" />
                  <div>
                    <h3>{[school.degree, school.fieldOfStudy].filter(Boolean).join(", ") || school.institution}</h3>
                    <p className="fresh-muted mb-0">{school.institution} · {rangeText(school)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty section="education" />}
        </section>

        <section id="fresh-skills" className="fresh-section">
          {heading("Skills & tools", "What I bring to a team")}
          {data.skills.length ? (
            <div className="fresh-skill-wrap">
              {skills.featured.length > 0 && (
                <div className="fresh-skills">
                  {skills.featured.map((skill) => (
                    <div key={skill.id} className="fresh-skill">
                      <span>{skill.name}</span>
                      <span className="fresh-dots" title={levelOf(skill.rating)}>
                        {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= skill.rating ? "on" : ""} />)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <OtherSkills skills={skills.others} title={skills.featured.length ? "Other skills" : "Skills"} />
            </div>
          ) : <Empty section="skills" />}
        </section>

        {data.projects.length > 0 && (
          <section id="fresh-work" className="fresh-section">
            {heading("Selected works", "Things I've built and shipped")}
            <ProjectLayout count={data.projects.length} className="fresh-works">
              {data.projects.map((project, index) => (
                <article key={project.id} className="fresh-card fresh-work">
                  <div className={`fresh-work-cover fresh-cover-${index % 4}`}>
                    <span>{project.title}</span>
                  </div>
                  <div className="fresh-work-body">
                    <p className="fresh-muted small mb-1">{project.source}</p>
                    <h3>{project.title}</h3>
                    {(project.description || project.bullets[0]) && <p>{project.description || project.bullets[0]}</p>}
                    {project.skills.length > 0 && (
                      <div className="fresh-tags">{project.skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}</div>
                    )}
                    {project.link && (
                      <a href={project.link} target="_blank" rel="noreferrer" className="fresh-link">View project <i className="bi bi-arrow-up-right" aria-hidden="true" /></a>
                    )}
                  </div>
                </article>
              ))}
            </ProjectLayout>
          </section>
        )}

        {data.certifications.length > 0 && (
          <section className="fresh-section">
            {heading("Certifications")}
            <div className="fresh-works">
              {data.certifications.map((cert) => (
                <div key={cert.id} className="fresh-card fresh-mini">
                  <i className="bi bi-patch-check" aria-hidden="true" />
                  <div>
                    <h3>{cert.title}</h3>
                    <p className="fresh-muted mb-0">{[cert.subtitle, dateText(cert.date)].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.achievements.length > 0 && (
          <section className="fresh-section">
            {heading("Achievements")}
            <div className="fresh-works">
              {data.achievements.map((item) => (
                <div key={item.id} className="fresh-card fresh-mini">
                  <i className="bi bi-trophy" aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p className="fresh-muted mb-0">{[item.subtitle, dateText(item.date)].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.recommendations.length > 0 && (
          <section className="fresh-section">
            {heading("Testimonials", "What people I've worked with say")}
            <div className="fresh-works">
              {data.recommendations.map((item) => (
                <figure key={item.id} className="fresh-card fresh-quote">
                  <i className="bi bi-quote" aria-hidden="true" />
                  <blockquote>{item.text || item.relationship}</blockquote>
                  <figcaption>
                    <span className="fresh-quote-avatar">{initials(item.name)}</span>
                    <span><strong>{item.name}</strong><br /><small>{[item.title, item.organization].filter(Boolean).join(", ") || item.relationship}</small></span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {hasExtras(data) && (
          <section className="fresh-section">
            <ExtraSections data={data} heading={(title) => heading(title)} />
          </section>
        )}

        <section id="fresh-contact" className="fresh-cta">
          <h2>Let's build something great together</h2>
          <p>Have an idea or a role in mind? I'd love to hear about it.</p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            {links.length ? links.map((link) => <ContactLink key={link.href} link={link} className="fresh-btn" />)
              : <Empty section="profile" compact />}
          </div>
        </section>
      </main>
    </div>
  );
}
