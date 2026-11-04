import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./boarding.css";

// Three-letter "airport code" for a place or school
const code = (text = "") => {
  const words = text.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.map((word) => word[0]).join("") : words[0] || "";
  return (letters + words.join("")).slice(0, 3).toUpperCase() || "---";
};

// A boarding pass hero and ticket-stub sections
export default function BoardingPortfolio({ data }) {
  const hero = heroOf(data);
  const from = data.educations[0]?.institution || hero.location || "Anywhere";
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="bd-link" />);

  return (
    <div className="pf pf-boarding">
      <header className="bd-pass">
        <div className="bd-main">
          <div className="bd-carrier"><i className="bi bi-airplane-fill" aria-hidden="true" /> Career Air · Boarding pass</div>
          <p className="bd-label">Passenger</p>
          <h1 className="bd-name">{hero.name}</h1>
          <div className="bd-route">
            <div><strong>{code(from)}</strong><span>{from}</span></div>
            <i className="bi bi-airplane" aria-hidden="true" />
            <div><strong>{code(hero.role)}</strong><span>{hero.role}</span></div>
          </div>
          {hero.lede && <p className="pf-hero-summary bd-lede">{hero.lede}</p>}
          <dl className="bd-fields">
            <div><dt>Flight</dt><dd>{hero.initials}-{data.experiences.length || 1}0{data.projects.length}</dd></div>
            {hero.stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
            <div><dt>Gate</dt><dd>Open</dd></div>
          </dl>
        </div>
        <div className="bd-stub">
          <p className="bd-label">Passenger</p>
          <p className="bd-stub-name">{hero.first}</p>
          <nav className="bd-links">{links.length ? links : <Empty section="profile" compact />}</nav>
          <div className="bd-barcode" aria-hidden="true" />
        </div>
      </header>

      <main className="bd-body">
        <Sections
          data={data}
          render={({ id, title, number, body }) => (
            <section id={`bd-${id}`} className="bd-section">
              <div className="bd-tab" aria-hidden="true"><span>Sec {number}</span></div>
              <div className="bd-section-body">
                <h2 className="bd-heading">{title}</h2>
                {body}
              </div>
            </section>
          )}
        />
      </main>

      <footer className="bd-foot">
        <p>Thank you for flying with {hero.first || "me"}.</p>
        <nav className="bd-links">{links}</nav>
      </footer>
    </div>
  );
}
