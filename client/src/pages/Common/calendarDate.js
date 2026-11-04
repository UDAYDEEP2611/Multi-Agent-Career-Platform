// Calendar dates stored as "YYYY-MM-DD" (no time zone)

// "Feb 29, 2024" from "2024-02-29"
export function formatCalendarDate(value) {
  if (!value) return "";

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

// Today as "YYYY-MM-DD" in the user's time zone, for a date picker's max
export function todayValue() {
  const now = new Date();
  const pad = (number) => String(number).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
