import { Badge, Card, ListGroup } from "react-bootstrap";

const scoreColor = (score) => (score >= 85 ? "success" : score >= 65 ? "warning" : "danger");

// The rule-based ATS review that comes back with each resume
// 1 page is ideal; 2 is fine for experienced or technical resumes; never
// more than 2. Don't shrink text to fit: cut repeats and older items.
function lengthAdvice(pages, years) {
  if (pages === 1) return { ok: true, text: "1 page on US Letter" };
  if (pages === 2) {
    return {
      ok: true,
      text: years >= 5
        ? "2 pages on US Letter; fine for your experience. Keep the strongest work on page 1."
        : "2 pages on US Letter; fine for technical resumes. Keep the strongest work on page 1."
    };
  }
  return {
    ok: false,
    text: `${pages} pages; keep it to 2 at most. Shorten the summary, remove repeated skills and older items. Don't shrink the text.`
  };
}

export default function AtsReport({ review, notes, aiUsed, model, agents, addedSkills = [], criticalSkills = [], onRemoveSkill, wovenKeywords = [], onUndoWoven, pages = 1, yearsOfExperience = 0 }) {
  const color = scoreColor(review.score);
  const length = lengthAdvice(pages, yearsOfExperience);

  return (
    <Card className="shadow-sm resume-no-print">
      <Card.Body>
        <div className="d-flex align-items-center gap-3 mb-3">
          <div className={`resume-score border-${color} text-${color}`}>{review.score}</div>
          <div>
            <div className="fw-semibold">ATS readability</div>
            <div className="small text-muted">
              {aiUsed ? `Content improved with ${model}` : "Your own wording, tidied"}
            </div>
          </div>
        </div>

        {agents && (
          <div className="small text-muted border rounded px-2 py-1 mb-3">
            <div><i className="bi bi-diagram-3 me-1" aria-hidden="true" />Reviewed by: {agents.reviewedBy}</div>
            <div><i className="bi bi-plug me-1" aria-hidden="true" />MCP tools used: {agents.mcpTools.join(", ")}</div>
          </div>
        )}

        <div className={`small mb-3 ${length.ok ? "text-success" : "text-danger"}`}>
          <i className={`bi ${length.ok ? "bi-file-earmark-check" : "bi-file-earmark-excel"} me-1`} aria-hidden="true" />
          <strong>Length:</strong> {length.text}
        </div>

        {review.keywordCoverage !== null && (
          <div className="mb-3">
            <div className="d-flex justify-content-between small mb-1">
              <span>Job keyword match</span>
              <strong>{review.keywordCoverage}%</strong>
            </div>
            <div className="progress" style={{ height: 6 }}>
              <div
                className={`progress-bar bg-${scoreColor(review.keywordCoverage)}`}
                style={{ width: `${review.keywordCoverage}%` }}
              />
            </div>

            {review.matchedKeywords.length > 0 && (
              <div className="d-flex flex-wrap gap-1 mt-2">
                {review.matchedKeywords.map((keyword) => (
                  <Badge key={keyword} bg="success-subtle" text="success" className="fw-normal">
                    <i className="bi bi-check2 me-1" aria-hidden="true" />{keyword}
                  </Badge>
                ))}
              </div>
            )}

            {review.missingKeywords.length > 0 && (
              <>
                <div className="small text-muted mt-2">
                  Missing from your resume. Add them to your portfolio only if you really have them:
                </div>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {review.missingKeywords.map((keyword) => (
                    <Badge key={keyword} bg="secondary-subtle" text="secondary" className="fw-normal">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {review.areas?.length > 0 && (
          <div className="mb-3">
            <div className="small fw-semibold mb-1">
              Technical areas your bullets show ({review.areas.filter((item) => item.shown).length}/{review.areas.length})
            </div>
            <div className="d-flex flex-wrap gap-1">
              {review.areas.map(({ area, shown }) => (
                <Badge
                  key={area}
                  bg={shown ? "success-subtle" : "secondary-subtle"}
                  text={shown ? "success" : "secondary"}
                  className="fw-normal"
                >
                  <i className={`bi ${shown ? "bi-check2" : "bi-dash"} me-1`} aria-hidden="true" />{area}
                </Badge>
              ))}
            </div>
            {review.areas.some((item) => !item.shown) && (
              <div className="small text-muted mt-1">
                Grey areas aren't in any bullet yet. Add them to your portfolio only if you did that work.
              </div>
            )}
          </div>
        )}

        {wovenKeywords.length > 0 && (
          <div className="border rounded px-2 py-2 small mb-3">
            <div className="fw-semibold mb-1">
              <i className="bi bi-magic me-1" aria-hidden="true" />Keywords worked into your bullets
            </div>
            {wovenKeywords.map((change) => (
              <div key={`${change.listKey}-${change.id}-${change.index}`} className="d-flex gap-2 align-items-start py-1 border-top">
                <div className="flex-grow-1">
                  <div className="text-muted">{change.title}</div>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {change.keywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        bg={change.fromJob.includes(keyword) ? "warning-subtle" : "success-subtle"}
                        text={change.fromJob.includes(keyword) ? "warning-emphasis" : "success"}
                        className="fw-normal"
                      >
                        {keyword}{change.fromJob.includes(keyword) ? " (from the job)" : change.byUser ? " (you added)" : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onUndoWoven(change)}>
                  Undo
                </button>
              </div>
            ))}
            {wovenKeywords.some((change) => change.fromJob.length) && (
              <div className="text-warning-emphasis mt-1">
                Keywords marked "from the job" aren't in your portfolio. Undo any you haven't used; interviewers will ask about them.
              </div>
            )}
          </div>
        )}

        {addedSkills.length > 0 && (
          <div className="alert alert-warning py-2 px-3 small mb-3">
            <div className="fw-semibold mb-1">
              <i className="bi bi-plus-circle me-1" aria-hidden="true" />Added to your Skills from the job
            </div>
            <div className="mb-2">
              Remove any you haven't used; interviewers will ask about them.
              {criticalSkills.length > 0 && <> <strong>Core</strong> marks tools this job centers on.</>}
            </div>
            <div className="d-flex flex-wrap gap-1">
              {addedSkills.map((skill) => (
                <span key={skill} className="badge bg-white text-dark border fw-normal d-inline-flex align-items-center gap-1">
                  {skill}
                  {criticalSkills.includes(skill) && <span className="badge bg-danger fw-normal">Core</span>}
                  <button
                    type="button"
                    className="btn-close"
                    style={{ fontSize: 8 }}
                    aria-label={`Remove ${skill}`}
                    onClick={() => onRemoveSkill(skill)}
                  />
                </span>
              ))}
            </div>
          </div>
        )}

        {review.issues.length === 0 ? (
          <p className="small text-success mb-0">
            <i className="bi bi-check-circle me-1" aria-hidden="true" />No problems found.
          </p>
        ) : (
          <>
            <div className="small fw-semibold mb-1">Things to fix ({review.issues.length})</div>
            <ListGroup variant="flush" className="small resume-issues">
              {review.issues.map((issue, index) => (
                <ListGroup.Item key={index} className="px-0 d-flex gap-2">
                  <i
                    className={`bi ${issue.level === "error" ? "bi-x-circle text-danger" : "bi-exclamation-triangle text-warning"}`}
                    aria-hidden="true"
                  />
                  <span><strong>{issue.section}:</strong> {issue.message}</span>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </>
        )}

        {notes.length > 0 && (
          <ul className="small text-muted mt-3 mb-0 ps-3">
            {notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}
