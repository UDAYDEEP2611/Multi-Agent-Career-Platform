import { AboutLead, ContactLink, Empty, ExtraSections, OtherSkills, ProjectLayout } from "./PortfolioParts";
import {
  contactLinks, counter, dateText, hasExtras, ledeOf, initials, paragraphs, rangeText, skillSplit, statsOf
} from "./portfolioKit";

// A magazine spread: cream paper, serif type, a black side rail and pull quotes
export default function EditorialPortfolio({ data }) {
  const { contact } = data;
  const links = contactLinks(contact);
  const stats = statsOf(data);
  const intro = paragraphs(data.summary);
  const skills = skillSplit(data.skills);
  const chapters = ["I", "II", "III", "IV", "V"];
  const number = counter();
  const chapter = () => `Chapter ${chapters[Number(number()) - 1]}`;
  const today = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const heading = (title, kicker) => (
    <header className="ed-heading">
      {kicker && <span className="ed-kicker">{kicker}</span>}
      <h2>{title}</h2>
    </header>
  );

  return (
    <div className="pf pf-editorial">
      <aside className="ed-rail">
        <div className="ed-monogram">{initials(contact.name)}</div>
        <nav className="ed-rail-nav">
          <a href="#ed-story">About</a>
          <a href="#ed-career">Career</a>
          <a href="#ed-education">Education</a>
          <a href="#ed-craft">Craft</a>
          {data.projects.length > 0 && <a href="#ed-work">Work</a>}
          <a href="#ed-contact">Contact</a>
        </nav>
        <div className="ed-rail-links">
          {links.filter((link) => link.href.startsWith("http")).map((link) => (
            <ContactLink key={link.href} link={link} iconOnly />
          ))}
        </div>
      </aside>

      <div className="ed-page">
        <div className="ed-masthead">
          <span>The Portfolio</span>
          <span>Issue · {today}</span>
          {contact.location && <span>{contact.location}</span>}
        </div>

        <header className="ed-hero">
          <h1>{contact.name}</h1>
          <p className="ed-standfirst">{data.headline || "Your job title"}</p>
          {data.summary && <p className="pf-hero-summary ed-lede">{ledeOf(data)}</p>}
        </header>

        <section id="ed-story" className="ed-story">
          {heading("About me", "Prologue")}
          <AboutLead data={data} className="ed-about-lead" />
          {intro.length ? (
            <>
              <blockquote className="ed-pull">“{intro[0]}”</blockquote>
              <div className="ed-columns">
                {intro.slice(1).map((text) => <p key={text}>{text}</p>)}
                {stats.map((stat) => (
                  <p key={stat.label} className="ed-fact"><strong>{stat.value}</strong> {stat.label.toLowerCase()}</p>
                ))}
              </div>
            </>
          ) : <Empty section="about" />}
        </section>

        <section id="ed-career" className="ed-section">
          {heading("Career", chapter())}
          {data.experiences.length ? (
            <div className="ed-career">
              {data.experiences.map((job) => (
                <article key={job.id} className="ed-job">
                  <p className="ed-date">{rangeText(job)}</p>
                  <h3>{job.title}</h3>
                  <p className="ed-meta">{[job.organization, job.location].filter(Boolean).join(", ")}</p>
                  {job.bullets.slice(0, 3).map((bullet) => <p key={bullet} className="ed-text">{bullet}</p>)}
                </article>
              ))}
            </div>
          ) : <Empty section="experience" />}
        </section>

        <section id="ed-education" className="ed-section">
          {heading("Education", chapter())}
          {data.educations.length ? (
            <div className="ed-career">
              {data.educations.map((school) => (
                <article key={school.id} className="ed-job">
                  <p className="ed-date">{rangeText(school)}</p>
                  <h3>{school.institution}</h3>
                  <p className="ed-meta">{[school.degree, school.fieldOfStudy].filter(Boolean).join(", ")}</p>
                </article>
              ))}
            </div>
          ) : <Empty section="education" />}
        </section>

        <section id="ed-craft" className="ed-section">
          {heading("The Craft", chapter())}
          {data.skills.length ? (
            <div className="ed-craft">
              {skills.featured.length > 0 && (
                <p className="ed-skill-line">{skills.featured.map((skill) => skill.name).join(" · ")}</p>
              )}
              <OtherSkills skills={skills.others} title={skills.featured.length ? "Also" : "Skills"} />
            </div>
          ) : <Empty section="skills" />}
        </section>

        {data.projects.length > 0 && (
          <section id="ed-work" className="ed-section">
            {heading("Selected Work", chapter())}
            <ProjectLayout count={data.projects.length} className="ed-work">
              {data.projects.map((project, index) => (
                <article key={project.id} className="ed-article">
                  <span className="ed-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{project.title}</h3>
                    <p className="ed-meta">{[project.role, project.source, rangeText(project)].filter(Boolean).join(" · ")}</p>
                    {(project.description || project.bullets[0]) && <p className="ed-text">{project.description || project.bullets[0]}</p>}
                    {project.skills.length > 0 && <p className="ed-tags">{project.skills.slice(0, 6).join(" / ")}</p>}
                    {project.link && (
                      <a href={project.link} target="_blank" rel="noreferrer" className="ed-readmore">Read more →</a>
                    )}
                  </div>
                </article>
              ))}
            </ProjectLayout>
          </section>
        )}

        {(data.certifications.length > 0 || data.achievements.length > 0) && (
          <div className="ed-grid">
            {data.certifications.length > 0 && (
              <section className="ed-section">
                {heading("Certifications")}
                {data.certifications.map((cert) => (
                  <div key={cert.id} className="ed-entry">
                    <h3>{cert.title}</h3>
                    <p className="ed-meta">{cert.subtitle}</p>
                    <p className="ed-date">{dateText(cert.date)}</p>
                  </div>
                ))}
              </section>
            )}

            {data.achievements.length > 0 && (
              <section className="ed-section">
                {heading("Honours")}
                {data.achievements.map((item) => (
                  <div key={item.id} className="ed-entry">
                    <h3>{item.title}</h3>
                    <p className="ed-meta">{[item.subtitle, dateText(item.date)].filter(Boolean).join(" · ")}</p>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {data.recommendations.length > 0 && (
          <section className="ed-section">
            {heading("In Their Words", "Letters")}
            <div className="ed-letters">
              {data.recommendations.map((item) => (
                <figure key={item.id} className="ed-letter">
                  <blockquote>{item.text || item.relationship}</blockquote>
                  <figcaption>— {item.name}{(item.title || item.organization) && `, ${[item.title, item.organization].filter(Boolean).join(", ")}`}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {hasExtras(data) && (
          <section className="ed-section">
            <ExtraSections data={data} heading={(title) => heading(title)} />
          </section>
        )}

        <footer id="ed-contact" className="ed-contact">
          <h2>Correspondence</h2>
          <p className="ed-text">For commissions, collaborations or a conversation:</p>
          <div className="ed-contact-links">
            {links.length ? links.map((link) => <ContactLink key={link.href} link={link} />)
              : <Empty section="profile" compact />}
          </div>
        </footer>
      </div>
    </div>
  );
}
