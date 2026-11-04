import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./botanical.css";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV"];

// A drawn sprig of leaves
function Sprig({ className }) {
  return (
    <svg className={className} viewBox="0 0 120 40" aria-hidden="true">
      <path d="M4 20 H116" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {[22, 44, 66, 88].map((x) => (
        <g key={x} fill="currentColor">
          <path d={`M${x} 20 q8 -14 20 -12 q-8 12 -20 12z`} />
          <path d={`M${x} 20 q8 14 20 12 q-8 -12 -20 -12z`} opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

// A herbarium specimen sheet; each section is a numbered plate
export default function BotanicalPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} />);

  return (
    <div className="pf pf-botanical">
      <header className="bo-hero">
        <div className="bo-specimen">
          <Sprig className="bo-sprig" />
          <p className="bo-kicker">Herbarium · Specimen {hero.initials}</p>
          <h1 className="bo-name">{hero.name}</h1>
          <p className="bo-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary bo-lede">{hero.lede}</p>}
          {hero.stats.length > 0 && (
            <p className="bo-facts">{hero.stats.map((stat) => `${stat.value} ${stat.label.toLowerCase()}`).join(" · ")}</p>
          )}
          <nav className="bo-links">{links.length ? links : <Empty section="profile" compact />}</nav>
          <Sprig className="bo-sprig bo-sprig-flip" />
        </div>
      </header>

      <main className="bo-body">
        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`bo-${id}`} className="bo-section">
              <h2 className="bo-heading"><span>Plate {ROMAN[index] || index + 1}</span>{title}</h2>
              {body}
            </section>
          )}
        />
      </main>

      <footer className="bo-foot">
        <Sprig className="bo-sprig" />
        <p>Collected with care{hero.location ? ` in ${hero.location}` : ""}.</p>
        <nav className="bo-links">{links}</nav>
      </footer>
    </div>
  );
}
