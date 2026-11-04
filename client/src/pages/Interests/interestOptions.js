// Mirrors server/models/Interest.js, with an icon each (list order = page order)
export const CATEGORY_ICONS = {
  Technology: "bi-cpu",
  "Science & Research": "bi-lightbulb",
  "Business & Finance": "bi-graph-up-arrow",
  "Sports & Fitness": "bi-bicycle",
  "Outdoors & Travel": "bi-globe-americas",
  "Arts & Music": "bi-music-note-beamed",
  "Reading & Writing": "bi-book",
  "Food & Cooking": "bi-cup-hot",
  Gaming: "bi-controller",
  "Community & Causes": "bi-people",
  Other: "bi-stars"
};

export const CATEGORIES = Object.keys(CATEGORY_ICONS);

export const INTEREST_LIMITS = { name: 60, description: 300 };
