import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./launch.css";

// A product landing page: sticky nav, a big pitch, a "worked at" strip and feature sections
export default function LaunchPortfolio({ data }) {
  const hero = heroOf(data);
  const email = hero.links.find((link) => link.href.startsWith("mailto:")) || hero.links[0];
  const companies = [...new Set(data.experiences.map((job) => job.organization).filter(Boolean))].slice(0, 6);
  const open = Boolean(data.openTo?.roleTargeting);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="ln-link" />);

  return (
    <div className="pf pf-launch">
      <nav className="ln-nav">
        <span className="ln-logo">{hero.initials}</span>
        <div className="ln-nav-links">
          <a href="#ln-about">About</a>
          <a href="#ln-experience">Experience</a>
          <a href="#ln-skills">Skills</a>
        </div>
        {email && <a href={email.href} className="ln-cta">Get in touch</a>}
      </nav>

      <header className="ln-hero">
        <p className="ln-pill"><span aria-hidden="true" />{open ? "Open to new roles" : "Portfolio"}</p>
        <h1 className="ln-name">{hero.name}</h1>
        <p className="ln-role">{hero.role}</p>
        {hero.lede && <p className="pf-hero-summary ln-lede">{hero.lede}</p>}
        <div className="ln-actions">
          {email && <a href={email.href} className="ln-btn ln-btn-main">Work with me <i className="bi bi-arrow-right" aria-hidden="true" /></a>}
          <a href="#ln-experience" className="ln-btn">See my work</a>
        </div>
        {hero.stats.length > 0 && (
          <div className="ln-stats">
            {hero.stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
          </div>
        )}
      </header>

      {companies.length > 0 && (
        <div className="ln-logos">
          <p>Experience at</p>
          <ul>{companies.map((name) => <li key={name}>{name}</li>)}</ul>
        </div>
      )}

      <main className="ln-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`ln-${id}`} className="ln-section">
              <header className="ln-heading">
                <span>{number}</span>
                <h2>{title}</h2>
              </header>
              <div className="ln-panel">{body}</div>
            </section>
          )}
        />
      </main>

      <footer className="ln-foot">
        <h2>Ready when you are.</h2>
        <nav className="ln-links">{links.length ? links : <Empty section="profile" compact />}</nav>
      </footer>
    </div>
  );
}
