import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./cosmos.css";

// Deep space: a starfield, a ringed planet and sections as orbits
export default function CosmosPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="cos-link" />);

  return (
    <div className="pf pf-cosmos">
      <header className="cos-hero">
        <div className="cos-planet" aria-hidden="true"><span>{hero.initials}</span></div>
        <div className="cos-hero-text">
          <p className="cos-kicker">Mission log{hero.location ? ` · ${hero.location}` : ""}</p>
          <h1 className="cos-name">{hero.name}</h1>
          <p className="cos-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary cos-lede">{hero.lede}</p>}
          {hero.stats.length > 0 && (
            <div className="cos-stats">
              {hero.stats.map((stat) => (
                <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
              ))}
            </div>
          )}
          <nav className="cos-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </div>
      </header>

      <main className="cos-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`cos-${id}`} className="cos-section">
              <h2 className="cos-heading"><span className="cos-orbit">{number}</span>{title}</h2>
              {body}
            </section>
          )}
        />
      </main>

      <footer className="cos-foot">
        <h2>Open a channel</h2>
        <nav className="cos-links">{links}</nav>
      </footer>
    </div>
  );
}
