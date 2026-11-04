import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf, sectionPlan, titleOf } from "../portfolioKit";
import "./base.css";
import "./sidebar.css";

const ICONS = {
  about: "bi-person", experience: "bi-briefcase", education: "bi-mortarboard", skills: "bi-lightning",
  projects: "bi-kanban", certifications: "bi-patch-check", achievements: "bi-trophy",
  recommendations: "bi-chat-quote", volunteering: "bi-heart", publications: "bi-journal-text",
  patents: "bi-lightbulb", interests: "bi-stars"
};

// A sticky profile sidebar beside a scrolling column of cards
export default function SidebarPortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-sidebar">
      <aside className="sb-side">
        <div className="sb-card">
          <div className="sb-avatar">{hero.initials}</div>
          <h1 className="sb-name">{hero.name}</h1>
          <p className="sb-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary sb-lede">{hero.lede}</p>}

          <div className="sb-links">
            {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="sb-link" />)
              : <Empty section="profile" compact />}
          </div>

          {hero.skills.length > 0 && (
            <div className="sb-top-skills">
              <span className="sb-label">Top skills</span>
              <div>{hero.skills.slice(0, 8).map((skill) => <span key={skill}>{skill}</span>)}</div>
            </div>
          )}
        </div>

        <nav className="sb-nav">
          {sectionPlan(data).map((id) => (
            <a key={id} href={`#sb-${id}`}><i className={`bi ${ICONS[id]}`} aria-hidden="true" />{titleOf(data, id)}</a>
          ))}
        </nav>
      </aside>

      <main className="sb-main">
        {hero.stats.length > 0 && (
          <div className="sb-stats">
            {hero.stats.map((stat) => (
              <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
            ))}
          </div>
        )}

        <Sections
          data={data}
          render={({ id, title, body }) => (
            <section id={`sb-${id}`} className="sb-section">
              <h2 className="sb-heading">
                <span className="sb-icon"><i className={`bi ${ICONS[id]}`} aria-hidden="true" /></span>
                {title}
              </h2>
              {body}
            </section>
          )}
        />

        <footer className="sb-footer">
          <p>Thanks for stopping by. Reach me through any of the links on the left.</p>
        </footer>
      </main>
    </div>
  );
}
