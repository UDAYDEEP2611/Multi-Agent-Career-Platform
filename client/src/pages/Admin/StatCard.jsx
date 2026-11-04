import { Card } from "react-bootstrap";
import { Link } from "react-router-dom";

// One number on the admin pages, optionally linking to its page
export default function StatCard({ icon, label, value, hint, to, color = "primary" }) {
  const body = (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="d-flex gap-3 align-items-center">
        <div
          className={`rounded-3 bg-${color}-subtle text-${color}-emphasis d-flex align-items-center justify-content-center flex-shrink-0`}
          style={{ width: 44, height: 44 }}
        >
          <i className={`bi ${icon} fs-5`} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="small text-secondary">{label}</div>
          <div className="fs-4 fw-bold lh-sm">{value}</div>
          {hint && <div className="small text-secondary text-truncate">{hint}</div>}
        </div>
      </Card.Body>
    </Card>
  );

  return to ? (
    <Link to={to} className="text-reset text-decoration-none">{body}</Link>
  ) : (
    body
  );
}
