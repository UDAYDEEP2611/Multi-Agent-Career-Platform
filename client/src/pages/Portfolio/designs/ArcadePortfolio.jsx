import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./arcade.css";

// An 8-bit game: a score HUD, a pixel title screen and one stage per section.
// Light mode is a handheld's green screen, dark mode an arcade cabinet.
export default function ArcadePortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="arc-link" />);

  return (
    <div className="pf pf-arcade">
      <div className="arc-hud">
        <span>1UP {hero.initials}</span>
        {hero.stats.map((stat) => <span key={stat.label}>{stat.label} {stat.value}</span>)}
      </div>

      <header className="arc-title">
        <p className="arc-lives" aria-hidden="true">♥ ♥ ♥</p>
        <h1 className="arc-name">{hero.name}</h1>
        <p className="arc-role">{hero.role}</p>
        {hero.lede && <p className="pf-hero-summary arc-lede">{hero.lede}</p>}
        <a href="#arc-about" className="arc-start">▶ Press start</a>
        <nav className="arc-links">{links.length ? links : <Empty section="profile" compact />}</nav>
      </header>

      <main className="arc-body">
        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`arc-${id}`} className="arc-section">
              <h2 className="arc-heading">
                <span>Stage {Math.floor(index / 4) + 1}-{(index % 4) + 1}</span>{title}
              </h2>
              {body}
            </section>
          )}
        />
      </main>

      <footer className="arc-foot">
        <p className="arc-over">Continue?</p>
        <nav className="arc-links">{links}</nav>
      </footer>
    </div>
  );
}
