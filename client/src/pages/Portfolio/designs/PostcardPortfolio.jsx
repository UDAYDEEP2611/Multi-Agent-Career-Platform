import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./postcard.css";

// A postcard: a handwritten note on the left, stamp and address on the right, every section its own card
export default function PostcardPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="pc-link" />);

  return (
    <div className="pf pf-postcard">
      <div className="pc-page">
        <header className="pc-card pc-hero">
          <div className="pc-note">
            <p className="pc-greeting" aria-hidden="true">Hello from {hero.first || "me"},</p>
            {hero.lede && <p className="pf-hero-summary pc-lede">{hero.lede}</p>}
            {hero.stats.length > 0 && (
              <p className="pc-facts">{hero.stats.map((stat) => `${stat.value} ${stat.label}`).join(" · ")}</p>
            )}
          </div>
          <div className="pc-address">
            <div className="pc-stamp" aria-hidden="true"><span>{hero.initials}</span></div>
            <div className="pc-postmark" aria-hidden="true"><span>First class mail</span></div>
            <h1 className="pc-name">{hero.name}</h1>
            <p className="pc-role">{hero.role}</p>
            {hero.location && <p className="pc-place">{hero.location}</p>}
            <nav className="pc-links">{links.length ? links : <Empty section="profile" compact />}</nav>
          </div>
        </header>

        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`pc-${id}`} className="pc-card pc-section">
              <div className="pc-section-stamp" aria-hidden="true">{number}</div>
              <h2 className="pc-heading">{title}</h2>
              {body}
            </section>
          )}
        />

        <footer className="pc-foot">
          <p>Wish you were here.</p>
          <nav className="pc-links">{links}</nav>
        </footer>
      </div>
    </div>
  );
}
