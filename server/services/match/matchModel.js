const { groupFor } = require("../resume/skillGroups");

// The job-match model. Everything here is deterministic: the language model
// may help find requirements, but never decides a score.

// Default weights (percent). Callers may pass their own; categories the job
// doesn't ask about are left out and the rest re-weighted.
const CATEGORIES = [
  { id: "core_ai_ml", label: "Core AI/ML", weight: 30 },
  { id: "software_engineering", label: "Software Engineering", weight: 20 },
  { id: "cloud_mlops", label: "Cloud & MLOps", weight: 20 },
  { id: "product_collaboration", label: "Product Collaboration", weight: 15 },
  { id: "security_governance", label: "Security & Governance", weight: 10 },
  { id: "qualifications", label: "Qualifications", weight: 5 }
];
const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

// Resume skill groups -> match categories
const CATEGORY_FOR_GROUP = {
  "Languages & Engineering": "software_engineering",
  "Machine Learning": "core_ai_ml",
  "Generative AI & Agentic AI": "core_ai_ml",
  "RAG & Vector Search": "core_ai_ml",
  "MLOps, LLMOps, Evaluation & Responsible AI": "cloud_mlops",
  "Cloud & Data": "cloud_mlops",
  "Security & Compliance": "security_governance",
  "Tools & Platforms": "software_engineering"
};

const categoryForSkill = (name) => CATEGORY_FOR_GROUP[groupFor(name)] || "software_engineering";

// How strongly the resume shows a requirement
//   strong        in 2+ experience/project bullets, or one bullet that also
//                 shows deployment, scale, testing or a measured result
//   demonstrated  in an experience/project bullet
//   partial       only listed (skills or summary)
//   missing       not on the resume (which isn't proof it's lacking)
const EVIDENCE = {
  strong: { score: 1, label: "Strong evidence" },
  demonstrated: { score: 0.75, label: "Demonstrated" },
  partial: { score: 0.4, label: "Listed only" },
  missing: { score: 0, label: "Not shown" }
};

// Critical requirements (what the job centers on) count three times as much
// as preferred ones, required twice as much
const IMPORTANCE_WEIGHT = { critical: 3, required: 2, preferred: 1 };

// requirements: [{ category, importance, score }]
// weights: { categoryId: percent } (defaults above)
// Returns { overall, categories: [{ id, label, weight, score, count }] }
function scoreMatch(requirements, weights = {}) {
  const categories = CATEGORIES.map((category) => {
    const items = requirements.filter((requirement) => requirement.category === category.id);
    const total = items.reduce((sum, item) => sum + IMPORTANCE_WEIGHT[item.importance], 0);
    const earned = items.reduce((sum, item) => sum + IMPORTANCE_WEIGHT[item.importance] * item.score, 0);

    return {
      id: category.id,
      label: category.label,
      weight: Number.isFinite(weights[category.id]) ? Math.max(0, weights[category.id]) : category.weight,
      score: items.length ? Math.round((earned / total) * 100) : null,
      count: items.length
    };
  });

  const active = categories.filter((category) => category.score !== null && category.weight > 0);
  const weightSum = active.reduce((sum, category) => sum + category.weight, 0);
  const overall = weightSum
    ? Math.round(active.reduce((sum, category) => sum + category.score * category.weight, 0) / weightSum)
    : null;

  return { overall, categories };
}

module.exports = { CATEGORIES, CATEGORY_IDS, EVIDENCE, IMPORTANCE_WEIGHT, categoryForSkill, scoreMatch };
