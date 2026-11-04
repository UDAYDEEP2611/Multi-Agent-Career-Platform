import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "react-bootstrap";

import { getPortfolioOverview } from "../../api/portfolioApi";
import { listMatchLogs } from "../../api/resumeApi";
import { CvMakerIcon, JobPilotIcon } from "../Layout/FeatureIcons";
import { scoreColor } from "../Resume/matchHelpers";
import "./dashboard.css";

// Every section, in sidebar order. core: counts toward completeness.
// hue: the section's accent colour on its card.
const SECTIONS = [
  { key: "profile", label: "Profile", icon: "bi-person", path: "/dashboard/profile", core: true, single: true, hue: 235, next: "Add your contact and personal details" },
  { key: "summary", label: "Summary", icon: "bi-card-text", path: "/dashboard/summary", core: true, single: true, hue: 265, next: "Write a short professional summary" },
  { key: "experience", label: "Experience", icon: "bi-briefcase", path: "/dashboard/experience", core: true, hue: 200, next: "Add your work experience" },
  { key: "education", label: "Education", icon: "bi-mortarboard", path: "/dashboard/education", core: true, hue: 160, next: "Add your education" },
  { key: "skills", label: "Skills", icon: "bi-lightning", path: "/dashboard/skills", core: true, hue: 38, next: "Add your skills and rate them" },
  { key: "projects", label: "Projects", icon: "bi-folder", path: "/dashboard/projects", core: true, hue: 300, next: "Showcase a project" },
  { key: "certifications", label: "Certifications", icon: "bi-patch-check", path: "/dashboard/certifications", hue: 190 },
  { key: "publications", label: "Publications", icon: "bi-journal-text", path: "/dashboard/publications", hue: 220 },
  { key: "patents", label: "Patents", icon: "bi-lightbulb", path: "/dashboard/patents", hue: 48 },
  { key: "achievements", label: "Achievements", icon: "bi-trophy", path: "/dashboard/achievements", hue: 28 },
  { key: "recommendations", label: "Recommendations", icon: "bi-chat-quote", path: "/dashboard/recommendations", hue: 330 },
  { key: "interests", label: "Interests", icon: "bi-heart", path: "/dashboard/interests", hue: 350 },
  { key: "volunteering", label: "Volunteering", icon: "bi-people", path: "/dashboard/volunteering", hue: 140 }
];

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

// Completion ring for the hero banner
function ProgressRing({ percent, size = 132, stroke = 12 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="dash-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Portfolio ${percent}% complete`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#dash-ring-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="dash-ring-value"
        />
        <defs>
          <linearGradient id="dash-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f0abfc" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
      </svg>
      <div className="dash-ring-label">
        <span className="fs-2 fw-bold">{percent}%</span>
        <span className="small opacity-75">complete</span>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, hint, hue }) {
  return (
    <div className="col">
      <div className="dash-card dash-stat h-100" style={{ "--hue": hue }}>
        <div className="dash-tile"><i className={`bi ${icon}`} /></div>
        <div>
          <div className="dash-stat-value">{value}</div>
          <div className="fw-semibold small">{label}</div>
          {hint && <div className="small text-secondary">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

function ToolCard({ to, icon, title, text, action, variant }) {
  return (
    <div className="col-md-6">
      <Link to={to} className={`dash-tool dash-tool-${variant} text-decoration-none h-100`}>
        <div className="dash-tool-icon">{icon}</div>
        <div className="flex-grow-1">
          <h5 className="fw-bold mb-1">{title}</h5>
          <p className="mb-3 opacity-75">{text}</p>
          <span className="dash-tool-action">{action} <i className="bi bi-arrow-right" /></span>
        </div>
      </Link>
    </div>
  );
}

function SectionCard({ section, count }) {
  const status = section.single ? (count ? "Done" : "Not added") : count ? `${count} added` : "Add first";

  return (
    <div className="col">
      <Link to={section.path} className={`dash-card dash-section text-reset text-decoration-none h-100${count ? "" : " is-empty"}`} style={{ "--hue": section.hue }}>
        <div className="dash-tile"><i className={`bi ${section.icon}`} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="fw-semibold text-truncate">{section.label}</div>
          <div className="small text-secondary">{status}</div>
        </div>
        {count ? (
          <i className="bi bi-check-circle-fill text-success ms-auto" title="Added" />
        ) : section.core ? (
          <i className="bi bi-exclamation-circle text-warning ms-auto" title="Needed for a complete portfolio" />
        ) : (
          <i className="bi bi-plus-circle text-secondary ms-auto dash-section-add" title="Add" />
        )}
      </Link>
    </div>
  );
}

// The Dashboard: greeting and completeness, quick stats, the CV Maker and
// JobPilot tools, recent JobPilot checks, and a card per portfolio section.
export default function PortfolioOverview({ username }) {
  const [overview, setOverview] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    let active = true;

    getPortfolioOverview()
      .then(({ data }) => active && setOverview(data))
      .catch(() => active && setOverview({ failed: true }));
    // Recent checks are a bonus: the dashboard works without them
    listMatchLogs()
      .then(({ data }) => active && setLogs(data.logs || []))
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  if (!overview) {
    return <div className="text-center py-5"><Spinner animation="border" /></div>;
  }

  if (overview.failed) {
    return (
      <div className="dash-card text-secondary">
        Your portfolio overview couldn't be loaded. Open a section from the sidebar.
      </div>
    );
  }

  const { filled, total, missing } = overview.completeness;
  const percent = Math.round((filled / total) * 100);
  const nextSteps = SECTIONS.filter((section) => missing.includes(section.key)).slice(0, 3);
  const items = SECTIONS.reduce((sum, section) => sum + (overview.sections[section.key] || 0), 0);
  const sectionsUsed = SECTIONS.filter((section) => overview.sections[section.key]).length;
  const best = logs.length ? Math.max(...logs.map((log) => log.overall || 0)) : null;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="dash">
      {/* Hero: greeting, completeness and what to do next */}
      <section className="dash-hero mb-4">
        <div className="dash-hero-glow" aria-hidden="true" />
        <div className="position-relative d-flex flex-wrap align-items-center gap-4">
          <div className="flex-grow-1" style={{ minWidth: 260 }}>
            <div className="small text-uppercase fw-semibold dash-hero-date">{today}</div>
            <h1 className="dash-hero-title">
              {greeting()}{username ? `, ${username}` : ""}
            </h1>
            <p className="mb-3 opacity-75">
              {percent === 100
                ? "Your portfolio is complete. Keep it current as you grow."
                : `${filled} of ${total} core sections done. A few more steps to a complete portfolio.`}
            </p>

            {nextSteps.length > 0 ? (
              <div className="d-flex flex-wrap gap-2">
                {nextSteps.map((section) => (
                  <Link key={section.key} to={section.path} className="dash-chip">
                    <i className={`bi ${section.icon}`} />{section.next}
                  </Link>
                ))}
              </div>
            ) : (
              <Link to="/dashboard/resume" className="dash-chip">
                <CvMakerIcon />Build a tailored CV
              </Link>
            )}
          </div>
          <ProgressRing percent={percent} />
        </div>
      </section>

      {/* Quick stats */}
      <div className="row row-cols-2 row-cols-xl-4 g-3 mb-4">
        <StatCard icon="bi-pie-chart" label="Core sections" value={`${filled}/${total}`} hint={percent === 100 ? "All done" : `${total - filled} to go`} hue={235} />
        <StatCard icon="bi-collection" label="Items added" value={items} hint={`Across ${sectionsUsed} sections`} hue={160} />
        <StatCard icon="bi-bullseye" label="JobPilot checks" value={logs.length} hint="Last 72 hours" hue={300} />
        <StatCard icon="bi-graph-up-arrow" label="Best match" value={best === null ? "—" : `${best}%`} hint={best === null ? "No checks yet" : "Highest recent score"} hue={38} />
      </div>

      {/* Tools */}
      <div className="row g-3 mb-4">
        <ToolCard
          to="/dashboard/resume"
          variant="cv"
          icon={<CvMakerIcon />}
          title="CV Maker"
          text="Turn your portfolio into a US-format resume tailored to a job description."
          action="Create a CV"
        />
        <ToolCard
          to="/dashboard/resume-match"
          variant="match"
          icon={<JobPilotIcon />}
          title="JobPilot"
          text="Upload a resume and a job description to see the match, the gaps and an ATS check."
          action="Check a match"
        />
      </div>

      {/* Recent JobPilot checks */}
      {logs.length > 0 && (
        <section className="dash-card mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="fw-bold mb-0">Recent JobPilot checks</h5>
            <Link to="/dashboard/resume-match/logs" className="small text-decoration-none text-nowrap">
              Log Book <i className="bi bi-arrow-right" />
            </Link>
          </div>
          <div className="d-flex flex-column gap-2">
            {logs.slice(0, 3).map((log) => (
              <Link key={log.id} to={`/dashboard/resume-match/logs/${log.id}`} className="dash-log text-reset text-decoration-none">
                <span className={`dash-score text-bg-${scoreColor(log.overall)}`}>{log.overall}%</span>
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="fw-semibold text-truncate">{log.jobTitle || "Untitled job"}{log.company ? <span className="fw-normal text-secondary"> · {log.company}</span> : null}</div>
                  <div className="small text-secondary text-truncate">
                    {log.fileName}{log.atsScore != null ? ` · ATS ${log.atsScore}` : ""}
                  </div>
                </div>
                <span className="small text-secondary text-nowrap d-none d-sm-inline">{new Date(log.createdAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sections */}
      <h5 className="fw-bold mb-3">Core sections</h5>
      <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3 mb-4">
        {SECTIONS.filter((section) => section.core).map((section) => (
          <SectionCard key={section.key} section={section} count={overview.sections[section.key] || 0} />
        ))}
      </div>

      <h5 className="fw-bold mb-3">More sections</h5>
      <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xxl-4 g-3">
        {SECTIONS.filter((section) => !section.core).map((section) => (
          <SectionCard key={section.key} section={section} count={overview.sections[section.key] || 0} />
        ))}
      </div>
    </div>
  );
}
