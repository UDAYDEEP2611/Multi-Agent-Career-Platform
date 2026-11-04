import { Badge, Card } from "react-bootstrap";

import { actionStyle } from "./activityLabels";
import { deviceName } from "./deviceName";

const dayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
};

const time = (value) =>
  new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// Entries grouped by day, newest first. showDevice: for sign-in entries.
export default function ActivityTimeline({ entries, showDevice = false, empty }) {
  if (entries.length === 0) {
    return <p className="text-secondary text-center py-4 mb-0">{empty}</p>;
  }

  const days = [];
  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(entry);
    else days.push({ label, items: [entry] });
  }

  return days.map((day) => (
    <div key={day.label} className="mb-4">
      <div className="small fw-semibold text-secondary text-uppercase mb-2" style={{ letterSpacing: 1 }}>
        {day.label}
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {day.items.map((entry, index) => {
            const style = actionStyle(entry.kind, entry.action);

            return (
              <div key={entry._id} className={`d-flex gap-3 align-items-start p-3 ${index ? "border-top" : ""}`}>
                <div
                  className={`rounded-circle bg-${style.color}-subtle text-${style.color}-emphasis d-flex align-items-center justify-content-center flex-shrink-0`}
                  style={{ width: 34, height: 34 }}
                >
                  <i className={`bi ${style.icon}`} />
                </div>

                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="fw-medium">{style.label}</span>
                    {entry.section && (
                      <Badge bg="light" text="dark" className="border fw-normal">{entry.section}</Badge>
                    )}
                  </div>

                  {entry.label && <div className="small text-break">{entry.label}</div>}

                  {showDevice && (entry.userAgent || entry.ip) && (
                    <div className="small text-secondary">
                      <i className="bi bi-laptop me-1" />
                      {deviceName(entry.userAgent)}
                      {entry.ip && ` · ${entry.ip}`}
                    </div>
                  )}
                </div>

                <span className="small text-secondary text-nowrap">{time(entry.createdAt)}</span>
              </div>
            );
          })}
        </Card.Body>
      </Card>
    </div>
  ));
}
