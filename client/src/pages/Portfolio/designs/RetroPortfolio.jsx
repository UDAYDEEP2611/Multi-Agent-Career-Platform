import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { titleOf, heroOf, sectionPlan } from "../portfolioKit";
import "./base.css";
import "./retro.css";

const ICONS = {
  about: "bi-file-earmark-person", experience: "bi-briefcase", education: "bi-mortarboard", skills: "bi-cpu",
  projects: "bi-folder2-open", certifications: "bi-award", achievements: "bi-trophy",
  recommendations: "bi-envelope-paper-heart", volunteering: "bi-heart", publications: "bi-journal-text",
  patents: "bi-lightbulb", interests: "bi-joystick"
};

const fileName = (id) => `${id}.${id === "projects" ? "exe" : "txt"}`;

// A 90s desktop: icons down the side, every section in its own window
function Window({ id, title, children }) {
  return (
    <section id={id} className="ro-window">
      <div className="ro-titlebar">
        <span><i className="bi bi-window" aria-hidden="true" /> {title}</span>
        <span className="ro-controls" aria-hidden="true"><b>_</b><b>□</b><b>×</b></span>
      </div>
      <div className="ro-menubar" aria-hidden="true"><u>F</u>ile <u>E</u>dit <u>V</u>iew <u>H</u>elp</div>
      <div className="ro-content">{children}</div>
    </section>
  );
}

export default function RetroPortfolio({ data }) {
  const hero = heroOf(data);

  return (
    <div className="pf pf-retro">
      <div className="ro-desktop">
        <nav className="ro-icons" aria-label="Sections">
          {sectionPlan(data).map((id) => (
            <a key={id} href={`#ro-${id}`} className="ro-icon">
              <i className={`bi ${ICONS[id]}`} aria-hidden="true" />
              <span>{titleOf(data, id)}</span>
            </a>
          ))}
          <a href="#ro-contact" className="ro-icon">
            <i className="bi bi-telephone" aria-hidden="true" />
            <span>Contact</span>
          </a>
        </nav>

        <main className="ro-windows">
          <Window id="ro-welcome" title="Welcome.exe">
            <div className="ro-welcome">
              <div className="ro-avatar">{hero.initials}</div>
              <div>
                <h1 className="ro-name">{hero.name}</h1>
                <p className="ro-role">{hero.role}</p>
                {hero.lede && <p className="pf-hero-summary ro-lede">{hero.lede}</p>}
                {hero.stats.length > 0 && (
                  <div className="ro-stats">
                    {hero.stats.map((stat) => <span key={stat.label} className="ro-inset"><b>{stat.value}</b> {stat.label}</span>)}
                  </div>
                )}
              </div>
            </div>
            <div className="ro-progress" aria-hidden="true"><span /></div>
          </Window>

          <Sections
            data={data}
            render={({ id, body }) => (
              <Window id={`ro-${id}`} title={`${fileName(id)} - Notepad`}>
                {body}
              </Window>
            )}
          />

          <Window id="ro-contact" title="Dial-Up Connection">
            <p className="ro-dial">Connect to {hero.first}?</p>
            <div className="ro-buttons">
              {hero.links.length ? hero.links.map((link) => <ContactLink key={link.href} link={link} className="ro-button" />)
                : <Empty section="profile" compact />}
            </div>
          </Window>
        </main>
      </div>

      <footer className="ro-taskbar">
        <span className="ro-start"><i className="bi bi-windows" aria-hidden="true" /> Start</span>
        <span className="ro-task ro-inset">{hero.name}</span>
        <span className="ro-clock ro-inset">{new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
