import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Alert, Spinner } from "react-bootstrap";

import ResumeDocument from "./ResumeDocument";
import HeroSummaryPanel from "../Portfolio/HeroSummaryPanel";
import useResumeSettings, { settingsFor } from "./useResumeSettings";
import ResumeChat from "./ResumeChat";
import { ACCENTS, RESUME_DESIGNS, resumeDesignById } from "./resumeDesigns";
import { usePortfolioShowcase, useShowLocation, withLocation, yearsOfWork } from "../Portfolio/portfolioKit";
import { printAs, resumeFileName } from "./resumeFileName";
import "../Portfolio/portfolios.css";
import "./resumes.css";

const ACCENT_KEY = "uuv.resume.accents";
// The resume summary is stored with the hero summaries, as "resume"
const RESUME_SUMMARY = { id: "resume", name: "Resume" };

// The accent picked for each design, remembered in this browser
function useAccent(designId) {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(ACCENT_KEY) || "{}");
    } catch {
      return {};
    }
  };
  const [accents, setAccents] = useState(read);
  const set = (value) => {
    const next = { ...accents, [designId]: value };
    setAccents(next);
    try {
      localStorage.setItem(ACCENT_KEY, JSON.stringify(next));
    } catch {
      // per-browser convenience only
    }
  };
  return [accents[designId] || "", set];
}

// Scales the 816 px page down to fit narrow screens
function usePageScale(ref) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const update = () => {
      const style = getComputedStyle(element);
      setScale(Math.min(1, (element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / 816));
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [ref]);
  return scale;
}

// One designed resume, full page, with a bar to switch design and colour and to print
export default function ResumeView() {
  const { designId } = useParams();
  const navigate = useNavigate();
  const design = resumeDesignById(designId);
  const { status, data, error, setHeroSummaries } = usePortfolioShowcase("resume");
  const [allSettings, updateSettings, setAllSettings] = useResumeSettings();
  // This resume's settings: the shared ones plus its own (from its AI chat)
  const settings = settingsFor(allSettings, designId);
  const allSkills = settings.allSkills;
  const [chatOpen, setChatOpen] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [showLocation, setShowLocation] = useShowLocation();
  // The colour is saved with this resume's settings; older picks were kept in this browser
  const [localAccent, setLocalAccent] = useAccent(designId);
  const accent = settings.accent || localAccent;
  const setAccent = (value) => {
    setLocalAccent("");
    updateSettings({ designId, accent: value }).catch(() => setLocalAccent(value));
  };
  const deskRef = useRef(null);
  const scale = usePageScale(deskRef);
  const paperRef = useRef(null);
  const [paperHeight, setPaperHeight] = useState(1056);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [designId]);

  // The page's real height, so the scaled page takes the right space
  useLayoutEffect(() => {
    const element = paperRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setPaperHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [status]);

  if (!design) return <Navigate to="/dashboard/resumes" replace />;

  // US guidance: 1 page early in a career, up to 2 with experience
  const pages = Math.max(1, Math.ceil(paperHeight / 1056 - 0.02));
  const experienced = status === "ready" && yearsOfWork(data.experiences) >= 3;
  const maxPages = experienced ? 2 : 1;
  const tooLong = status === "ready" && pages > maxPages;

  const index = RESUME_DESIGNS.indexOf(design);
  const previous = RESUME_DESIGNS[(index - 1 + RESUME_DESIGNS.length) % RESUME_DESIGNS.length];
  const next = RESUME_DESIGNS[(index + 1) % RESUME_DESIGNS.length];

  return (
    <div className={`rd-desk ${chatOpen ? "has-chat" : ""}`} ref={deskRef}>
      {status === "loading" && <div className="d-flex justify-content-center py-5"><Spinner animation="border" variant="primary" /></div>}
      {status === "error" && <Alert variant="danger" className="mx-auto" style={{ maxWidth: 816 }}>{error}</Alert>}
      {status === "ready" && (
        // The scaled page keeps its real height in the layout
        <div style={{ height: paperHeight * scale }}>
          <div className="rd-paper" ref={paperRef} style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: "top left", marginLeft: 0 } : undefined}>
            <ResumeDocument data={withLocation(data, showLocation)} design={design} accent={accent} settings={settings} />
            {/* Where each printed page ends (screen only) */}
            {Array.from({ length: pages - 1 }, (_, index) => (
              <div key={index} className="rd-page-break d-print-none" style={{ top: (index + 1) * 1056 }} aria-hidden="true">
                <span>Page {index + 2}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pf-switcher d-print-none" role="toolbar" aria-label="Resume designs">
        <Link to="/dashboard/resumes" className="pf-switcher-btn" title="All resumes">
          <i className="bi bi-grid-3x3-gap" aria-hidden="true" /><span className="d-none d-md-inline">All</span>
        </Link>
        <span className="pf-switcher-sep" />
        <Link to={`/resume/${previous.id}`} className="pf-switcher-btn" aria-label={`Previous design: ${previous.name}`}>
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </Link>
        <label className="visually-hidden" htmlFor="rd-design-select">Design</label>
        <select id="rd-design-select" className="pf-switcher-select" value={design.id} onChange={(event) => navigate(`/resume/${event.target.value}`)}>
          {RESUME_DESIGNS.map((item, itemIndex) => <option key={item.id} value={item.id}>{itemIndex + 1}. {item.name}</option>)}
        </select>
        <Link to={`/resume/${next.id}`} className="pf-switcher-btn" aria-label={`Next design: ${next.name}`}>
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </Link>
        <span className="pf-switcher-sep" />
        <div className="rd-swatches" role="radiogroup" aria-label="Colour">
          {[design.accent, ...ACCENTS.filter((color) => color !== design.accent)].slice(0, 7).map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={(accent || design.accent) === color}
              aria-label={color === design.accent ? "Design's own colour" : `Colour ${color}`}
              className={`rd-swatch ${(accent || design.accent) === color ? "is-on" : ""}`}
              style={{ background: color }}
              onClick={() => setAccent(color === design.accent ? "" : color)}
            />
          ))}
        </div>
        <span className="pf-switcher-sep" />
        <button
          type="button"
          className={`pf-switcher-btn ${showLocation ? "is-on" : ""}`}
          onClick={() => setShowLocation(!showLocation)}
          aria-pressed={showLocation}
          title={showLocation ? "Hide my location" : "Show my location"}
        >
          <i className={`bi ${showLocation ? "bi-geo-alt-fill" : "bi-geo-alt"}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`pf-switcher-btn ${data?.heroSummaries?.resume ? "is-on" : ""}`}
          onClick={() => setEditingSummary(true)}
          disabled={status !== "ready"}
          title="Resume summary: a short version written by the AI agent, or your own words"
        >
          <i className="bi bi-stars" aria-hidden="true" /><span className="d-none d-md-inline">Summary</span>
        </button>
        <button
          type="button"
          className={`pf-switcher-btn ${allSkills ? "is-on" : ""}`}
          onClick={() => updateSettings({ designId, allSkills: !allSkills }).catch(() => {})}
          aria-pressed={allSkills}
          title={allSkills ? "This resume shows every skill. Click to show only your key skills (up to 15)" : "This resume shows your key skills (up to 15). Click to add the rest"}
        >
          <i className="bi bi-lightning-charge" aria-hidden="true" /><span className="d-none d-md-inline">{allSkills ? "All skills" : "Key skills"}</span>
        </button>
        <span
          className={`rd-pages ${tooLong ? "is-long" : ""}`}
          title={tooLong
            ? `${pages} pages: ${experienced ? "keep experienced resumes to 2 pages" : "early-career resumes read best on 1 page"}. Ask the assistant for fewer jobs or projects, or turn off All skills.`
            : `${pages} page${pages === 1 ? "" : "s"}: within the US guideline (${maxPages === 1 ? "1 page early in a career" : "up to 2 pages with experience"})`}
        >
          <i className={`bi ${tooLong ? "bi-exclamation-triangle" : "bi-file-earmark"}`} aria-hidden="true" /> {pages}p
        </span>
        <button
          type="button"
          className={`pf-switcher-btn rd-chat-open ${chatOpen ? "is-on" : ""}`}
          onClick={() => setChatOpen(true)}
          disabled={status !== "ready"}
          title="Customize this resume with the AI agent"
        >
          <i className="bi bi-magic" aria-hidden="true" /><span className="d-none d-md-inline">Customize</span>
        </button>
        <button type="button" className="pf-switcher-btn" onClick={() => printAs(resumeFileName(data?.contact?.name, design.name))} title="Print or save as PDF">
          <i className="bi bi-printer" aria-hidden="true" /><span className="d-none d-md-inline">PDF</span>
        </button>
      </div>

      {/* A new design starts its own conversation */}
      <ResumeChat
        key={design.id}
        show={chatOpen}
        onHide={() => setChatOpen(false)}
        design={design}
        data={data}
        hiddenEntries={settings.hiddenEntries}
        // The chat keeps the design's own colour: only the resume changes
        accent={design.accent}
        onSettings={setAllSettings}
        onShowEntry={(key) => updateSettings({ designId, showEntries: [key] }).catch(() => {})}
      />

      {status === "ready" && (
        <HeroSummaryPanel
          show={editingSummary}
          onHide={() => setEditingSummary(false)}
          design={RESUME_SUMMARY}
          data={data}
          setHeroSummaries={setHeroSummaries}
          title="Resume summary"
          intro="The summary at the top of your designed resumes: 40 to 60 words with your title and years, what you build with your key skills and one measured result. The AI agent reads your whole About me and portfolio and writes it using only your facts; or write your own."
        />
      )}
    </div>
  );
}
