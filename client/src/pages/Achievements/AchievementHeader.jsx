import { formatMonthYear } from "../Projects/projectOptions";
import { CATEGORY_STYLES } from "./achievementOptions";

// Category icon, title, issuer, date, result and "associated with".
// Shared by the list and the details page; children replaces the title.
export default function AchievementHeader({ item, contextLabel, titleAs: Title = "h5", children }) {
  const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.Other;
  const date = formatMonthYear(item.month, item.year);

  return (
    <div className="d-flex gap-3">
      <div
        className={`rounded-3 bg-${style.color}-subtle text-${style.color}-emphasis d-flex align-items-center justify-content-center flex-shrink-0`}
        style={{ width: 52, height: 52 }}
      >
        <i className={`bi ${style.icon} fs-4`} />
      </div>

      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="d-flex align-items-center flex-wrap gap-1">
          <Title className="fw-bold mb-0 text-break me-1">{children || item.title}</Title>
          {item.featured && <i className="bi bi-star-fill text-warning" title="Featured" />}
        </div>

        <div className="small text-secondary">
          {[item.issuer, date].filter(Boolean).join(" · ")}
        </div>

        {contextLabel && (
          <div className="small text-secondary">Associated with {contextLabel}</div>
        )}

        <div className="d-flex flex-wrap gap-1 mt-1">
          <span className="badge rounded-pill text-bg-light border fw-normal">{item.category}</span>
          {item.result && (
            <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-medium">
              {item.result}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="badge rounded-pill text-bg-light border fw-normal text-decoration-none"
            >
              <i className="bi bi-link-45deg me-1" />
              Link
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
