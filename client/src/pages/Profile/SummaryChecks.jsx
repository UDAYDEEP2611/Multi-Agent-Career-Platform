// The four things a summary needs (job title, experience level, key skills,
// an achievement) plus length, as small pass/fix chips
export default function SummaryChecks({ checks, compact = false }) {
  if (!checks?.length) return null;

  return (
    <ul className={`list-unstyled d-flex flex-wrap gap-2 mb-0 ${compact ? "small" : ""}`}>
      {checks.map((check) => (
        <li
          key={check.id}
          className={`badge rounded-pill fw-medium border ${check.ok
            ? "bg-success-subtle text-success-emphasis border-success-subtle"
            : "bg-warning-subtle text-warning-emphasis border-warning-subtle"}`}
          title={check.detail}
        >
          <i className={`bi ${check.ok ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"} me-1`} aria-hidden="true" />
          {check.label}
          <span className="visually-hidden">: {check.detail}</span>
        </li>
      ))}
    </ul>
  );
}

// "3 of 5 checks pass" with what to fix, for the current summary
export function SummaryCheckList({ checks }) {
  if (!checks?.length) return null;
  const passing = checks.filter((check) => check.ok).length;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
        <span className="fw-semibold small">
          Summary check · {passing} of {checks.length} pass
        </span>
        <SummaryChecks checks={checks} compact />
      </div>
      {passing < checks.length && (
        <ul className="small text-secondary mb-0 ps-3">
          {checks.filter((check) => !check.ok).map((check) => (
            <li key={check.id}><strong>{check.label}:</strong> {check.detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
