export const formatBytes = (bytes = 0) =>
  bytes < 1024 ? `${bytes} B`
    : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB`
      : bytes < 1024 ** 3 ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${(bytes / 1024 ** 3).toFixed(2)} GB`;

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Never";

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
      })
    : "—";

// "3d 4h", "2h 15m", "45s"
export function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${seconds}s`;
}

// "in 23 hours" / "5 minutes ago"
export function formatRelative(value) {
  if (!value) return "—";

  const diff = new Date(value).getTime() - Date.now();
  const units = [["day", 86400000], ["hour", 3600000], ["minute", 60000]];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }

  return formatter.format(Math.round(diff / 1000), "second");
}
