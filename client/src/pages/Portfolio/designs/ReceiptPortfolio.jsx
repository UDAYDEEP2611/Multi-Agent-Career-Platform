import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf, sectionPlan } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./receipt.css";

// A long till receipt: stats as line items, sections as printed blocks, a barcode at the end
export default function ReceiptPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="rc-link" />);

  return (
    <div className="pf pf-receipt">
      <div className="rc-shadow">
        <div className="rc-paper">
          <header className="rc-hero">
            <p className="rc-store" aria-hidden="true">*** Career Receipt ***</p>
            <h1 className="rc-name">{hero.name}</h1>
            <p className="rc-role">{hero.role}</p>
            {hero.location && <p className="rc-place">{hero.location}</p>}
            {hero.lede && <p className="pf-hero-summary rc-lede">{hero.lede}</p>}
            {hero.stats.length > 0 && (
              <dl className="rc-lines">
                {hero.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <nav className="rc-links">{links.length ? links : <Empty section="profile" compact />}</nav>
          </header>

          <main>
            <Sections
              data={data}
              render={({ id, title, number, body }) => (
                <section id={`rc-${id}`} className="rc-section">
                  <h2 className="rc-heading"><span>{number}</span>{title}</h2>
                  {body}
                </section>
              )}
            />
          </main>

          <footer className="rc-foot">
            <p className="rc-total"><span>Sections</span><span>{sectionPlan(data).length}</span></p>
            <p className="rc-thanks">Thank you for reading</p>
            <div className="rc-barcode" aria-hidden="true" />
            <nav className="rc-links">{links}</nav>
          </footer>
        </div>
      </div>
    </div>
  );
}
