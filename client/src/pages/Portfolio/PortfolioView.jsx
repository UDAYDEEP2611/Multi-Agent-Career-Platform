import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Alert, Spinner } from "react-bootstrap";

import { DESIGNS, designById } from "./designs";
import HeroSummaryPanel from "./HeroSummaryPanel";
import ChatWidget from "../Chat/ChatWidget";
import { customCss, customIdOf, useCustomDesign, useCustomDesigns, withCustomLayout } from "./customDesign";
import {
  MODE_OPTIONS, useFitHeadings, usePortfolioMode, usePortfolioShowcase, useShowLocation, withHeroSummary, withLocation
} from "./portfolioKit";
import "./portfolios.css";

const SCOPE = "pf-custom-scope";

// One design, full page, with a floating bar to switch designs, mode and
// location. "custom-<id>" shows one of the user's custom designs on its base.
export default function PortfolioView() {
  const { designId } = useParams();
  const navigate = useNavigate();
  const customId = customIdOf(designId);
  const { status: customStatus, design: custom } = useCustomDesign(customId);
  const [customDesigns] = useCustomDesigns();
  const design = customId ? designById(custom?.baseId) : designById(designId);
  const { status, data, error, setHeroSummaries } = usePortfolioShowcase();
  const [editingSummary, setEditingSummary] = useState(false);
  const [showLocation, setShowLocation] = useShowLocation();
  const { mode, setMode, resolved: chosen } = usePortfolioMode();
  // A custom design can be set to always light or always dark
  const resolved = custom?.mode || chosen;
  const rootRef = useRef(null);
  useFitHeadings(rootRef, [designId, status, data, showLocation, resolved, custom]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [designId]);

  if (customId && customStatus === "loading") {
    return <div className="d-flex justify-content-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (!design) return <Navigate to="/dashboard/portfolios" replace />;

  const index = DESIGNS.indexOf(design);
  const previous = DESIGNS[(index - 1 + DESIGNS.length) % DESIGNS.length];
  const next = DESIGNS[(index + 1) % DESIGNS.length];
  const modeIndex = MODE_OPTIONS.findIndex((option) => option.value === mode);
  const currentMode = MODE_OPTIONS[modeIndex];
  const nextMode = MODE_OPTIONS[(modeIndex + 1) % MODE_OPTIONS.length];
  const { Component } = design;

  return (
    <div ref={rootRef} className={`pf-mode-root ${custom ? SCOPE : ""}`} data-pf-mode={resolved}>
      {custom && <style>{customCss(custom, SCOPE)}</style>}
      {status === "loading" && (
        <div className="d-flex justify-content-center py-5"><Spinner animation="border" variant="primary" /></div>
      )}
      {status === "error" && <div className="container py-5"><Alert variant="danger">{error}</Alert></div>}
      {status === "ready" && <Component data={withCustomLayout(withHeroSummary(withLocation(data, showLocation), design.id), custom)} />}

      <div className="pf-switcher d-print-none" role="toolbar" aria-label="Portfolio designs">
        <Link to="/dashboard/portfolios" className="pf-switcher-btn" title="All designs">
          <i className="bi bi-grid-3x3-gap" aria-hidden="true" /><span className="d-none d-md-inline">All</span>
        </Link>
        <span className="pf-switcher-sep" />
        <Link to={`/portfolio/${previous.id}`} className="pf-switcher-btn" aria-label={`Previous design: ${previous.name}`}>
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </Link>
        <label className="visually-hidden" htmlFor="pf-design-select">Design</label>
        <select
          id="pf-design-select"
          className="pf-switcher-select"
          value={custom ? `custom-${custom.id}` : design.id}
          onChange={(event) => navigate(`/portfolio/${event.target.value}`)}
        >
          {customDesigns.length > 0 && (
            <optgroup label="My designs">
              {customDesigns.map((item) => <option key={item.id} value={`custom-${item.id}`}>{item.name}</option>)}
            </optgroup>
          )}
          <optgroup label="Designs">
            {DESIGNS.map((item, itemIndex) => (
              <option key={item.id} value={item.id}>{itemIndex + 1}. {item.name}</option>
            ))}
          </optgroup>
        </select>
        <Link to={`/portfolio/${next.id}`} className="pf-switcher-btn" aria-label={`Next design: ${next.name}`}>
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </Link>
        <span className="pf-switcher-sep" />
        <button
          type="button"
          className="pf-switcher-btn"
          onClick={() => setMode(nextMode.value)}
          title={`Mode: ${currentMode.label}${mode === "auto" ? ` (${resolved})` : ""}. Click for ${nextMode.label}`}
        >
          <i className={`bi ${currentMode.icon}`} aria-hidden="true" />
          <span className="d-none d-md-inline">{currentMode.label}</span>
        </button>
        <button
          type="button"
          className={`pf-switcher-btn ${showLocation ? "is-on" : ""}`}
          onClick={() => setShowLocation(!showLocation)}
          aria-pressed={showLocation}
          title={showLocation ? "Hide my location" : "Show my location"}
        >
          <i className={`bi ${showLocation ? "bi-geo-alt-fill" : "bi-geo-alt"}`} aria-hidden="true" />
        </button>
        {!custom && (
          <button
            type="button"
            className={`pf-switcher-btn ${data?.heroSummaries?.[design.id] ? "is-on" : ""}`}
            onClick={() => setEditingSummary(true)}
            disabled={status !== "ready"}
            title="Hero summary: write it with AI or in your own words"
          >
            <i className="bi bi-stars" aria-hidden="true" /><span className="d-none d-md-inline">Summary</span>
          </button>
        )}
        <button type="button" className="pf-switcher-btn" onClick={() => window.print()} title="Print or save as PDF">
          <i className="bi bi-printer" aria-hidden="true" />
        </button>
      </div>

      <ChatWidget raised />

      {status === "ready" && !custom && (
        <HeroSummaryPanel
          key={design.id}
          show={editingSummary}
          onHide={() => setEditingSummary(false)}
          design={design}
          data={data}
          setHeroSummaries={setHeroSummaries}
        />
      )}
    </div>
  );
}
