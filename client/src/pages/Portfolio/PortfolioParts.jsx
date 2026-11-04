import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { EXTRA_SECTIONS, SECTIONS, dateText, isExternal, openToLines, projectLayout, rangeText } from "./portfolioKit";

// Building blocks every portfolio design uses

// "Unfortunately, experience data is not yet present." + a button to add it
export function Empty({ section, className = "", compact = false }) {
  const { label, to } = SECTIONS[section];

  return (
    <div className={`pf-empty ${compact ? "pf-empty-compact" : ""} ${className}`.trim()}>
      <i className="bi bi-inbox pf-empty-icon" aria-hidden="true" />
      <p className="pf-empty-text">
        Unfortunately, {label} data is not yet present. Please add it.
      </p>
      <Link to={to} className="pf-empty-btn">
        <i className="bi bi-plus-lg me-1" aria-hidden="true" />
        Add {label}
      </Link>
    </div>
  );
}

// The top of About me: your Role Details headline and what you're looking for
export function AboutLead({ data, className = "" }) {
  const lines = openToLines(data.openTo);
  if (!data.headline && !lines.length) return null;

  return (
    <div className={`pf-about-lead ${className}`.trim()}>
      {data.headline && <p className="pf-about-headline">{data.headline}</p>}
      {lines.length > 0 && (
        <dl className="pf-open-to">
          {lines.map((line) => (
            <div key={line.key} className={`pf-open-to-row pf-open-to-${line.key}`}>
              <dt>
                <span className="pf-open-to-icon"><i className={`bi ${line.icon}`} aria-hidden="true" /></span>
                {line.label}
              </dt>
              <dd>
                <ul className="pf-chips">
                  {line.items.map((item) => (
                    <li key={item.text} className={`pf-chip ${item.icon ? "pf-chip-place" : ""}`.trim()}>
                      {item.icon && <i className={`bi ${item.icon}`} aria-hidden="true" />}
                      {item.text}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// Skills that aren't marked important: a plain, comma-separated line
export function OtherSkills({ skills, title = "Other skills", className = "" }) {
  if (!skills.length) return null;
  return (
    <p className={`pf-other-skills ${className}`.trim()}>
      <span className="pf-other-skills-title">{title}</span>
      {skills.map((skill) => skill.name).join(", ")}
    </p>
  );
}

// Lays out a design's project cards by how many there are: one is a full-width
// feature, two share a row, three or more scroll sideways with arrow buttons.
// The cards keep the design's own look; only their arrangement changes.
export function ProjectLayout({ count, className = "", children }) {
  const rail = useRef(null);
  const layout = projectLayout(count);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const element = rail.current;
    if (!element) return;
    setEdges({
      start: element.scrollLeft <= 4,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 4
    });
  }, []);

  useEffect(() => {
    if (layout !== "rail") return undefined;
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(rail.current);
    return () => resize.disconnect();
  }, [layout, measure, count]);

  const scroll = (direction) => {
    const element = rail.current;
    element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="pf-projects-wrap" data-layout={layout}>
      {layout === "rail" && (
        <div className="pf-rail-controls">
          <span className="pf-rail-count">{count} projects</span>
          <button type="button" onClick={() => scroll(-1)} disabled={edges.start} aria-label="Previous projects">
            <i className="bi bi-arrow-left" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scroll(1)} disabled={edges.end} aria-label="More projects">
            <i className="bi bi-arrow-right" aria-hidden="true" />
          </button>
        </div>
      )}
      <div
        ref={rail}
        className={`${className} pf-projects`.trim()}
        data-layout={layout}
        onScroll={layout === "rail" ? measure : undefined}
        tabIndex={layout === "rail" ? 0 : undefined}
        aria-label={layout === "rail" ? "Projects, scroll sideways for more" : undefined}
      >
        {children}
      </div>
    </div>
  );
}

// One contact link, opening web links in a new tab
export function ContactLink({ link, className = "", iconOnly = false }) {
  return (
    <a
      href={link.href}
      className={className}
      target={isExternal(link.href) ? "_blank" : undefined}
      rel={isExternal(link.href) ? "noreferrer" : undefined}
      title={link.label}
      aria-label={iconOnly ? link.short : undefined}
    >
      <i className={`bi ${link.icon}`} aria-hidden="true" />
      {!iconOnly && <span>{link.label}</span>}
    </a>
  );
}

const EXTRA_TITLES = {
  volunteering: "Volunteering",
  publications: "Publications",
  patents: "Patents",
  interests: "Interests"
};

// Volunteering, publications, patents and interests: only the ones that have items
export function ExtraSections({ data, heading }) {
  const filled = EXTRA_SECTIONS.filter((key) => data[key]?.length);

  return filled.map((key) => (
    <div key={key} className="pf-extra">
      {heading(EXTRA_TITLES[key])}
      <ul className="pf-extra-list">
        {data[key].map((item) => (
          <li key={item.id} className="pf-extra-item">
            <span className="pf-extra-title">{item.title}</span>
            {(item.subtitle || item.cause) && (
              <span className="pf-extra-sub">{[item.subtitle, item.cause].filter(Boolean).join(" · ")}</span>
            )}
            {(item.date || item.start) && (
              <span className="pf-extra-date">{item.start ? rangeText(item) : dateText(item.date)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  ));
}
