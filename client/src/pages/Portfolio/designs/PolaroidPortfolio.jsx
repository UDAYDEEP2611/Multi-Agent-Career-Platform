import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./polaroid.css";

// A corkboard: an instant photo, a taped index card and pinned paper sheets
export default function PolaroidPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="pol-link" />);

  return (
    <div className="pf pf-polaroid">
      <header className="pol-hero">
        <figure className="pol-photo">
          <div className="pol-shot" aria-hidden="true"><span>{hero.initials}</span></div>
          <figcaption>{hero.first}{hero.location ? `, ${hero.location}` : ""}</figcaption>
        </figure>

        <div className="pol-card">
          <h1 className="pol-name">{hero.name}</h1>
          <p className="pol-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary pol-lede">{hero.lede}</p>}
          {hero.stats.length > 0 && (
            <ul className="pol-stats">
              {hero.stats.map((stat) => <li key={stat.label}><strong>{stat.value}</strong> {stat.label}</li>)}
            </ul>
          )}
          <nav className="pol-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </div>
      </header>

      <main className="pol-board">
        <Sections
          data={data}
          render={({ id, title, body }) => (
            <section id={`pol-${id}`} className="pol-section">
              <div className="pol-sheet">
                <h2 className="pol-heading"><span>{title}</span></h2>
                {body}
              </div>
            </section>
          )}
        />
      </main>

      <footer className="pol-foot">
        <div className="pol-note">
          <p>Say hello!</p>
          <nav className="pol-links">{links}</nav>
        </div>
      </footer>
    </div>
  );
}
