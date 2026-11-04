import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { titleOf, heroOf, sectionPlan } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./vinyl.css";

// A record sleeve with the disc sliding out; sections are the tracklist
export default function VinylPortfolio({ data }) {
  const hero = heroOf(data);
  const tracks = sectionPlan(data);
  const half = Math.ceil(tracks.length / 2);
  const track = (index) => `${index < half ? "A" : "B"}${index < half ? index + 1 : index - half + 1}`;
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="vn-link" />);

  return (
    <div className="pf pf-vinyl">
      <header className="vn-hero">
        <div className="vn-record">
          <div className="vn-disc" aria-hidden="true"><span>{hero.initials}</span></div>
          <div className="vn-sleeve">
            <p className="vn-label-top">Side A · 33⅓ RPM</p>
            <h1 className="vn-name">{hero.name}</h1>
          </div>
        </div>

        <div className="vn-notes">
          <p className="vn-now"><i className="bi bi-play-fill" aria-hidden="true" /> Now playing</p>
          <p className="vn-role">{hero.role}</p>
          {hero.lede && <p className="pf-hero-summary vn-lede">{hero.lede}</p>}
          <ol className="vn-tracklist">
            {tracks.map((id, index) => (
              <li key={id}><a href={`#vn-${id}`}><span>{track(index)}</span>{titleOf(data, id)}</a></li>
            ))}
          </ol>
          <nav className="vn-links">{links.length ? links : <Empty section="profile" compact />}</nav>
        </div>
      </header>

      {hero.stats.length > 0 && (
        <div className="vn-stats">
          {hero.stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
        </div>
      )}

      <main className="vn-body">
        <Sections
          data={data}
          render={({ id, title, index, body }) => (
            <section id={`vn-${id}`} className="vn-section">
              <h2 className="vn-heading">
                <span className="vn-track">{track(index)}</span>
                <span className="vn-title">{title}</span>
                <span className="vn-side">Side {index < half ? "A" : "B"}</span>
              </h2>
              {body}
            </section>
          )}
        />
      </main>

      <footer className="vn-foot">
        <p>Thanks for listening.</p>
        <nav className="vn-links">{links}</nav>
      </footer>
    </div>
  );
}
