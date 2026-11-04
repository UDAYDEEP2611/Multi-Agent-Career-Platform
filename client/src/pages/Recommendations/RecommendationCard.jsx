import { useEffect, useRef, useState } from "react";
import { Button, Card } from "react-bootstrap";

import { formatMonthYear } from "../Projects/projectOptions";
import { fullName, initials } from "./recommendationOptions";
import VisibilityToggles from "../Common/VisibilityToggles";

const TEXT_LINES = 5;

// One recommendation or reference: who, how they know you, their words
// (clamped with Show more) and contact details for references.
export default function RecommendationCard({ item, contextLabel, onEdit, onDelete }) {
  const textRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [item.text]);

  const name = fullName(item);
  const isReference = item.kind === "Reference";
  const role = [item.recommenderTitle, item.recommenderOrganization].filter(Boolean).join(" at ");
  const date = formatMonthYear(item.month, item.year);

  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="p-4 d-flex flex-column">
        <div className="d-flex gap-3 align-items-start">
          <div
            className="rounded-circle bg-primary-subtle text-primary-emphasis fw-semibold d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: 48, height: 48 }}
            aria-hidden="true"
          >
            {initials(item)}
          </div>

          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="d-flex align-items-center flex-wrap gap-1">
              <h6 className="fw-bold mb-0 text-break me-1">
                {item.profileUrl ? (
                  <a href={item.profileUrl} target="_blank" rel="noopener noreferrer" className="text-reset">
                    {name}
                    <i className="bi bi-box-arrow-up-right small ms-1 text-secondary" />
                  </a>
                ) : (
                  name
                )}
              </h6>
              {item.featured && (
                <i className="bi bi-star-fill text-warning" title="Featured" />
              )}
              {item.visibility === "Private" && (
                <span className="badge rounded-pill text-bg-light border fw-normal">
                  <i className="bi bi-lock-fill me-1" />
                  Private
                </span>
              )}
            </div>

            {role && <div className="small text-break">{role}</div>}
            <VisibilityToggles section="recommendations" item={item} className="my-1" />

            <div className="small text-secondary">
              {[item.relationship, contextLabel && `Worked together: ${contextLabel}`, date]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>

          <div className="d-flex gap-1 flex-shrink-0">
            <Button size="sm" variant="outline-secondary" onClick={() => onEdit(item)} aria-label={`Edit ${name}`} title="Edit">
              <i className="bi bi-pencil" />
            </Button>
            <Button size="sm" variant="outline-danger" onClick={() => onDelete(item)} aria-label={`Delete ${name}`} title="Delete">
              <i className="bi bi-trash" />
            </Button>
          </div>
        </div>

        {item.text && (
          <div className="mt-3 ps-3 border-start border-3 border-primary-subtle">
            <p
              ref={textRef}
              className="mb-0 fst-italic"
              style={{
                whiteSpace: "pre-line",
                ...(expanded
                  ? {}
                  : {
                      display: "-webkit-box",
                      WebkitLineClamp: TEXT_LINES,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    })
              }}
            >
              {isReference ? item.text : `“${item.text}”`}
            </p>

            {(overflowing || expanded) && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 mt-1 text-decoration-none"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {(item.email || item.phone) && (
          <div className="d-flex flex-wrap gap-3 small mt-3 pt-3 border-top">
            {item.email && (
              <a href={`mailto:${item.email}`} className="text-decoration-none text-break">
                <i className="bi bi-envelope me-1" />
                {item.email}
              </a>
            )}
            {item.phone && (
              <a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`} className="text-decoration-none">
                <i className="bi bi-telephone me-1" />
                {item.phone}
              </a>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
