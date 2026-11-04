import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./timeline.css";

const ICONS = {
  about: "bi-person", experience: "bi-briefcase", education: "bi-mortarboard", skills: "bi-lightning-charge",
  projects: "bi-rocket-takeoff", certifications: "bi-patch-check", achievements: "bi-trophy",
  recommendations: "bi-chat-heart", volunteering: "bi-heart", publications: "bi-journal-text",
  patents: "bi-lightbulb", interests: "bi-stars"
};

// The first year anyone could see in the portfolio, for the "since" badge
function firstYear(data) {
  const years = [...data.experiences, ...data.educations]
    .map((item) => item.start?.year)
    .filter(Boolean);
  return years.length ? Math.min(...years) : null;
}

// The whole portfolio as one vertical journey: the line runs down the left,
// every section a full-width card beside it
export default function TimelinePortfolio({ data }) {
  const hero = heroOf(data);
  const since = firstYear(data);

  return (
    <div className="pf pf-timeline">
      <header className="tl-hero">
        <div className="tl-ring"><span>{hero.initials}</span></div>
        <h1 className="tl-name">{hero.name}</h1>
        <p className="tl-role">{hero.role}</p>
        {since && <p className="tl-since">On the journey since {since}</p>}
        {hero.lede ? <p className="pf-hero-summary tl-lede">{hero.lede}</p> : <Empty section="about" compact />}
      </header>

      <main className="tl-track">
        <Sections
          data={data}
          render={({ id, title, body }) => (
            <section id={`tl-${id}`} className="tl-node">
              <span className="tl-dot"><i className={`bi ${ICONS[id]}`} aria-hidden="true" /></span>
              <div className="tl-card">
                <h2 className="tl-heading">{title}</h2>
                {body}
              </div>
            </section>
          )}
        />

        <section className="tl-node tl-end">
          <span className="tl-dot"><i className="bi bi-flag" aria-hidden="true" /></span>
          <div className="tl-card tl-contact">
            <h2 className="tl-heading">What's next? Let's write it together.</h2>
            <div className="tl-links">
              {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="tl-link" />)
                : <Empty section="profile" compact />}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
