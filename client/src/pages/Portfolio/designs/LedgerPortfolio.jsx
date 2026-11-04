import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./ledger.css";

// Green-bar printer paper with tractor-feed holes: a statement of account
export default function LedgerPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} />);
  const rows = [
    ["Position", hero.role],
    hero.location && ["Branch", hero.location],
    ...hero.stats.map((stat) => [stat.label, stat.value])
  ].filter(Boolean);

  return (
    <div className="pf pf-ledger">
      <div className="lg-sheet">
        <header className="lg-head">
          <p className="lg-title">Statement of account · {hero.initials}</p>
          <h1 className="lg-name">{hero.name}</h1>
          {hero.lede && <p className="pf-hero-summary lg-lede"><span>Memo</span>{hero.lede}</p>}
          <dl className="lg-rows">
            {rows.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <nav className="lg-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </header>

        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`lg-${id}`} className="lg-section">
              <h2 className="lg-heading"><span>Acct {number}</span>{title}</h2>
              {body}
            </section>
          )}
        />

        <footer className="lg-foot">
          <p>*** End of statement ***</p>
          <nav className="lg-links">{links}</nav>
        </footer>
      </div>
    </div>
  );
}
