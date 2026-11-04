import { Button } from "react-bootstrap";

// "Add" button with an "up to N" hint; disabled once the list is full.
// Without max it is a plain Add button.
export default function LimitedAddBar({ count, max, noun, label, onAdd }) {
  const full = max !== undefined && count >= max;

  return (
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      {max !== undefined ? (
        <span className={`small ${full ? "text-danger" : "text-secondary"}`}>
          <i className={`bi ${full ? "bi-exclamation-circle" : "bi-info-circle"} me-1`} />
          {full
            ? `Limit reached: you can add up to ${max} ${noun}.`
            : `You can add up to ${max} ${noun}, so add the most important ones.`}
          <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
            {count}/{max}
          </span>
        </span>
      ) : (
        <span />
      )}

      <Button size="sm" onClick={onAdd} disabled={full}>
        <i className="bi bi-plus-lg me-1" />
        {label}
      </Button>
    </div>
  );
}
