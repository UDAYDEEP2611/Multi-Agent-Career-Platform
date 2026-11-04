import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./neon.css";

// Synthwave: a striped sun over a neon grid, glowing type
export default function NeonPortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-neon">
      <header className="neo-hero">
        <nav className="neo-nav">
          <span className="neo-logo">{hero.initials}<span>_</span></span>
          <div className="neo-nav-links">
            <a href="#neo-about">about</a>
            <a href="#neo-experience">experience</a>
            <a href="#neo-skills">skills</a>
            <a href="#neo-contact">contact</a>
          </div>
        </nav>

        <div className="neo-sun" aria-hidden="true" />
        <div className="neo-floor" aria-hidden="true" />

        <div className="neo-hero-text">
          <p className="neo-kicker">// player one</p>
          <h1 className="neo-name" data-text={hero.name}>{hero.name}</h1>
          <p className="neo-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary neo-lede">{hero.lede}</p>}
          {hero.stats.length > 0 && (
            <div className="neo-stats">
              {hero.stats.map((stat) => (
                <span key={stat.label}><strong>{stat.value}</strong> {stat.label}</span>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="neo-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`neo-${id}`} className="neo-section">
              <h2 className="neo-heading"><span>{number}</span>{title}</h2>
              <div className="neo-panel">{body}</div>
            </section>
          )}
        />

        <section id="neo-contact" className="neo-contact">
          <h2>Insert coin to continue</h2>
          <div className="neo-links">
            {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="neo-btn" />)
              : <Empty section="profile" compact />}
          </div>
        </section>
      </main>
    </div>
  );
}
