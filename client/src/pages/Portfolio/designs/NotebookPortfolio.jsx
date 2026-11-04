import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { heroOf } from "../portfolioKit";
import "./base.css";
import "./notebook.css";

const NOTES = ["yellow", "pink", "blue"];

// A notebook page: ruled lines, handwriting, sticky notes and tape.
// In dark mode it turns into a chalkboard.
export default function NotebookPortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-notebook">
      <div className="nb-page">
        <header className="nb-hero">
          <p className="nb-date">{new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="nb-name">{hero.name}</h1>
          <p className="nb-role"><span>{hero.role}</span></p>
          {hero.lede ? <p className="pf-hero-summary nb-lede">{hero.lede}</p> : <Empty section="about" compact />}

          <div className="nb-notes">
            {hero.stats.map((stat, index) => (
              <div key={stat.label} className={`nb-note nb-${NOTES[index % NOTES.length]}`}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
          <div className="nb-doodle" aria-hidden="true">{hero.initials}</div>
        </header>

        <main>
          <Sections
            data={data}
            render={({ id, title, index, body }) => (
              <section id={`nb-${id}`} className="nb-section">
                <h2 className="nb-heading">{title}</h2>
                <div className={`nb-card ${index % 2 ? "nb-tilt-r" : "nb-tilt-l"}`}>
                  <span className="nb-tape" aria-hidden="true" />
                  {body}
                </div>
              </section>
            )}
          />

          <section className="nb-section nb-contact">
            <h2 className="nb-heading">Let's chat!</h2>
            <div className="nb-links">
              {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="nb-link" />)
                : <Empty section="profile" compact />}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
