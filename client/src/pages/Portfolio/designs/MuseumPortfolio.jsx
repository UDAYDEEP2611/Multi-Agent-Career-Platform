import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./museum.css";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV"];

// A gallery: a framed portrait with its wall label, then one room per section
export default function MuseumPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} />);

  return (
    <div className="pf pf-museum">
      <header className="mu-hero">
        <div className="mu-frame" aria-hidden="true">
          <div className="mu-mat"><span>{hero.initials}</span></div>
        </div>
        <div className="mu-label">
          <h1 className="mu-name">{hero.name}</h1>
          <p className="mu-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary mu-lede">{hero.lede}</p>}
          {hero.skills.length > 0 && <p className="mu-medium">Medium: {hero.skills.slice(0, 4).join(", ")}</p>}
          {hero.stats.length > 0 && (
            <p className="mu-facts">{hero.stats.map((stat) => `${stat.value} ${stat.label.toLowerCase()}`).join(" · ")}</p>
          )}
          <nav className="mu-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </div>
      </header>

      <main className="mu-body">
        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`mu-${id}`} className="mu-section">
              <h2 className="mu-heading"><span>Room {ROMAN[index] || index + 1}</span>{title}</h2>
              <div className="mu-section-body">{body}</div>
            </section>
          )}
        />
      </main>

      <footer className="mu-foot">
        <p>Gift shop &amp; enquiries</p>
        <nav className="mu-links">{links}</nav>
      </footer>
    </div>
  );
}
