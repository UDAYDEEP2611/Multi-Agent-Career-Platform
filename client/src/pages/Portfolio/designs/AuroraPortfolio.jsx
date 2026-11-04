import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./aurora.css";

// Soft aurora light behind a centered hero and frosted cards
export default function AuroraPortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-aurora">
      <div className="aur-sky" aria-hidden="true"><span /><span /><span /></div>

      <nav className="aur-nav">
        <span className="aur-logo">{hero.initials}</span>
        <div className="aur-nav-links">
          <a href="#aur-about">About</a>
          <a href="#aur-experience">Experience</a>
          <a href="#aur-skills">Skills</a>
          <a href="#aur-contact" className="aur-nav-cta">Contact</a>
        </div>
      </nav>

      <header className="aur-hero">
        <div className="aur-avatar">{hero.initials}</div>
        <p className="aur-hello">Hello, I'm {hero.first}</p>
        <h1 className="aur-role">{hero.role}</h1>
        {hero.lede ? <p className="pf-hero-summary aur-lede">{hero.lede}</p> : <Empty section="about" compact />}
        {hero.stats.length > 0 && (
          <div className="aur-stats">
            {hero.stats.map((stat) => (
              <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
            ))}
          </div>
        )}
      </header>

      <main className="aur-body">
        <Sections
          data={data}
          render={({ id, title, body }) => (
            <section id={`aur-${id}`} className="aur-section">
              <h2 className="aur-heading">{title}</h2>
              <div className="aur-glass">{body}</div>
            </section>
          )}
        />

        <section id="aur-contact" className="aur-contact">
          <h2>Let's make something lovely</h2>
          <div className="aur-links">
            {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="aur-pill" />)
              : <Empty section="profile" compact />}
          </div>
        </section>
      </main>
    </div>
  );
}
