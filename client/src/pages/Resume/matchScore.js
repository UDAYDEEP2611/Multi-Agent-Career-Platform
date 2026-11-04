// The job-match overall score, the same formula as the server
// (services/match/matchModel.js): a weighted average of the category scores,
// leaving out categories the job doesn't ask about.
export function overallScore(categories, weights) {
  const active = categories.filter((category) => category.score !== null && (weights[category.id] ?? category.weight) > 0);
  const total = active.reduce((sum, category) => sum + (weights[category.id] ?? category.weight), 0);
  if (!total) return null;
  return Math.round(active.reduce((sum, category) => sum + category.score * (weights[category.id] ?? category.weight), 0) / total);
}

export const EVIDENCE_STYLE = {
  strong: { label: "Strong evidence", color: "success", icon: "bi-check-circle-fill" },
  demonstrated: { label: "Demonstrated", color: "primary", icon: "bi-check-circle" },
  partial: { label: "Listed only", color: "warning", icon: "bi-dash-circle" },
  missing: { label: "Not shown", color: "secondary", icon: "bi-circle" }
};
