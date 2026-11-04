// Choices for the Recommendations page (the server accepts any text)
export const RELATIONSHIPS = {
  Work: ["Manager", "Senior colleague", "Colleague", "Direct report", "Client"],
  Education: ["Professor / Teacher", "Academic advisor", "Classmate"],
  Mentoring: ["Mentor", "Mentee"]
};

export const RECOMMENDATION_LIMITS = {
  text: 3000
};

// "Engineer at Example Co" / "Degree · Institution", keyed by record ID
export function contextLabels(experiences, educations) {
  const labels = {};

  for (const item of experiences) {
    labels[item._id] = `${item.jobTitle} at ${item.organization}`;
  }

  for (const item of educations) {
    labels[item._id] = [item.degree, item.institution].filter(Boolean).join(" · ");
  }

  return labels;
}

export const fullName = (item) => [item.firstName, item.lastName].filter(Boolean).join(" ");

export const initials = (item) =>
  [item.firstName, item.lastName]
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join("");
