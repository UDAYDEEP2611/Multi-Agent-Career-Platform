import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./slate.css";

// A clean professional profile: cover banner, overlapping avatar and section cards
export default function SlatePortfolio({ data }) {
  const hero = heroOf(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="sl-link" />);

  return (
    <div className="pf pf-slate">
      <div className="sl-page">
        <header className="sl-profile">
          <div className="sl-cover" aria-hidden="true" />
          <div className="sl-profile-body">
            <div className="sl-avatar" aria-hidden="true">{hero.initials}</div>
            <h1 className="sl-name">{hero.name}</h1>
            <p className="sl-role">{hero.role}</p>
            {hero.lede && <p className="pf-hero-summary sl-lede">{hero.lede}</p>}
            <p className="sl-meta">
              {[hero.current, hero.location].filter(Boolean).join(" · ")}
            </p>
            {hero.stats.length > 0 && (
              <div className="sl-stats">
                {hero.stats.map((stat) => <span key={stat.label}><strong>{stat.value}</strong> {stat.label}</span>)}
              </div>
            )}
            <nav className="sl-links">{links.length ? links : <Empty section="profile" compact />}</nav>
          </div>
        </header>

        <Sections
          data={data}
          render={({ id, title, body }) => (
            <section id={`sl-${id}`} className="sl-card">
              <h2 className="sl-heading">{title}</h2>
              {body}
            </section>
          )}
        />
      </div>
    </div>
  );
}
