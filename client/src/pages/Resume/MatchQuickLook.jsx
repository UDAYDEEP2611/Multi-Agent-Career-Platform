import { Badge, ListGroup, Modal, ProgressBar } from "react-bootstrap";
import { missingItems, scoreColor } from "./matchHelpers";

// A short summary of a comparison: scores, what's missing, top fixes
export default function MatchQuickLook({ show, onHide, result, title }) {
  if (!result?.match?.categories) return null;
  const { match, ats } = result;
  const missing = missingItems(result);
  const top = result.recommendations.filter((item) => item.priority <= 2).slice(0, 5);
  const field = (name) => match.profile.find((item) => item.field === name)?.value;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h5"><i className="bi bi-eye me-2" aria-hidden="true" />Quick look{title ? `: ${title}` : ""}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex flex-wrap gap-4 align-items-center mb-3">
          <div className="text-center">
            <div className={`resume-score mx-auto border-${scoreColor(match.overall)} text-${scoreColor(match.overall)}`}>{match.overall}%</div>
            <div className="small fw-semibold mt-1">Semantic fit</div>
            <Badge bg={scoreColor(match.overall)}>{match.classification}</Badge>
          </div>
          <div className="text-center">
            <div className={`resume-score mx-auto border-${scoreColor(ats.score)} text-${scoreColor(ats.score)}`}>{ats.score}</div>
            <div className="small fw-semibold mt-1">ATS check</div>
          </div>
          <div className="small">
            <div><strong>{field("Name") || "No name found"}</strong></div>
            <div className="text-muted">{field("Role") || "No role found"}</div>
            <div className="text-muted">{field("Experience") || "No jobs found"} · {match.years.professional} years professional</div>
            <div className="fw-semibold mt-1">{match.recommendation}</div>
          </div>
        </div>
        {[match.header.company, match.header.role, match.header.location].some(Boolean) && (
          <div className="small text-muted mb-2">{[match.header.company, match.header.role, match.header.location, match.header.seniority].filter(Boolean).join(" • ")}</div>
        )}

        {Object.values(match.categories).map((category) => category.score !== null && (
          <div key={category.key} className="mb-2">
            <div className="d-flex justify-content-between small"><span>{category.label} <span className="text-muted">({Math.round(category.weight * 100)}%)</span></span><strong>{Math.round(category.score)}%</strong></div>
            <ProgressBar now={category.score} variant={scoreColor(category.score)} style={{ height: 6 }} />
          </div>
        ))}
        {match.eligibility.some((item) => item.status !== "Met") && (
          <div className="small mt-2">
            <span className="fw-semibold">Eligibility: </span>
            {match.eligibility.filter((item) => item.status !== "Met").map((item) => `${item.condition} (${item.status})`).join(", ")}
          </div>
        )}

        <div className="small fw-semibold mt-3 mb-1">What's missing</div>
        {missing.length ? (
          <div className="d-flex flex-wrap gap-1">
            {missing.map((text) => <Badge key={text} bg="danger-subtle" text="danger" className="fw-normal text-wrap text-start">{text}</Badge>)}
          </div>
        ) : <div className="small text-success">Nothing the job requires is missing.</div>}

        {top.length > 0 && (
          <>
            <div className="small fw-semibold mt-3 mb-1">Fix these first</div>
            <ListGroup variant="flush" className="small">
              {top.map((item, index) => (
                <ListGroup.Item key={index} className="px-0">
                  <div className="fw-semibold">{item.issue}</div>
                  <div className="text-muted"><i className="bi bi-lightbulb me-1" aria-hidden="true" />{item.recommendation}</div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
