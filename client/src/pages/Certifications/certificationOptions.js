import { formatMonthYear } from "../Projects/projectOptions";

// Mirrors the server limits for certifications
export const CERTIFICATION_LIMITS = {
  name: 200,
  issuingOrganization: 200,
  credentialId: 80,
  media: 50
};

const toMonths = (year, month, fallback) => year * 12 + (month || fallback);

// Expired once the whole expiration month has passed
export function isExpired(certification) {
  if (!certification.expirationYear) return false;

  const now = new Date();
  const current = now.getFullYear() * 12 + now.getMonth() + 1;

  return toMonths(certification.expirationYear, certification.expirationMonth, 12) < current;
}

// "Issued Mar 2023 · Expires Mar 2026" (or "Expired ..."), "" when no dates
export function formatCertificationDates(certification) {
  const issued = formatMonthYear(certification.issueMonth, certification.issueYear);
  const expires = formatMonthYear(certification.expirationMonth, certification.expirationYear);

  return [
    issued && `Issued ${issued}`,
    expires && `${isExpired(certification) ? "Expired" : "Expires"} ${expires}`
  ]
    .filter(Boolean)
    .join(" · ");
}
