import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./brutal.css";

const COLORS = ["yellow", "pink", "blue", "green"];

// Neo-brutalism: thick outlines, hard offset shadows and sticker colors
export default function BrutalPortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-brutal">
      <nav className="bru-nav">
        <span className="bru-logo">{hero.first}<span>.</span></span>
        <div className="bru-nav-links">
          <a href="#bru-about">About</a>
          <a href="#bru-experience">Work</a>
          <a href="#bru-skills">Skills</a>
        </div>
        <a href="#bru-contact" className="bru-btn">Say hi <i className="bi bi-arrow-right" aria-hidden="true" /></a>
      </nav>

      <header className="bru-hero">
        <div className="bru-hero-text">
          <span className="bru-sticker">{hero.role}</span>
          <h1 className="bru-name">{hero.name}</h1>
          {hero.lede ? <p className="pf-hero-summary bru-lede">{hero.lede}</p> : <Empty section="about" compact />}
        </div>
        <div className="bru-hero-side">
          <div className="bru-face">{hero.initials}</div>
          {hero.stats.map((stat, index) => (
            <div key={stat.label} className={`bru-stat bru-${COLORS[(index + 1) % COLORS.length]}`}>
              <strong>{stat.value}</strong>{stat.label}
            </div>
          ))}
        </div>
      </header>

      {hero.skills.length > 0 && (
        <div className="bru-ticker" aria-hidden="true">
          <div>{[...hero.skills, ...hero.skills].map((skill, index) => <span key={index}>{skill} ✦</span>)}</div>
        </div>
      )}

      <main className="bru-body">
        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`bru-${id}`} className="bru-section">
              <h2 className={`bru-heading bru-${COLORS[index % COLORS.length]}`}>{title}</h2>
              <div className="bru-box">{body}</div>
            </section>
          )}
        />

        <section id="bru-contact" className="bru-contact bru-pink">
          <h2>Got a project? Let's talk!</h2>
          <div className="bru-links">
            {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="bru-btn" />)
              : <Empty section="profile" compact />}
          </div>
        </section>
      </main>
    </div>
  );
}
