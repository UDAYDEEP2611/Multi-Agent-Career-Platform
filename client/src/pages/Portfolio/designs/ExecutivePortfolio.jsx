import { ContactLink, Empty } from "../PortfolioParts";
import { SectionBody, Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./executive.css";

// Navy and gold, formal serif type: for senior and corporate profiles
export default function ExecutivePortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-executive">
      <header className="ex-banner">
        <nav className="ex-nav">
          <span className="ex-mono">{hero.initials}</span>
          <div className="ex-nav-links">
            <a href="#ex-about">Profile</a>
            <a href="#ex-experience">Career</a>
            <a href="#ex-education">Education</a>
            <a href="#ex-contact">Contact</a>
          </div>
        </nav>
        <div className="ex-hero">
          <p className="ex-role">{hero.role}</p>
          <h1 className="ex-name">{hero.name}</h1>
          <span className="ex-rule" aria-hidden="true" />
          {hero.lede && <p className="pf-hero-summary ex-lede">{hero.lede}</p>}
          {hero.current && <p className="ex-current">{hero.current}</p>}
        </div>
      </header>

      <div id="ex-about" className="ex-summary">
        <h2 className="ex-summary-title">Executive Profile</h2>
        <SectionBody id="about" data={data} />
        {hero.stats.length > 0 && (
          <div className="ex-stats">
            {hero.stats.map((stat) => (
              <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
            ))}
          </div>
        )}
      </div>

      <main className="ex-body">
        <Sections
          data={data}
          skip={["about"]}
          titles={{ experience: "Professional Experience" }}
          render={({ id, title, body }) => (
            <section id={`ex-${id}`} className="ex-section">
              <h2 className="ex-heading"><span>{title}</span></h2>
              {body}
            </section>
          )}
        />
      </main>

      <footer id="ex-contact" className="ex-contact">
        <h2>Correspondence</h2>
        <div className="ex-links">
          {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="ex-link" />)
            : <Empty section="profile" compact />}
        </div>
      </footer>
    </div>
  );
}
