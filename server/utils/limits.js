// Limits shared by Experience and Education (the client mirrors these)
const TEXT_LIMITS = {
  summary: 2200,
  highlights: 1000
};

const MAX_ITEMS = {
  tasks: 10,
  skills: 10,
  achievements: 5,
  volunteering: 5,
  media: 5
};

// Sends a 400 and returns true when the parent's list is already full
function rejectIfFull(res, parent, list, label) {
  const max = MAX_ITEMS[list];

  if (max === undefined || parent[list].length < max) return false;

  res.status(400).json({
    success: false,
    message: `You can add up to ${max} ${label}`
  });

  return true;
}

module.exports = { TEXT_LIMITS, MAX_ITEMS, rejectIfFull };
