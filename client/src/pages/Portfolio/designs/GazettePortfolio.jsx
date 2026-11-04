import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./gazette.css";

// A broadsheet front page: masthead, dateline, a headline and lettered sections
export default function GazettePortfolio({ data }) {
  const hero = heroOf(data);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} />);

  return (
    <div className="pf pf-gazette">
      <div className="gz-paper">
        <header className="gz-masthead">
          <div className="gz-ears">
            <span>{hero.location || "Late edition"}</span>
            <span>All the news about {hero.first || "me"}</span>
          </div>
          <p className="gz-masthead-name">The {hero.first || "Daily"} Gazette</p>
          <div className="gz-dateline">
            <span>{today}</span>
            <span>{hero.stats.map((stat) => `${stat.value} ${stat.label}`).join(" · ")}</span>
            <span>Free of charge</span>
          </div>
        </header>

        <section className="gz-front">
          <p className="gz-kicker">Now hiring news</p>
          <h1 className="gz-name">{hero.name}</h1>
          <p className="gz-deck">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary gz-lede">{hero.lede}</p>}
          <nav className="gz-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </section>

        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`gz-${id}`} className={`gz-section gz-${id}`}>
              <header className="gz-heading">
                <span>Section {String.fromCharCode(65 + index)}</span>
                <h2>{title}</h2>
                <span>Page {index + 2}</span>
              </header>
              <div className="gz-section-body">{body}</div>
            </section>
          )}
        />

        <footer className="gz-foot">
          <h2>Letters to the editor</h2>
          <nav className="gz-links">{links}</nav>
        </footer>
      </div>
    </div>
  );
}
