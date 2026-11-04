import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./swiss.css";

// International Typographic Style: a strict grid, one red, huge lowercase type
export default function SwissPortfolio({ data }) {
  const hero = heroOf(data);
  const year = new Date().getFullYear();

  return (
    <div className="pf pf-swiss">
      <header className="sw-top">
        <span>{hero.name}</span>
        <span>{hero.role}</span>
        <span>Portfolio — {year}</span>
      </header>

      <section className="sw-hero">
        <h1 className="sw-name">
          {hero.first.toLowerCase()}
          {hero.last && <><br />{hero.last.toLowerCase()}<span className="sw-dot">.</span></>}
        </h1>
        <div className="sw-hero-grid">
          <span className="sw-label">Profile</span>
          {hero.lede ? <p className="pf-hero-summary sw-lede">{hero.lede}</p> : <Empty section="about" compact />}
          <div className="sw-hero-stats">
            {hero.stats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main>
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`sw-${id}`} className="sw-section">
              <div className="sw-side">
                <span className="sw-number">{number}</span>
                <h2 className="sw-heading">{title}</h2>
              </div>
              <div className="sw-main">{body}</div>
            </section>
          )}
        />

        <section className="sw-section sw-contact">
          <div className="sw-side">
            <span className="sw-number">→</span>
            <h2 className="sw-heading">Contact</h2>
          </div>
          <div className="sw-main">
            <p className="sw-big">Let's talk.</p>
            <div className="sw-links">
              {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} />)
                : <Empty section="profile" compact />}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
