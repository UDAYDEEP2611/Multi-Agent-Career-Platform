import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./blueprint.css";

// An engineering drawing: grid paper, sheet numbers, corner marks and a title block
export default function BlueprintPortfolio({ data }) {
  const hero = heroOf(data);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="pf pf-blueprint">
      <div className="bp-frame">
        <header className="bp-hero">
          <p className="bp-tag">DWG NO. {hero.initials}-001 · REV A</p>
          <h1 className="bp-name">{hero.name}</h1>
          <p className="bp-role"><span>ROLE</span>{hero.role}</p>
          {hero.lede ? <p className="pf-hero-summary bp-lede">{hero.lede}</p> : <Empty section="about" compact />}

          <div className="bp-dimension" aria-hidden="true"><span>{hero.stats[0]?.value || "∞"}</span></div>

          <table className="bp-titleblock">
            <tbody>
              <tr><th>Drawn by</th><td>{hero.name}</td></tr>
              <tr><th>Title</th><td>{hero.role}</td></tr>
              {hero.stats.map((stat) => <tr key={stat.label}><th>{stat.label}</th><td>{stat.value}</td></tr>)}
              <tr><th>Date</th><td>{today}</td></tr>
              <tr><th>Scale</th><td>1 : 1</td></tr>
            </tbody>
          </table>
        </header>

        <main>
          <Sections
            data={data}
            render={({ id, title, number, body }) => (
              <section id={`bp-${id}`} className="bp-section">
                <h2 className="bp-heading"><span>SHEET {number}</span>{title}</h2>
                <div className="bp-sheet">
                  <i className="bp-corner tl" /><i className="bp-corner tr" /><i className="bp-corner bl" /><i className="bp-corner br" />
                  {body}
                </div>
              </section>
            )}
          />

          <section className="bp-section bp-contact">
            <h2 className="bp-heading"><span>SPEC</span>Contact interfaces</h2>
            <div className="bp-links">
              {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="bp-link" />)
                : <Empty section="profile" compact />}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
