import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./atlas.css";

// A topographic map: contour lines, a compass rose and sections as waypoints on a route
export default function AtlasPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} />);

  return (
    <div className="pf pf-atlas">
      <header className="at-hero">
        <div className="at-compass" aria-hidden="true"><span>N</span></div>
        <div className="at-hero-text">
          <p className="at-kicker"><i className="bi bi-geo-alt-fill" aria-hidden="true" /> {hero.location || "Field notes"}</p>
          <h1 className="at-name">{hero.name}</h1>
          <p className="at-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary at-lede">{hero.lede}</p>}
          {hero.stats.length > 0 && (
            <dl className="at-legend">
              {hero.stats.map((stat) => <div key={stat.label}><dt>{stat.value}</dt><dd>{stat.label}</dd></div>)}
            </dl>
          )}
          <div className="at-scale" aria-hidden="true"><i /><i /><i /><i /><span>Scale 1 : career</span></div>
          <nav className="at-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </div>
      </header>

      <main className="at-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`at-${id}`} className="at-section">
              <span className="at-marker" aria-hidden="true"><i className="bi bi-geo-alt-fill" /></span>
              <h2 className="at-heading"><span>Waypoint {number}</span>{title}</h2>
              {body}
            </section>
          )}
        />
      </main>

      <footer className="at-foot">
        <p>You have reached your destination.</p>
        <nav className="at-links">{links}</nav>
      </footer>
    </div>
  );
}
