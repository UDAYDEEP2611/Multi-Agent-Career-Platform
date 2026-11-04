import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./resume.css";

// A printed résumé sheet lying on a desk: one column of full-width rows,
// each with its heading on the left
export default function ResumePortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-resume">
      <article className="rs-sheet">
        <header className="rs-head">
          <div>
            <h1 className="rs-name">{hero.name}</h1>
            <p className="rs-role">{hero.role}</p>
            {hero.lede && <p className="pf-hero-summary rs-lede">{hero.lede}</p>}
          </div>
          <div className="rs-monogram" aria-hidden="true">{hero.initials}</div>
        </header>

        <div className="rs-contact">
          {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} />)
            : <Empty section="profile" compact />}
        </div>

        {hero.stats.length > 0 && (
          <div className="rs-facts">
            {hero.stats.map((stat) => (
              <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
            ))}
          </div>
        )}

        <div className="rs-body">
          <Sections
            data={data}
            titles={{ about: "Profile" }}
            render={({ id, title, body }) => (
              <section id={`rs-${id}`} className="rs-section">
                <h2 className="rs-heading">{title}</h2>
                <div className="rs-section-body">{body}</div>
              </section>
            )}
          />
        </div>

        <footer className="rs-foot">References and full details available on request.</footer>
      </article>
    </div>
  );
}
