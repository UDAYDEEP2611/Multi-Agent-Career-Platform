import { formatVolunteeringDates } from "./volunteeringOptions";

// Icon, role, organization, dates and cause. Shared by the list and the
// details page; children replaces the role (e.g. with a link).
export default function VolunteeringHeader({ item, roleAs: Role = "h5", children }) {
  const dates = formatVolunteeringDates(item);

  return (
    <div className="d-flex gap-3">
      <div
        className="rounded-3 bg-danger-subtle text-danger d-flex align-items-center justify-content-center flex-shrink-0"
        style={{ width: 52, height: 52 }}
      >
        <i className="bi bi-heart-fill fs-4" />
      </div>

      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <Role className="fw-bold mb-0 text-break">{children || item.role}</Role>
        <div className="text-break">{item.organization}</div>
        {dates && <div className="small text-secondary">{dates}</div>}

        {(item.cause || item.currentlyVolunteering) && (
          <div className="d-flex flex-wrap gap-1 mt-1">
            {item.currentlyVolunteering && (
              <span className="badge rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle fw-normal">
                Current
              </span>
            )}
            {item.cause && (
              <span className="badge rounded-pill text-bg-light border fw-normal">
                {item.cause}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
