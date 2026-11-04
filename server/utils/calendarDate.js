// Calendar dates stored as "YYYY-MM-DD" strings (no time zone shifts)

// A real date from 1900 on that isn't after today (server's calendar, plus
// a day of slack for users ahead in time zones)
function validPastDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1900 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  return date.getTime() <= Date.now() + 24 * 60 * 60 * 1000;
}

// Trims, collapses spaces and drops repeats (ignoring case) from a list of
// people's names. Returns { names } or { error }.
function cleanNames(list, { max, label }) {
  if (!Array.isArray(list) || list.length > max) {
    return { error: `You can add up to ${max} other ${label}s` };
  }

  const seen = new Set();
  const names = [];

  for (const item of list) {
    if (typeof item !== "string" || !item.trim() || item.trim().length > 100) {
      return { error: `Each ${label} name must be 1–100 characters` };
    }

    const name = item.trim().replace(/\s+/g, " ");

    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      names.push(name);
    }
  }

  return { names };
}

module.exports = { validPastDate, cleanNames };
