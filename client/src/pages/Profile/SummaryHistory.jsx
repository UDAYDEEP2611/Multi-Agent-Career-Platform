import { useState } from "react";
import { Badge, Button, Card } from "react-bootstrap";

const SHOWN = 3;

const when = (date) =>
  new Date(date).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });

// Earlier versions of the summary, newest first, each one restorable
export default function SummaryHistory({ history, busy, onRestore, onDelete }) {
  const [showAll, setShowAll] = useState(false);
  if (!history?.length) return null;

  const shown = showAll ? history : history.slice(0, SHOWN);

  return (
    <Card className="border-0 shadow-sm mt-4">
      <Card.Header className="bg-body border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2 px-4 py-3">
        <h5 className="fw-semibold mb-0">
          <i className="bi bi-clock-history me-2 text-primary" aria-hidden="true" />
          Previous versions
        </h5>
        <span className="small text-secondary">
          {history.length} saved · restoring one keeps your current summary here too
        </span>
      </Card.Header>

      <Card.Body className="p-0">
        <ul className="list-group list-group-flush">
          {shown.map((entry) => (
            <li key={entry._id} className="list-group-item px-4 py-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <div className="small text-secondary">
                  {entry.origin && <Badge bg="secondary" className="me-2 fw-normal">{entry.origin}</Badge>}
                  Replaced {when(entry.savedAt)}
                </div>
                <div className="btn-group btn-group-sm">
                  <Button variant="outline-primary" disabled={busy} onClick={() => onRestore(entry)}>
                    <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />Restore
                  </Button>
                  <Button variant="outline-danger" disabled={busy} onClick={() => onDelete(entry)} title="Remove this version" aria-label="Remove this version">
                    <i className="bi bi-trash" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <p className="mb-0 small lh-lg" style={{ whiteSpace: "pre-wrap" }}>{entry.content}</p>
            </li>
          ))}
        </ul>
      </Card.Body>

      {history.length > SHOWN && (
        <Card.Footer className="bg-body text-center py-2">
          <Button variant="link" size="sm" onClick={() => setShowAll((open) => !open)}>
            {showAll ? "Show fewer" : `Show all ${history.length} versions`}
          </Button>
        </Card.Footer>
      )}
    </Card>
  );
}
