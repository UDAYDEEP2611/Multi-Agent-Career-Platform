import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./candy.css";

const ICONS = {
  about: "bi-emoji-smile", experience: "bi-briefcase", education: "bi-mortarboard", skills: "bi-stars",
  projects: "bi-rocket-takeoff", certifications: "bi-patch-check", achievements: "bi-trophy",
  recommendations: "bi-chat-heart", volunteering: "bi-heart", publications: "bi-journal-text",
  patents: "bi-lightbulb", interests: "bi-palette"
};

// Soft pastel blobs and squishy rounded cards, each section its own flavour
export default function CandyPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="cd-link" />);

  return (
    <div className="pf pf-candy">
      <header className="cd-hero">
        <div className="cd-avatar" aria-hidden="true">{hero.initials}</div>
        <p className="cd-hi">Hey there! I'm</p>
        <h1 className="cd-name">{hero.name}</h1>
        <p className="cd-role">{hero.role}</p>
        {hero.lede && <p className="pf-hero-summary cd-lede">{hero.lede}</p>}
        {hero.stats.length > 0 && (
          <div className="cd-stats">
            {hero.stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
          </div>
        )}
        <nav className="cd-links">{links.length ? links : <Empty section="profile" compact />}</nav>
      </header>

      <main className="cd-body">
        <Sections
          data={data}
          render={({ id, title, body }) => (
            <section id={`cd-${id}`} className="cd-section">
              <h2 className="cd-heading">
                <span className="cd-icon"><i className={`bi ${ICONS[id] || "bi-star"}`} aria-hidden="true" /></span>
                {title}
              </h2>
              {body}
            </section>
          )}
        />
      </main>

      <footer className="cd-foot">
        <h2>Let's be friends!</h2>
        <nav className="cd-links">{links}</nav>
      </footer>
    </div>
  );
}
