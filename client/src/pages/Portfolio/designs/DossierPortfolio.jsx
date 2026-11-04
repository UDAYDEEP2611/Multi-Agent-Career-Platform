import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./dossier.css";

// A manila case file: typewritten fields, a red stamp and lettered exhibits
export default function DossierPortfolio({ data }) {
  const hero = heroOf(data);
  const open = data.openTo?.targetRoles?.length > 0;
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} />);
  const fields = [
    ["Occupation", hero.role],
    hero.location && ["Last seen", hero.location],
    hero.skills.length > 0 && ["Known skills", hero.skills.slice(0, 5).join(", ")],
    ["Status", open ? "Open to new roles" : "Active"]
  ].filter(Boolean);

  return (
    <div className="pf pf-dossier">
      <div className="ds-folder">
        <div className="ds-tab">File no. {hero.initials}-{String(data.experiences.length + data.projects.length).padStart(3, "0")}</div>
        <div className="ds-clip" aria-hidden="true" />

        <header className="ds-cover">
          <p className="ds-stamp" aria-hidden="true">Confidential</p>
          <p className="ds-kicker">Personnel file</p>
          <h1 className="ds-name">{hero.name}</h1>
          {hero.lede && <p className="pf-hero-summary ds-lede"><span>Brief:</span> {hero.lede}</p>}
          <dl className="ds-fields">
            {fields.map(([label, value]) => (
              <div key={label}><dt>{label}:</dt><dd>{value}</dd></div>
            ))}
            {hero.stats.map((stat) => (
              <div key={stat.label}><dt>{stat.label}:</dt><dd>{stat.value}</dd></div>
            ))}
          </dl>
          <nav className="ds-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </header>

        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`ds-${id}`} className="ds-section">
              <h2 className="ds-heading"><span>Exhibit {String.fromCharCode(65 + index)}</span>{title}</h2>
              {body}
            </section>
          )}
        />

        <footer className="ds-foot">
          <p>Report ends. Contact the subject directly:</p>
          <nav className="ds-links">{links}</nav>
        </footer>
      </div>
    </div>
  );
}
