import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./kanban.css";

const LABELS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#4d7c0f"];

// A project board: your profile as the board's header, each section a column of cards
export default function KanbanPortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="kb-link" />);

  return (
    <div className="pf pf-kanban">
      <header className="kb-top">
        <div className="kb-avatar" aria-hidden="true">{hero.initials}</div>
        <div className="kb-who">
          <h1 className="kb-name">{hero.name}</h1>
          <p className="kb-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary kb-lede">{hero.lede}</p>}
          <nav className="kb-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </div>
        {hero.stats.length > 0 && (
          <ul className="kb-stats">
            {hero.stats.map((stat) => <li key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></li>)}
          </ul>
        )}
      </header>

      <main className="kb-board">
        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`kb-${id}`} className="kb-column" style={{ "--kb-c": LABELS[index % LABELS.length] }}>
              <h2 className="kb-heading"><i aria-hidden="true" />{title}</h2>
              <div className="kb-cards">{body}</div>
            </section>
          )}
        />
      </main>
    </div>
  );
}
