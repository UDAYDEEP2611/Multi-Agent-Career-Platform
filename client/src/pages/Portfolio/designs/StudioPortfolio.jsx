import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./studio.css";

// A creative studio showreel: a giant scrolling name, huge headings, bold rows
export default function StudioPortfolio({ data }) {
  const hero = heroOf(data);
  const reel = Array.from({ length: 4 }, () => hero.name);

  return (
    <div className="pf pf-studio">
      <nav className="st-nav">
        <span className="st-logo">{hero.initials}®</span>
        <span className="st-role">{hero.role}</span>
        <a href="#st-contact" className="st-cta">Get in touch ↗</a>
      </nav>

      <div className="st-reel" aria-hidden="true">
        <div>{reel.map((name, index) => <span key={index}>{name} <i>✺</i></span>)}</div>
      </div>
      <h1 className="visually-hidden">{hero.name}</h1>

      <header className="st-hero">
        <div className="st-blob" aria-hidden="true"><span>{hero.initials}</span></div>
        <div>
          {hero.lede ? <p className="pf-hero-summary st-lede">{hero.lede}</p> : <Empty section="about" compact />}
          <div className="st-stats">
            {hero.stats.map((stat) => (
              <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
            ))}
          </div>
        </div>
      </header>

      <main className="st-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`st-${id}`} className="st-section">
              <header className="st-heading">
                <span>({number})</span>
                <h2>{title}</h2>
                <i aria-hidden="true">↘</i>
              </header>
              {body}
            </section>
          )}
        />
      </main>

      <footer id="st-contact" className="st-contact">
        <p>Have a project in mind?</p>
        <h2>Let's create.</h2>
        <div className="st-links">
          {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="st-link" />)
            : <Empty section="profile" compact />}
        </div>
      </footer>
    </div>
  );
}
