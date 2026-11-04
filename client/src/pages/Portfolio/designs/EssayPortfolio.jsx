import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./essay.css";

// A quiet, single reading column, like a personal essay or blog
export default function EssayPortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-essay">
      <article className="es-column">
        <header className="es-hero">
          <div className="es-mark">{hero.initials}</div>
          <h1 className="es-name">{hero.name}</h1>
          <p className="es-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary es-lede">{hero.lede}</p>}
          {hero.stats.length > 0 && (
            <p className="es-facts">
              {hero.stats.map((stat) => `${stat.value} ${stat.label.toLowerCase()}`).join("  ·  ")}
            </p>
          )}
          <nav className="es-links">
            {hero.links.map((link) => <ContactLink key={link.href} link={link} />)}
          </nav>
        </header>

        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`es-${id}`} className={`es-section es-${id}`}>
              <h2 className="es-heading"><span>§ {Number(number)}</span>{title}</h2>
              {body}
            </section>
          )}
        />

        <footer className="es-footer">
          <p className="es-ornament" aria-hidden="true">❦</p>
          <p>If any of this resonates, I would love to hear from you.</p>
          <div className="es-links">
            {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} />)
              : <Empty section="profile" compact />}
          </div>
        </footer>
      </article>
    </div>
  );
}
