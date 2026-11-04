import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./memphis.css";

// 80s Memphis: confetti shapes, squiggles and full-width colour bands
export default function MemphisPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="mp-link" />);

  return (
    <div className="pf pf-memphis">
      <header className="mp-hero">
        <span className="mp-shape mp-circle" aria-hidden="true" />
        <span className="mp-shape mp-triangle" aria-hidden="true" />
        <span className="mp-shape mp-zigzag" aria-hidden="true" />
        <span className="mp-shape mp-dots" aria-hidden="true" />
        <svg className="mp-shape mp-squiggle" viewBox="0 0 160 40" aria-hidden="true">
          <path d="M4 20 q16 -18 32 0 t32 0 t32 0 t32 0" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        </svg>

        <div className="mp-hero-text">
          <p className="mp-hello">Hello, I'm</p>
          <h1 className="mp-name">{hero.name}</h1>
          <p className="mp-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary mp-lede">{hero.lede}</p>}
          {hero.stats.length > 0 && (
            <div className="mp-stats">
              {hero.stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
            </div>
          )}
          <nav className="mp-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </div>
      </header>

      <main>
        <Sections
          data={data}
          render={({ id, title, body }) => (
            <section id={`mp-${id}`} className="mp-section">
              <div className="mp-inner">
                <h2 className="mp-heading">{title}</h2>
                {body}
              </div>
            </section>
          )}
        />
      </main>

      <footer className="mp-foot">
        <p className="mp-heading">Let's make something rad</p>
        <nav className="mp-links">{links}</nav>
      </footer>
    </div>
  );
}
