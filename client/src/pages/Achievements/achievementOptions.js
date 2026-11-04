// Mirrors server/models/Achievement.js, with an icon and colour each
export const CATEGORY_STYLES = {
  Award: { icon: "bi-trophy-fill", color: "warning" },
  Honor: { icon: "bi-award-fill", color: "primary" },
  Scholarship: { icon: "bi-mortarboard-fill", color: "info" },
  Hackathon: { icon: "bi-code-slash", color: "success" },
  Competition: { icon: "bi-flag-fill", color: "danger" },
  "Talk / Presentation": { icon: "bi-mic-fill", color: "primary" },
  Leadership: { icon: "bi-people-fill", color: "success" },
  "Club / Society": { icon: "bi-person-hearts", color: "info" },
  Event: { icon: "bi-calendar-event-fill", color: "secondary" },
  Other: { icon: "bi-star-fill", color: "secondary" }
};

export const CATEGORIES = Object.keys(CATEGORY_STYLES);

export const ACHIEVEMENT_LIMITS = {
  title: 200,
  issuer: 200,
  result: 100,
  description: 2000,
  media: 50
};
