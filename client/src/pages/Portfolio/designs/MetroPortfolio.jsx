import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { titleOf, heroOf, sectionPlan } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./metro.css";

const LINES = ["#e3242b", "#0075bf", "#00a651", "#f7a800", "#9b26b6", "#00a3a3", "#ef7d00", "#d6247d"];

// A transit map: the route of stations up top, each section its own coloured line
export default function MetroPortfolio({ data }) {
  const hero = heroOf(data);
  const stations = sectionPlan(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="mtr-link" />);

  return (
    <div className="pf pf-metro">
      <header className="mtr-hero">
        <div className="mtr-badge" aria-hidden="true">{hero.initials}</div>
        <h1 className="mtr-name">{hero.name}</h1>
        <p className="mtr-role"><span>Line</span>{hero.role}</p>
        {hero.lede && <p className="pf-hero-summary mtr-lede">{hero.lede}</p>}
        {hero.stats.length > 0 && (
          <p className="mtr-facts">{hero.stats.map((stat) => `${stat.value} ${stat.label}`).join("  ·  ")}</p>
        )}
        <nav className="mtr-links">{links.length ? links : <Empty section="profile" compact />}</nav>
      </header>

      <nav className="mtr-route" aria-label="Sections">
        <ol>
          {stations.map((id, index) => (
            <li key={id} style={{ "--mt-c": LINES[index % LINES.length] }}>
              <a href={`#mt-${id}`}><i aria-hidden="true" />{titleOf(data, id)}</a>
            </li>
          ))}
        </ol>
      </nav>

      <main className="mtr-body">
        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`mt-${id}`} className="mtr-section" style={{ "--mt-c": LINES[index % LINES.length] }}>
              <h2 className="mtr-heading"><span className="mtr-line">{index + 1}</span>{title}</h2>
              <div className="mtr-section-body">{body}</div>
            </section>
          )}
        />
      </main>

      <footer className="mtr-foot">
        <p>Last stop: let's talk.</p>
        <nav className="mtr-links">{links}</nav>
      </footer>
    </div>
  );
}
