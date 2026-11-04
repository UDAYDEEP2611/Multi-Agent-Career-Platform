import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./zen.css";

const NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四"];

// Washi paper, an ink ensō and a red name seal; sections counted in kanji
export default function ZenPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} />);

  return (
    <div className="pf pf-zen">
      <header className="zen-hero">
        <div className="zen-enso" aria-hidden="true" />
        <div className="zen-hero-text">
          <p className="zen-kicker">{hero.location || "Portfolio"}</p>
          <h1 className="zen-name">{hero.name}</h1>
          <p className="zen-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary zen-lede">{hero.lede}</p>}
          <nav className="zen-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </div>
        <div className="zen-seal" aria-hidden="true">{hero.initials}</div>
      </header>

      {hero.stats.length > 0 && (
        <div className="zen-stats">
          {hero.stats.map((stat) => (
            <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
          ))}
        </div>
      )}

      <main className="zen-body">
        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`zen-${id}`} className="zen-section">
              <h2 className="zen-heading">
                <span className="zen-num" aria-hidden="true">{NUMERALS[index] || index + 1}</span>{title}
              </h2>
              <div className="zen-section-body">{body}</div>
            </section>
          )}
        />
      </main>

      <footer className="zen-foot">
        <p>Thank you for reading.</p>
        <nav className="zen-links">{links}</nav>
      </footer>
    </div>
  );
}
