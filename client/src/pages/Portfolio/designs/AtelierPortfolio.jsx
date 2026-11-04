import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./atelier.css";

// A fashion-house lookbook: an oversized italic name, hairlines and a lot of quiet space
export default function AtelierPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="atl-link" />);

  return (
    <div className="pf pf-atelier">
      <header className="atl-hero">
        <div className="atl-monogram" aria-hidden="true">{hero.initials}</div>
        <p className="atl-label">{hero.role}</p>
        <h1 className="atl-name">
          {hero.first} {hero.last && <em>{hero.last}</em>}
        </h1>
        <div className="atl-hero-foot">
          {hero.lede && <p className="pf-hero-summary atl-lede">{hero.lede}</p>}
          <div>
            {hero.stats.length > 0 && (
              <ul className="atl-stats">
                {hero.stats.map((stat) => <li key={stat.label}><strong>{stat.value}</strong> {stat.label}</li>)}
              </ul>
            )}
            <nav className="atl-links">{links.length ? links : <Empty section="profile" compact />}</nav>
          </div>
        </div>
      </header>

      <main className="atl-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`atl-${id}`} className="atl-section">
              <h2 className="atl-heading"><span>{number}</span>{title}</h2>
              <div className="atl-section-body">{body}</div>
            </section>
          )}
        />
      </main>

      <footer className="atl-foot">
        <p className="atl-foot-name">{hero.name}</p>
        <nav className="atl-links">{links}</nav>
      </footer>
    </div>
  );
}
