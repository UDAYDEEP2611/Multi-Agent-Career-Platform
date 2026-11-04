import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "react-bootstrap";

import ProjectLinkButtons from "./ProjectLinkButtons";
import { formatProjectDates } from "./projectOptions";
import { projectStatusColors } from "../Experience/projectStatus";
import VisibilityToggles from "../Common/VisibilityToggles";

// Generic cover per project type: a gradient with a large icon
const covers = {
  Personal: { icon: "bi-person-workspace", from: "#4f7cff", to: "#7c5cff" },
  Academic: { icon: "bi-mortarboard", from: "#0ea5a4", to: "#2563eb" },
  Professional: { icon: "bi-briefcase", from: "#334155", to: "#2563eb" },
  "Open Source": { icon: "bi-github", from: "#16a34a", to: "#0d9488" },
  Research: { icon: "bi-lightbulb", from: "#f59e0b", to: "#ef4444" }
};

const PROJECT_CARD_HEIGHT = 440;
const COVER_HEIGHT = 130;

// Fixed-size project card. A description that doesn't fit gets
// "Show more", which scrolls it inside the card so every card stays the
// same size.
export default function ProjectCard({ project, onEdit, onDelete }) {
  const descriptionRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const element = descriptionRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      // Only measured while collapsed, when the text is clipped
      if (!element.dataset.expanded) {
        setOverflowing(element.scrollHeight > element.clientHeight + 1);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [project.description]);

  const cover = covers[project.projectType] || covers.Personal;
  const detailsUrl = `/dashboard/projects/${project._id}`;
  const dates = formatProjectDates(project);

  return (
    <Card
      className={`shadow-sm overflow-hidden ${
        project.featured ? "border-warning" : "border-0"
      }`}
      style={{ height: PROJECT_CARD_HEIGHT }}
    >
      <Link
        to={detailsUrl}
        className="position-relative d-flex align-items-center justify-content-center text-white text-decoration-none flex-shrink-0"
        style={{
          height: COVER_HEIGHT,
          background: `linear-gradient(135deg, ${cover.from}, ${cover.to})`
        }}
        aria-label={`Open ${project.title}`}
      >
        <i
          className={`bi ${cover.icon} position-absolute`}
          style={{ fontSize: 120, opacity: 0.15, right: -10, bottom: -30 }}
          aria-hidden="true"
        />
        <i className={`bi ${cover.icon}`} style={{ fontSize: 44 }} aria-hidden="true" />

        {project.featured && (
          <span className="badge rounded-pill text-bg-warning position-absolute top-0 start-0 m-2">
            <i className="bi bi-star-fill me-1" />
            Featured
          </span>
        )}

        {project.visibility === "Private" && (
          <span className="badge rounded-pill text-bg-dark position-absolute bottom-0 start-0 m-2 fw-normal">
            <i className="bi bi-lock-fill me-1" />
            Private
          </span>
        )}
      </Link>

      <div className="btn-group btn-group-sm position-absolute top-0 end-0 m-2 shadow-sm">
        <Button variant="light" title="Edit" onClick={() => onEdit(project)}>
          <i className="bi bi-pencil" />
        </Button>
        <Button variant="light" className="text-danger" title="Delete" onClick={() => onDelete(project)}>
          <i className="bi bi-trash" />
        </Button>
      </div>

      <Card.Body className="d-flex flex-column p-3" style={{ minHeight: 0 }}>
        <div className="d-flex gap-1 mb-2 overflow-hidden flex-shrink-0">
          <span className="badge rounded-pill text-bg-light border fw-normal text-nowrap">
            {project.projectType}
          </span>
          <span
            className={`badge rounded-pill fw-normal text-nowrap ${
              projectStatusColors[project.status] || "text-bg-secondary"
            }`}
          >
            {project.status}
          </span>
        </div>
        <VisibilityToggles section="projects" item={project} className="mb-2 flex-shrink-0" />

        <Link to={detailsUrl} className="text-decoration-none text-body flex-shrink-0">
          <h5 className="fw-semibold mb-0 text-truncate" title={project.title}>
            {project.title}
          </h5>
        </Link>

        <div className="small text-secondary text-truncate flex-shrink-0">
          {[project.role, dates].filter(Boolean).join(" · ") || " "}
        </div>

        <p
          ref={descriptionRef}
          data-expanded={expanded || undefined}
          className={`small mt-2 mb-0 ${project.description ? "" : "text-secondary"}`}
          style={{
            whiteSpace: "pre-line",
            flex: "1 1 0",
            minHeight: 0,
            ...(expanded
              ? { overflowY: "auto" }
              : {
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical"
                })
          }}
        >
          {project.description || "No description added."}
        </p>

        {(overflowing || expanded) && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 align-self-start text-decoration-none flex-shrink-0"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        <div
          className="d-flex justify-content-between align-items-center gap-2 pt-2 mt-2 border-top flex-shrink-0 overflow-hidden"
          style={{ minHeight: 44 }}
        >
          <ProjectLinkButtons project={project} />
          <Link to={detailsUrl} className="small text-decoration-none text-nowrap ms-auto">
            Details <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </Card.Body>
    </Card>
  );
}
