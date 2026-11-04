import { AboutLead, ContactLink, Empty, ExtraSections, ProjectLayout } from "./PortfolioParts";
import {
  contactLinks, dateText, hasExtras, ledeOf, paragraphs, rangeText, skillSplit, statsOf, levelOf
} from "./portfolioKit";

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "dev";

// For developers: a terminal hero, monospace type, a skills tree and git-log career
export default function TerminalPortfolio({ data }) {
  const { contact } = data;
  const links = contactLinks(contact);
  const stats = statsOf(data);
  const handle = slug(contact.name);
  const { featured, others } = skillSplit(data.skills);
  const heading = (command, title) => (
    <div className="term-heading">
      <span className="term-prompt">~/{handle} $</span> <span className="term-cmd">{command}</span>
      <h2>{title}</h2>
    </div>
  );

  return (
    <div className="pf pf-terminal">
      <nav className="term-nav">
        <span className="term-logo">{"{"}dev.<span>{handle}</span>{"}"}</span>
        <div className="term-nav-links">
          <a href="#term-about">./about</a>
          <a href="#term-experience">./experience</a>
          <a href="#term-education">./education</a>
          <a href="#term-skills">./skills</a>
          {data.projects.length > 0 && <a href="#term-projects">./projects</a>}
          <a href="#term-contact">./contact</a>
        </div>
      </nav>

      <header className="term-hero">
        <div className="term-window">
          <div className="term-bar">
            <span className="term-light red" /><span className="term-light yellow" /><span className="term-light green" />
            <span className="term-bar-title">{handle}@portfolio: ~</span>
          </div>
          <div className="term-screen">
            <p><span className="term-prompt">$</span> whoami</p>
            <h1 className="term-name">{contact.name}</h1>
            <p className="term-role">{"// "}{data.headline || "your job title"}</p>
            <p><span className="term-prompt">$</span> cat about.txt</p>
            {data.summary ? (
              <p className="pf-hero-summary term-out">{ledeOf(data)}</p>
            ) : <Empty section="about" compact />}
            {stats.length > 0 && (
              <>
                <p><span className="term-prompt">$</span> stats --summary</p>
                <p className="term-out">
                  {stats.map((stat) => (
                    <span key={stat.label} className="term-stat"><span className="term-key">{stat.label.toLowerCase().replace(/\s+/g, "_")}</span>=<span className="term-val">{stat.value}</span></span>
                  ))}
                </p>
              </>
            )}
            <p><span className="term-prompt">$</span> <span className="term-cursor" /></p>
          </div>
        </div>
      </header>

      <main className="term-body">
        <section id="term-about" className="term-section">
          {heading("cat about_me.md", "About Me")}
          {data.summary ? (
            <div className="term-card term-about">
              <AboutLead data={data} />
              {paragraphs(data.summary).map((text) => <p key={text} className="term-out">{text}</p>)}
            </div>
          ) : <Empty section="about" />}
        </section>

        <section id="term-experience" className="term-section">
          {heading("git log --career", "Experience")}
          {data.experiences.length ? (
            <ol className="term-log">
              {data.experiences.map((job) => (
                <li key={job.id}>
                  <p className="term-commit">
                    <span className="term-hash">commit {job.id.slice(-7)}</span>
                    {job.current && <span className="term-head"> (HEAD -&gt; current)</span>}
                  </p>
                  <p className="term-meta">Date: {rangeText(job)}</p>
                  <h3>{job.title} <span className="term-at">@ {job.organization}</span></h3>
                  {job.bullets.slice(0, 4).map((bullet) => <p key={bullet} className="term-line">+ {bullet}</p>)}
                </li>
              ))}
            </ol>
          ) : <Empty section="experience" />}
        </section>

        <section id="term-education" className="term-section">
          {heading("cat education.md", "Education")}
          {data.educations.length ? (
            <div className="term-projects">
              {data.educations.map((school) => (
                <div key={school.id} className="term-card">
                  <h3>{[school.degree, school.fieldOfStudy].filter(Boolean).join(", ") || school.institution}</h3>
                  <p className="term-meta mb-0">{school.institution} · {rangeText(school)}</p>
                </div>
              ))}
            </div>
          ) : <Empty section="education" />}
        </section>

        <section id="term-skills" className="term-section">
          {heading("tree ./skills", "My Skills")}
          {data.skills.length ? (
            <div className="term-tree">
              <div className="term-root">MY SKILLS</div>
              <div className="term-branches">
                {featured.length > 0 && (
                  <div className="term-branch">
                    <span className="term-branch-title">key/</span>
                    <div className="term-leaves">
                      {featured.map((skill) => (
                        <span key={skill.id} className={`term-leaf lvl-${skill.rating}`} title={levelOf(skill.rating)}>{skill.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {others.length > 0 && (
                  <div className="term-branch">
                    <span className="term-branch-title">{featured.length ? "other/" : "all/"}</span>
                    <p className="term-out term-plain">{others.map((skill) => skill.name).join(", ")}</p>
                  </div>
                )}
              </div>
            </div>
          ) : <Empty section="skills" />}
        </section>

        {data.projects.length > 0 && (
          <section id="term-projects" className="term-section">
            {heading("ls ./projects", "Projects I've Built")}
            <ProjectLayout count={data.projects.length} className="term-projects">
              {data.projects.map((project) => (
                <article key={project.id} className="term-card">
                  <div className="term-card-top">
                    <i className="bi bi-folder2-open" aria-hidden="true" />
                    {project.link && (
                      <a href={project.link} target="_blank" rel="noreferrer" aria-label={`Open ${project.title}`}><i className="bi bi-box-arrow-up-right" aria-hidden="true" /></a>
                    )}
                  </div>
                  <h3>{project.title}</h3>
                  {(project.description || project.bullets[0]) && <p>{project.description || project.bullets[0]}</p>}
                  {project.skills.length > 0 && (
                    <p className="term-stack">{project.skills.slice(0, 6).join("  ")}</p>
                  )}
                </article>
              ))}
            </ProjectLayout>
          </section>
        )}

        {data.certifications.length > 0 && (
          <section className="term-section">
            {heading("ls ./certs", "Certifications")}
            <div className="term-projects">
              {data.certifications.map((cert) => (
                <div key={cert.id} className="term-card">
                  <h3>{cert.title}</h3>
                  <p className="term-meta mb-0">{[cert.subtitle, dateText(cert.date)].filter(Boolean).join(" · ")}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.achievements.length > 0 && (
          <section className="term-section">
            {heading("grep -r 'achievement'", "Achievements")}
            <div className="term-projects">
              {data.achievements.map((item) => (
                <div key={item.id} className="term-card">
                  <h3><i className="bi bi-trophy me-2" aria-hidden="true" />{item.title}</h3>
                  <p className="term-meta mb-0">{[item.subtitle, dateText(item.date)].filter(Boolean).join(" · ")}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.recommendations.length > 0 && (
          <section className="term-section">
            {heading("cat reviews.log", "Recommendations")}
            <div className="term-projects">
              {data.recommendations.map((item) => (
                <figure key={item.id} className="term-card mb-0">
                  <blockquote className="term-out">"{item.text || item.relationship}"</blockquote>
                  <figcaption className="term-meta">— {item.name}{(item.title || item.organization) && `, ${[item.title, item.organization].filter(Boolean).join(", ")}`}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {hasExtras(data) && (
          <section className="term-section">
            <ExtraSections data={data} heading={(title) => heading(`cat ${title.toLowerCase()}.md`, title)} />
          </section>
        )}

        <section id="term-contact" className="term-section term-contact">
          {heading("./contact --send", "Get In Touch")}
          <div className="term-contact-links">
            {links.length ? links.map((link) => <ContactLink key={link.href} link={link} className="term-btn" />)
              : <Empty section="profile" compact />}
          </div>
        </section>
      </main>
    </div>
  );
}
