import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./bento.css";

// An Apple-style bento grid: every part of the portfolio is a rounded tile
export default function BentoPortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-bento">
      <div className="ben-wrap">
        <header className="ben-grid ben-hero">
          <div className="ben-tile ben-intro">
            <span className="ben-eyebrow">Portfolio</span>
            <h1>{hero.name}</h1>
            <p className="ben-role">{hero.role}</p>
          </div>

          <div className="ben-tile ben-face" aria-hidden="true"><span>{hero.initials}</span></div>

          <div className="ben-tile ben-lede">
            <i className="bi bi-quote" aria-hidden="true" />
            {hero.lede ? <p className="pf-hero-summary">{hero.lede}</p> : <Empty section="about" compact />}
          </div>

          {hero.stats.map((stat) => (
            <div key={stat.label} className="ben-tile ben-stat">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}

          {/* The stats block is four cells; fill what the stats leave empty */}
          {Array.from({ length: Math.max(0, 4 - hero.stats.length) }, (_, index) => (
            index === 0 && hero.skills.length ? (
              <div key="skills" className="ben-tile ben-stat ben-top">
                <i className="bi bi-lightning-charge-fill" aria-hidden="true" />
                <span>{hero.skills.slice(0, 3).join(" · ")}</span>
              </div>
            ) : <div key={index} className="ben-tile ben-pattern" aria-hidden="true" />
          ))}

          {hero.current && (
            <div className="ben-tile ben-now">
              <span className="ben-pulse" />
              <div><small>Currently</small>{hero.current}</div>
            </div>
          )}

          <div className="ben-tile ben-links">
            {hero.links.length ? hero.links.slice(0, 4).map((link) => (
              <ContactLink key={link.href} link={link} className="ben-link" />
            )) : <Empty section="profile" compact />}
          </div>
        </header>

        <main className="ben-grid ben-body">
          <Sections
            data={data}
            render={({ id, title, body }) => (
              <section id={`ben-${id}`} className="ben-tile ben-section">
                <h2 className="ben-heading">{title}</h2>
                <div className="ben-section-body">{body}</div>
              </section>
            )}
          />

          <section className="ben-tile ben-wide ben-contact">
            <h2>Let's work together</h2>
            <div className="ben-contact-links">
              {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="ben-link" />)
                : <Empty section="profile" compact />}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
