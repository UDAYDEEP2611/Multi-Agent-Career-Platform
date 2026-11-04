import { Badge, Button, Card, Form, Spinner } from "react-bootstrap";
import { EVIDENCE_STYLE, overallScore } from "./matchScore";

const barColor = (score) => (score >= 75 ? "success" : score >= 50 ? "warning" : "danger");

// How well the resume fits the job. Scores come from code checking the
// evidence for each requirement, never from the AI; weights are adjustable.
export default function JobMatchCard({ match, weights, onWeights, dirty, recalculating, onRecalculate }) {
  const overall = overallScore(match.categories, weights);
  // Critical requirements first, then required, then preferred
  const rank = { critical: 0, required: 1, preferred: 2 };
  const byCategory = (id) => match.requirements
    .filter((item) => item.category === id)
    .sort((a, b) => rank[a.importance] - rank[b.importance]);
  const criticalMissing = match.requirements.filter((item) => item.importance === "critical" && ["missing", "partial"].includes(item.level));

  return (
    <Card className="shadow-sm mb-3 resume-no-print">
      <Card.Body>
        <div className="d-flex align-items-center gap-3 mb-2">
          <div className={`resume-score border-${barColor(overall ?? 0)} text-${barColor(overall ?? 0)}`}>
            {overall ?? "–"}
          </div>
          <div>
            <div className="fw-semibold">Job match</div>
            <div className="small text-muted">From evidence in your resume, by category weight</div>
          </div>
        </div>

        <p className="small text-muted mb-3">
          Not a prediction of ATS or hiring results. Missing items aren't proof you lack a skill.
        </p>

        {dirty && (
          <Button size="sm" variant="outline-primary" className="w-100 mb-3" onClick={onRecalculate} disabled={recalculating}>
            {recalculating ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-arrow-repeat me-1" />}
            You edited the resume: recalculate the match
          </Button>
        )}

        <div className="small mb-3">
          {match.categories.map((category) => {
            const weight = weights[category.id] ?? category.weight;
            return (
              <div key={category.id} className="mb-2">
                <div className="d-flex justify-content-between">
                  <span>{category.label}</span>
                  <span className="text-muted">
                    {category.score === null ? "not asked" : `${category.score}%`}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className="progress flex-grow-1" style={{ height: 6 }}>
                    {category.score !== null && (
                      <div className={`progress-bar bg-${barColor(category.score)}`} style={{ width: `${category.score}%` }} />
                    )}
                  </div>
                  <Form.Range
                    min={0}
                    max={50}
                    step={5}
                    value={weight}
                    onChange={(e) => onWeights({ ...weights, [category.id]: Number(e.target.value) })}
                    style={{ width: 90 }}
                    aria-label={`${category.label} weight`}
                  />
                  <span className="text-muted" style={{ width: 34 }}>{weight}%</span>
                </div>
              </div>
            );
          })}
          <Button size="sm" variant="link" className="p-0" onClick={() => onWeights({})}>Reset weights</Button>
        </div>

        {criticalMissing.length > 0 && (
          <div className="alert alert-danger py-2 px-3 small mb-3">
            <div className="fw-semibold mb-1">This job centers on things your experience doesn't show</div>
            {criticalMissing.map((item) => item.text).join(", ")}
            <div className="text-muted mt-1">If you've used them, add a task to your portfolio that shows how.</div>
          </div>
        )}

        <div className="small mb-2">
          <i className="bi bi-calendar3 me-1" aria-hidden="true" />
          {match.years} years of experience counted from your job dates
        </div>

        <div className="d-flex flex-wrap gap-1 mb-2">
          {Object.entries(EVIDENCE_STYLE).map(([level, style]) => (
            <Badge key={level} bg={`${style.color}-subtle`} text={style.color} className="fw-normal">
              {style.label}: {match.counts[level]}
            </Badge>
          ))}
        </div>

        {match.categories.filter((category) => category.count).map((category) => (
          <details key={category.id} className="small mb-1">
            <summary className="fw-semibold">{category.label} ({category.count})</summary>
            <ul className="list-unstyled ms-2 mt-1 mb-2">
              {byCategory(category.id).map((item) => {
                const style = EVIDENCE_STYLE[item.level];
                return (
                  <li key={item.id || item.text} className="mb-1">
                    <i className={`bi ${style.icon} text-${style.color} me-1`} aria-hidden="true" />
                    {item.text}
                    {item.importance === "preferred" && <span className="text-muted"> (preferred)</span>}
                    {item.importance === "critical" && <span className="badge bg-danger fw-normal ms-1">Critical</span>}
                    <span className={`ms-1 text-${style.color}`}>· {style.label}</span>
                    {(item.where?.length > 0 || item.detail) && (
                      <div className="text-muted ms-3">{item.detail || item.where.join("; ")}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        ))}

        {match.notes?.length > 0 && <div className="small text-muted mt-2">{match.notes.join(" ")}</div>}
      </Card.Body>
    </Card>
  );
}
