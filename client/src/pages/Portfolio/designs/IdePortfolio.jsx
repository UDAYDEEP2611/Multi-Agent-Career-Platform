import { ContactLink, Empty } from "../PortfolioParts";
import { Sections } from "../PortfolioBlocks";
import { titleOf, heroOf, sectionPlan } from "../portfolioKit";
import "./base.css";
import "./fonts2.css";
import "./ide.css";

const EXT = { about: "md", experience: "ts", education: "json", skills: "yml", projects: "tsx" };
const fileOf = (title, id) => `${(title || id).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${EXT[id] || "md"}`;
const LINES = Array.from({ length: 160 }, (_, index) => index + 1).join("\n");

// A code editor: file explorer, README hero and one open file per section
export default function IdePortfolio({ data }) {
  const hero = heroOf(data);
  const files = sectionPlan(data);
  const links = hero.links.map((link) => <ContactLink key={link.href} link={link} className="ide-link" />);

  return (
    <div className="pf pf-ide">
      <div className="ide-window">
        <div className="ide-titlebar">
          <span className="ide-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="ide-title">{hero.name} — portfolio</span>
        </div>

        <div className="ide-layout">
          <aside className="ide-explorer" aria-label="Files">
            <p className="ide-explorer-title">Explorer</p>
            <a href="#ide-readme"><i className="bi bi-info-circle" aria-hidden="true" />README.md</a>
            {files.map((id) => (
              <a key={id} href={`#ide-${id}`}><i className="bi bi-file-earmark-code" aria-hidden="true" />{fileOf(titleOf(data, id), id)}</a>
            ))}
          </aside>

          <main className="ide-editor">
            <article id="ide-readme" className="ide-file">
              <div className="ide-tab">README.md</div>
              <div className="ide-code">
                <pre className="ide-gutter" aria-hidden="true">{LINES}</pre>
                <div className="ide-content">
                  <p className="ide-comment">{"<!-- Hello, world -->"}</p>
                  <h1 className="ide-name"><span className="ide-tok-h">#</span> {hero.name}</h1>
                  {hero.lede && <p className="pf-hero-summary ide-lede">{hero.lede}</p>}
                  <p className="ide-line">
                    <span className="ide-tok-k">const</span> role = <span className="ide-tok-s">"{hero.role}"</span>;
                  </p>
                  {hero.location && (
                    <p className="ide-line">
                      <span className="ide-tok-k">const</span> location = <span className="ide-tok-s">"{hero.location}"</span>;
                    </p>
                  )}
                  {hero.stats.map((stat) => (
                    <p key={stat.label} className="ide-line ide-comment">{`// ${stat.value} ${stat.label.toLowerCase()}`}</p>
                  ))}
                  <nav className="ide-links">{links.length ? links : <Empty section="profile" compact />}</nav>
                </div>
              </div>
            </article>

            <Sections
              data={data}
              render={({ id, title, body }) => (
                <article id={`ide-${id}`} className="ide-file">
                  <div className="ide-tab">{fileOf(titleOf(data, id), id)}</div>
                  <div className="ide-code">
                    <pre className="ide-gutter" aria-hidden="true">{LINES}</pre>
                    <div className="ide-content">
                      <h2 className="ide-heading"><span className="ide-tok-k">export</span> {title}</h2>
                      {body}
                    </div>
                  </div>
                </article>
              )}
            />
          </main>
        </div>

        <footer className="ide-status">
          <span><i className="bi bi-git" aria-hidden="true" /> main</span>
          <span>{hero.location || "remote"}</span>
          <span className="ide-status-end">UTF-8 · {hero.initials}</span>
        </footer>
      </div>
    </div>
  );
}
