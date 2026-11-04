import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, ButtonGroup, Form, Spinner, ToggleButton } from "react-bootstrap";

import { DESIGNS, DESIGN_TAGS, designById } from "./designs";
import useHeroSummaryAgent from "./useHeroSummaryAgent";
import { deleteHeroSummary } from "../../api/portfolioApi";
import { deleteCustomDesign } from "../../api/agentApi";
import { customCss, customRoute, useCustomDesigns, withCustomLayout } from "./customDesign";
import {
  MODE_OPTIONS, usePortfolioMode, usePortfolioShowcase, useShowLocation, withHeroSummary, withLocation
} from "./portfolioKit";
import "./portfolios.css";

const PREVIEW_WIDTH = 1280;

// A live, scaled-down render of a design with the user's own data.
// It renders only once scrolled near, so twenty previews stay light.
function Thumbnail({ design, data, mode }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.25);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    const resize = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PREVIEW_WIDTH));
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

  const { Component } = design;
  return (
    <div className="pf-thumb" ref={box} data-pf-mode={mode}>
      {visible ? (
        <div className="pf-thumb-inner" style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})` }} inert>
          <Component data={data} />
        </div>
      ) : (
        <div className="pf-thumb-wait"><Spinner animation="grow" size="sm" /></div>
      )}
    </div>
  );
}

// The user's own designs, made by the design agent in the chat
function MyDesigns({ data, mode }) {
  const [designs, setDesigns] = useCustomDesigns();
  const [error, setError] = useState("");

  async function remove(design) {
    if (!window.confirm(`Delete "${design.name}"? This can't be undone.`)) return;
    setError("");
    try {
      await deleteCustomDesign(design.id);
      setDesigns((current) => current.filter((item) => item.id !== design.id));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete the design");
    }
  }

  return (
    <section className="mb-4" aria-label="My designs">
      <div className="d-flex flex-wrap align-items-baseline gap-2 mb-2">
        <h2 className="h5 fw-bold mb-0">My designs</h2>
        <span className="small text-secondary">
          {designs.length ? "Made with the design agent. Open one and tell the assistant what to change." : "Open the assistant (bottom right) and say, for example, \"Make a dark green Slate called Forest and hide projects\"."}
        </span>
      </div>
      {error && <Alert variant="danger" className="small">{error}</Alert>}
      {designs.length > 0 && (
        <div className="row g-4">
          {designs.map((custom) => {
            const base = designById(custom.baseId);
            if (!base) return null;
            const scope = `pf-cd-${custom.id}`;
            return (
              <div key={custom.id} className="col-12 col-md-6 col-xxl-4">
                <div className="position-relative">
                  <Link to={customRoute(custom.id)} className={`pf-gallery-card text-decoration-none ${scope}`}>
                    <style>{customCss(custom, scope)}</style>
                    <Thumbnail design={base} data={withCustomLayout(withHeroSummary(data, base.id), custom)} mode={custom.mode || mode} />
                    <div className="pf-gallery-meta">
                      <span className="pf-gallery-no pf-gallery-mine" style={custom.accent ? { background: custom.accent } : undefined}>
                        <i className="bi bi-stars" aria-hidden="true" />
                      </span>
                      <div className="flex-grow-1 min-w-0">
                        <h3 className="h6 fw-bold mb-0 text-body text-truncate">{custom.name}</h3>
                        <p className="small text-secondary mb-0 text-truncate">
                          From {custom.baseName}
                          {Object.entries(custom.limits || {}).map(([id, count]) => ` · ${count} ${id}`).join("")}
                          {custom.hidden.length ? ` · hides ${custom.hidden.join(", ")}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="pf-gallery-open">Open <i className="bi bi-arrow-up-right" aria-hidden="true" /></span>
                  </Link>
                  <Button
                    variant="light"
                    size="sm"
                    className="pf-gallery-delete border"
                    onClick={() => remove(custom)}
                    aria-label={`Delete ${custom.name}`}
                    title="Delete this design"
                  >
                    <i className="bi bi-trash" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// "swiss: left out because…" -> "Swiss: left out because…"
const noteText = (note) => note.replace(/^([a-z]+):/, (match, id) => `${designById(id)?.name || id}:`);

// The hero summary agent for every design at once
function SmartSummaries({ portfolio, agent, resetError, onReset }) {
  const saved = Object.values(portfolio.heroSummaries || {});
  const stale = saved.filter((item) => item.stale).length;

  return (
    <div className="pf-smart card border-0 shadow-sm mb-4">
      <div className="card-body d-flex flex-wrap align-items-center gap-3">
        <span className="pf-smart-icon" aria-hidden="true"><i className="bi bi-stars" /></span>
        <div className="flex-grow-1 min-w-0">
          <h2 className="h6 fw-bold mb-1">Smart summaries</h2>
          <p className="small text-secondary mb-0">
            {agent.running ? `${agent.progress}…`
              : saved.length ? `${saved.length} of ${DESIGNS.length} designs have their own hero summary${stale ? `; ${stale} written before your summary or headline changed` : ""}.`
                : "An AI agent reads your whole About me, then writes a short hero summary for each design in its own voice, sized to fit, using only facts from your portfolio. Takes a few minutes with the local model."}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {agent.running ? (
            <Button variant="outline-secondary" size="sm" onClick={agent.stop}>Stop</Button>
          ) : (
            <>
              <Button size="sm" onClick={() => agent.run()} disabled={!portfolio.summary && !portfolio.experiences.length}>
                <i className="bi bi-stars me-1" aria-hidden="true" />{saved.length ? "Rewrite all with AI" : "Write with AI"}
              </Button>
              {saved.length > 0 && <Button variant="outline-secondary" size="sm" onClick={onReset}>Reset all</Button>}
            </>
          )}
        </div>
        {agent.running && <div className="pf-smart-bar w-100" aria-hidden="true"><span /></div>}
        {agent.written > 0 && !agent.running && (
          <p className="small text-success w-100 mb-0"><i className="bi bi-check-circle me-1" aria-hidden="true" />Wrote {agent.written} summaries.</p>
        )}
        {agent.error && <Alert variant="danger" className="small w-100 mb-0">{agent.error}</Alert>}
        {resetError && <Alert variant="danger" className="small w-100 mb-0">{resetError}</Alert>}
        {agent.notes.length > 0 && (
          <Alert variant="warning" className="small w-100 mb-0">
            <ul className="mb-0 ps-3">{agent.notes.map((note) => <li key={note}>{noteText(note)}</li>)}</ul>
          </Alert>
        )}
      </div>
    </div>
  );
}

// Dashboard page: pick one of the portfolio designs
export default function PortfolioGallery() {
  const { status, data: portfolio, error, setHeroSummaries } = usePortfolioShowcase();
  const agent = useHeroSummaryAgent(setHeroSummaries);
  const [resetError, setResetError] = useState("");
  const [showLocation, setShowLocation] = useShowLocation();
  const { mode, setMode, resolved } = usePortfolioMode();
  const [tag, setTag] = useState("All");
  const data = withLocation(portfolio, showLocation);
  const shown = DESIGNS.filter((design) => tag === "All" || design.tags.includes(tag));

  return (
    <div className="container-fluid">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
        <div>
          <h1 className="fw-bold">My Portfolios</h1>
          <p className="text-secondary mb-0">
            {DESIGNS.length} designs, each in light and dark, led by your About me, then experience, education
            and skills. Projects and other sections appear once you've added them.
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-3">
          <ButtonGroup size="sm" aria-label="Light or dark">
            {MODE_OPTIONS.map((option) => (
              <ToggleButton
                key={option.value}
                id={`pf-mode-${option.value}`}
                type="radio"
                name="pf-mode"
                variant="outline-secondary"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
              >
                <i className={`bi ${option.icon} me-1`} aria-hidden="true" />{option.label}
              </ToggleButton>
            ))}
          </ButtonGroup>
          <Form.Check
            type="switch"
            id="portfolio-show-location"
            label="Show my location"
            checked={showLocation}
            onChange={(event) => setShowLocation(event.target.checked)}
          />
        </div>
      </div>

      <div className="pf-filter mb-4" role="group" aria-label="Filter designs">
        {DESIGN_TAGS.map((item) => (
          <button
            key={item}
            type="button"
            className={`pf-filter-btn ${tag === item ? "is-on" : ""}`}
            onClick={() => setTag(item)}
            aria-pressed={tag === item}
          >
            {item}
            <span>{item === "All" ? DESIGNS.length : DESIGNS.filter((design) => design.tags.includes(item)).length}</span>
          </button>
        ))}
      </div>

      {status === "ready" && (
        <SmartSummaries
          portfolio={portfolio}
          agent={agent}
          resetError={resetError}
          onReset={async () => {
            setResetError("");
            try {
              const { data: reply } = await deleteHeroSummary();
              setHeroSummaries(reply.heroSummaries);
            } catch (err) {
              setResetError(err.response?.data?.message || "Unable to reset the summaries");
            }
          }}
        />
      )}

      {status === "ready" && <MyDesigns data={data} mode={resolved} />}

      {status === "loading" && (
        <div className="d-flex justify-content-center py-5"><Spinner animation="border" variant="primary" /></div>
      )}
      {status === "error" && <Alert variant="danger">{error}</Alert>}

      {status === "ready" && (
        <div className="row g-4 justify-content-center">
          {shown.map((design) => (
            <div key={design.id} className="col-12 col-md-6 col-xxl-4">
              <Link to={`/portfolio/${design.id}`} className="pf-gallery-card text-decoration-none">
                <Thumbnail design={design} data={withHeroSummary(data, design.id)} mode={resolved} />
                <div className="pf-gallery-meta">
                  <span className="pf-gallery-no">{DESIGNS.indexOf(design) + 1}</span>
                  <div className="flex-grow-1 min-w-0">
                    <h2 className="h6 fw-bold mb-0 text-body">{design.name}</h2>
                    <p className="small text-secondary mb-0 text-truncate">{design.tagline}</p>
                  </div>
                  <div className="d-none d-sm-flex gap-1">
                    {design.tags.map((item) => <span key={item} className="badge text-bg-light border fw-normal">{item}</span>)}
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
