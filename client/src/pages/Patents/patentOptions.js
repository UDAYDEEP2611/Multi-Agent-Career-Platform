// Mirrors server/controllers/patentController.js
export const PATENT_LIMITS = {
  title: 255,
  patentNumber: 60,
  description: 2000,
  coInventors: 20
};

// The date means the issue date once issued, the filing date while pending
export const dateLabel = (status) => (status === "Pending" ? "Filing date" : "Issue date");
