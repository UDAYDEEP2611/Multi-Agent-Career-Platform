import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./split.css";

// Half the screen is a bold, sticky color panel with the name; the other half scrolls
export default function SplitPortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-split">
      <aside className="sp-panel">
        <span className="sp-badge">{hero.initials}</span>
        <div>
          <p className="sp-hi">Hi there, I'm</p>
          <h1 className="sp-name">
            <span>{hero.first}</span>
            {hero.last && <span>{hero.last}</span>}
          </h1>
          <p className="sp-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary sp-lede">{hero.lede}</p>}
        </div>
        <div className="sp-links">
          {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="sp-link" iconOnly />)
            : <Empty section="profile" compact />}
        </div>
      </aside>

      <main className="sp-content">
        {hero.stats.length > 0 && (
          <div className="sp-stats">
            {hero.stats.map((stat) => (
              <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
            ))}
          </div>
        )}

        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`sp-${id}`} className="sp-section">
              <h2 className="sp-heading"><span>{number}</span>{title}</h2>
              {body}
            </section>
          )}
        />

        <section className="sp-section sp-contact">
          <h2 className="sp-heading"><span>✦</span>Say hello</h2>
          <div className="sp-contact-links">
            {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="sp-pill" />)
              : <Empty section="profile" compact />}
          </div>
        </section>
      </main>
    </div>
  );
}
