// Distinct colours for ring segments and their legend swatches
export const SEGMENT_COLORS = [
  "#4f7cff", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6",
  "#0ea5a4", "#ec4899", "#64748b", "#84cc16", "#f97316"
];

export const colorAt = (index) => SEGMENT_COLORS[index % SEGMENT_COLORS.length];

// Green under 70% of the limit, yellow under 90%, red above
export const levelColor = (ratio) =>
  ratio >= 0.9 ? "danger" : ratio >= 0.7 ? "warning" : "success";

// The biggest items as their own segments, the rest grouped as "Other"
export function topSegments(items, count = 6) {
  const top = items.slice(0, count).map((item, index) => ({
    label: item.label,
    bytes: item.bytes,
    color: colorAt(index)
  }));
  const rest = items.slice(count).reduce((sum, item) => sum + item.bytes, 0);

  return rest > 0 ? [...top, { label: "Other", bytes: rest, color: "#94a3b8" }] : top;
}
