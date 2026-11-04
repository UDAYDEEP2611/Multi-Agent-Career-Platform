import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Spinner } from "react-bootstrap";

import ResumeDocument from "./ResumeDocument";
import useResumeSettings, { settingsFor } from "./useResumeSettings";
import { RESUME_DESIGNS, RESUME_TAGS } from "./resumeDesigns";
import { usePortfolioShowcase, useShowLocation, withLocation } from "../Portfolio/portfolioKit";
import "../Portfolio/portfolios.css";
import "./resumes.css";

const PAGE_WIDTH = 816;

// The card's number badge: the design's dark sidebar colour, else its accent
const badgeColor = (design) => {
  const hex = (design.sideBg || "").replace("#", "");
  const dark = hex.length === 6 && [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).reduce((sum, value, i) => sum + value * [0.299, 0.587, 0.114][i], 0) < 140;
  return dark ? design.sideBg : design.accent;
};

// A live, scaled-down first page, rendered once it's scrolled near
function Thumbnail({ design, data, settings, accent }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.3);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    const resize = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PAGE_WIDTH));
    const seen = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        seen.disconnect();
      }
    }, { rootMargin: "300px" });
    resize.observe(element);
    seen.observe(element);
    return () => {
      resize.disconnect();
      seen.disconnect();
    };
  }, []);

  return (
    <div className="rd-thumb" ref={box}>
      {visible ? (
        <div className="rd-thumb-inner" style={{ transform: `scale(${scale})` }} inert>
          <ResumeDocument data={data} design={design} settings={settings} accent={accent || undefined} />
        </div>
      ) : (
        <div className="pf-thumb-wait"><Spinner animation="grow" size="sm" /></div>
      )}
    </div>
  );
}

// Dashboard page: pick a designed resume
export default function ResumeGallery() {
  const { status, data: portfolio, error } = usePortfolioShowcase("resume");
  const [showLocation] = useShowLocation();
  const [tag, setTag] = useState("All");
  const [settings] = useResumeSettings();
  const data = withLocation(portfolio, showLocation);
  const shown = RESUME_DESIGNS.filter((design) => tag === "All" || design.tags.includes(tag));

  return (
    <div className="container-fluid">
      <div className="mb-3">
        <h1 className="fw-bold">My Resumes</h1>
        <p className="text-secondary mb-0">
          {RESUME_DESIGNS.length} designed resumes, filled from your portfolio: all your jobs (each with its best points), your latest
          schools and projects, all your certifications, and your key skills. Want more? Ask the assistant, for example "show all my projects on my resume".
          Open one to pick its colour and save it as a PDF.
          For a plain, ATS-first resume tailored to a job, use the <Link to="/dashboard/resume">CV Maker</Link>.
        </p>
      </div>

      <div className="pf-filter mb-4" role="group" aria-label="Filter resumes">
        {RESUME_TAGS.map((item) => (
          <button
            key={item}
            type="button"
            className={`pf-filter-btn ${tag === item ? "is-on" : ""}`}
            onClick={() => setTag(item)}
            aria-pressed={tag === item}
          >
            {item}
            <span>{item === "All" ? RESUME_DESIGNS.length : RESUME_DESIGNS.filter((design) => design.tags.includes(item)).length}</span>
          </button>
        ))}
      </div>

      {status === "loading" && <div className="d-flex justify-content-center py-5"><Spinner animation="border" variant="primary" /></div>}
      {status === "error" && <Alert variant="danger">{error}</Alert>}

      {status === "ready" && (
        <div className="row g-4 justify-content-center">
          {shown.map((design) => (
            <div key={design.id} className="col-12 col-sm-6 col-lg-4 col-xxl-3">
              <Link to={`/resume/${design.id}`} className="pf-gallery-card text-decoration-none">
                <Thumbnail design={design} data={data} settings={settingsFor(settings, design.id)} accent={settingsFor(settings, design.id).accent} />
                <div className="pf-gallery-meta">
                  <span className="pf-gallery-no" style={{ background: badgeColor(design) }}>
                    {RESUME_DESIGNS.indexOf(design) + 1}
                  </span>
                  <div className="flex-grow-1 min-w-0">
                    <h2 className="h6 fw-bold mb-0 text-body">{design.name}</h2>
                    <p className="small text-secondary mb-0 text-truncate">{design.tagline}</p>
                  </div>
                </div>
                <span className="pf-gallery-open">Open <i className="bi bi-arrow-up-right" aria-hidden="true" /></span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
