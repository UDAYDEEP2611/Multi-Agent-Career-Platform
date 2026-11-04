import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./riso.css";

// A risograph print: overprinted shapes, halftone dots and slightly off-register type
export default function RisoPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="rs2-link" />);

  return (
    <div className="pf pf-riso">
      <header className="rs2-hero">
        <div className="rs2-shapes" aria-hidden="true">
          <i className="rs2-sun" />
          <i className="rs2-block" />
          <i className="rs2-dots" />
        </div>
        <div className="rs2-hero-text">
          <p className="rs2-role">{hero.role}</p>
          <h1 className="rs2-name">{hero.name}</h1>
          {hero.lede && <p className="pf-hero-summary rs2-lede">{hero.lede}</p>}
          {hero.stats.length > 0 && (
            <ul className="rs2-stats">
              {hero.stats.map((stat) => <li key={stat.label}><strong>{stat.value}</strong> {stat.label}</li>)}
            </ul>
          )}
          <nav className="rs2-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </div>
      </header>

      <main className="rs2-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`rs2-${id}`} className="rs2-section">
              <h2 className="rs2-heading"><span aria-hidden="true">{number}</span>{title}</h2>
              <div className="rs2-section-body">{body}</div>
            </section>
          )}
        />
      </main>

      <footer className="rs2-foot">
        <p>Printed on a riso</p>
        <nav className="rs2-links">{links}</nav>
      </footer>
    </div>
  );
}
