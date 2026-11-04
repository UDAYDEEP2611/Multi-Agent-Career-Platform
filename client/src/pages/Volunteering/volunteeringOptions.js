import { formatMonthYear } from "../Projects/projectOptions";

// Mirrors server/models/Volunteering.js
export const CAUSES = [
  "Animal Welfare",
  "Arts and Culture",
  "Children",
  "Civil Rights and Social Action",
  "Disaster and Humanitarian Relief",
  "Economic Empowerment",
  "Education",
  "Environment",
  "Health",
  "Human Rights",
  "Politics",
  "Poverty Alleviation",
  "Science and Technology",
  "Social Services",
  "Veteran Support"
];

export const VOLUNTEERING_LIMITS = {
  organization: 200,
  role: 200,
  description: 2000,
  media: 50
};

// "1 yr 3 mos", counting both the start and end month
function formatDuration(item) {
  if (!item.startYear || !item.startMonth) return "";

  const now = new Date();
  const [endYear, endMonth] = item.currentlyVolunteering
    ? [now.getFullYear(), now.getMonth() + 1]
    : [item.endYear, item.endMonth];

  if (!endYear || !endMonth) return "";

  const total = endYear * 12 + endMonth - (item.startYear * 12 + item.startMonth) + 1;
  if (total < 1) return "";

  const years = Math.floor(total / 12);
  const months = total % 12;

  return [
    years && `${years} yr${years > 1 ? "s" : ""}`,
    months && `${months} mo${months > 1 ? "s" : ""}`
  ]
    .filter(Boolean)
    .join(" ");
}

// "Jun 2022 – Present · 2 yrs 5 mos", or "" when no dates
export function formatVolunteeringDates(item) {
  const start = formatMonthYear(item.startMonth, item.startYear);
  const end = item.currentlyVolunteering
    ? "Present"
    : formatMonthYear(item.endMonth, item.endYear);

  if (!start && !end) return "";

  return [`${start || "…"} – ${end || "…"}`, formatDuration(item)]
    .filter(Boolean)
    .join(" · ");
}
