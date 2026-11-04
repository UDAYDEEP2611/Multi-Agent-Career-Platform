// Field checks shared by Experience and Education projects
const statuses = [
  "Planned",
  "In Progress",
  "Completed",
  "On Hold"
];

const fields = [
  "title",
  "description",
  "startMonth",
  "startYear",
  "endMonth",
  "endYear",
  "status"
];

function pick(body = {}) {
  const result = {};

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
}

function validate(data) {
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.length > 200
  ) {
    return "Project title is required (maximum 200 characters)";
  }

  if (
    typeof data.description !== "string" ||
    data.description.length > 10000
  ) {
    return "Invalid project description";
  }

  if (!statuses.includes(data.status)) {
    return "Invalid project status";
  }

  for (const field of ["startMonth", "endMonth"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) ||
        data[field] < 1 ||
        data[field] > 12)
    ) {
      return `Invalid ${field}`;
    }
  }

  for (const field of ["startYear", "endYear"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) ||
        data[field] < 1900 ||
        data[field] > 2100)
    ) {
      return `Invalid ${field}`;
    }
  }

  if (data.startMonth !== null && data.startYear === null) {
    return "Start year is required when start month is selected";
  }

  if (data.endMonth !== null && data.endYear === null) {
    return "End year is required when end month is selected";
  }

  if (data.startYear !== null && data.endYear !== null) {
    const start = data.startYear * 12 + (data.startMonth || 1);
    const end = data.endYear * 12 + (data.endMonth || 12);

    if (end < start) {
      return "End date cannot be earlier than start date";
    }
  }

  return null;
}

const shortMonths = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const formatMonthYear = (month, year) =>
  `${month ? shortMonths[month - 1] + " " : ""}${year}`;

// A date given as year (+ optional month) covers a range of months
const monthRange = (year, month) => ({
  first: year * 12 + (month || 1),
  last: year * 12 + (month || 12)
});

// Project dates are optional, but any date given must not be in the
// future and must fall within the parent's dates.
// parent: { startYear, startMonth, endYear, endMonth, ongoing }
// label: what the parent is called in messages, e.g. "job"
function validateWithinParent(data, parent, label) {
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth() + 1;

  const parentStart = parent.startYear
    ? monthRange(parent.startYear, parent.startMonth).first
    : -Infinity;
  const parentEnd = parent.ongoing || !parent.endYear
    ? Infinity
    : monthRange(parent.endYear, parent.endMonth).last;

  const parentRange = `${
    parent.startYear ? formatMonthYear(parent.startMonth, parent.startYear) : "…"
  } – ${
    parent.ongoing || !parent.endYear
      ? "Present"
      : formatMonthYear(parent.endMonth, parent.endYear)
  }`;

  for (const [which, year, month] of [
    ["Start", data.startYear, data.startMonth],
    ["End", data.endYear, data.endMonth]
  ]) {
    if (year === null) continue;

    const range = monthRange(year, month);

    if (range.first > currentMonth) {
      return `${which} date can't be in the future`;
    }

    if (range.last < parentStart || range.first > parentEnd) {
      return `${which} date must be within this ${label}'s dates (${parentRange})`;
    }
  }

  return null;
}

module.exports = {
  pick,
  validate,
  validateWithinParent
};
