import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./noir.css";

// A black-and-white film: letterboxed title card, opening credits and scenes.
// Light mode turns it into a printed screenplay.
export default function NoirPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} />);

  return (
    <div className="pf pf-noir">
      <header className="nr-hero">
        <p className="nr-presents">A {hero.first || "personal"} production</p>
        <h1 className="nr-name">{hero.name}</h1>
        <p className="nr-starring">starring as</p>
        <p className="nr-role">{hero.role}</p>
        {hero.lede && <p className="pf-hero-summary nr-lede">{hero.lede}</p>}
        {hero.stats.length > 0 && (
          <p className="nr-credits">{hero.stats.map((stat) => `${stat.value} ${stat.label}`).join("   ·   ")}</p>
        )}
        <nav className="nr-links">{links.length ? links : <Empty section="profile" compact />}</nav>
      </header>

      <main className="nr-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`nr-${id}`} className="nr-section">
              <p className="nr-slug">Scene {number} — Int. {title.toUpperCase()} — Day</p>
              <h2 className="nr-heading">{title}</h2>
              {body}
            </section>
          )}
        />
      </main>

      <footer className="nr-foot">
        <p className="nr-end">The end?</p>
        <p>To be continued, with you.</p>
        <nav className="nr-links">{links}</nav>
      </footer>
    </div>
  );
}
