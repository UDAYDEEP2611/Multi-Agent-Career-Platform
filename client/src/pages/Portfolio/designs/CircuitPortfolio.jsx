import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./circuit.css";

// A printed circuit board: the name on a chip, sections as labelled components
export default function CircuitPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="ci-link" />);

  return (
    <div className="pf pf-circuit">
      <header className="ci-hero">
        <div className="ci-chip">
          <span className="ci-notch" aria-hidden="true" />
          <p className="ci-part">U1 · {hero.initials}-{String(data.skills.length).padStart(2, "0")}</p>
          <h1 className="ci-name">{hero.name}</h1>
          <p className="ci-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary ci-lede">{hero.lede}</p>}
        </div>
        {hero.stats.length > 0 && (
          <div className="ci-stats">
            {hero.stats.map((stat) => (
              <div key={stat.label}><span className="ci-via" aria-hidden="true" /><strong>{stat.value}</strong> {stat.label}</div>
            ))}
          </div>
        )}
        <nav className="ci-links">{links.length ? links : <Empty section="profile" compact />}</nav>
      </header>

      <main className="ci-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`ci-${id}`} className="ci-section">
              <h2 className="ci-heading"><span>U{number}</span>{title}</h2>
              {body}
            </section>
          )}
        />
      </main>

      <footer className="ci-foot">
        <p>// signal ends here — connect:</p>
        <nav className="ci-links">{links}</nav>
      </footer>
    </div>
  );
}
