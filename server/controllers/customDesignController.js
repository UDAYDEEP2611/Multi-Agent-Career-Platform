const { listCustomDesigns, getCustomDesign, applyDesignPlan, deleteCustomDesign } = require("../services/agents/workspace");
const { sanitizePlan } = require("../services/agents/designPlanner");

// Custom portfolio designs, for the gallery and the design view. The design
// agent makes most of them; these endpoints read, edit and delete them.

const fail = (res, error, message) => {
  console.error(message, error);
  res.status(500).json({ success: false, message });
};

// GET /api/custom-designs
exports.getCustomDesigns = async (req, res) => {
  try {
    res.json({ success: true, designs: await listCustomDesigns(req.session.userId) });
  } catch (error) {
    fail(res, error, "Unable to load your designs");
  }
};

// GET /api/custom-designs/:designId
exports.getCustomDesign = async (req, res) => {
  try {
    const design = await getCustomDesign(req.session.userId, req.params.designId);
    if (!design) return res.status(404).json({ success: false, message: "Design not found" });
    res.json({ success: true, design });
  } catch (error) {
    fail(res, error, "Unable to load the design");
  }
};

// POST /api/custom-designs { baseId, changes }  and
// PATCH /api/custom-designs/:designId { changes }
// changes: the same shape the design agent's plans use
async function save(req, res, action) {
  const changes = req.body?.changes;
  if (changes !== undefined && (typeof changes !== "object" || Array.isArray(changes))) {
    return res.status(400).json({ success: false, message: "Send the changes as an object" });
  }
  try {
    const custom = await listCustomDesigns(req.session.userId);
    const plan = sanitizePlan({ action, targetId: req.params.designId, baseId: req.body?.baseId, changes: changes || {} }, custom, req.params.designId || "");
    if (action === "update" && plan.targetId !== req.params.designId) return res.status(404).json({ success: false, message: "Design not found" });
    const result = await applyDesignPlan(req.session.userId, plan);
    if (!result.design) return res.status(404).json({ success: false, message: "Design not found" });
    res.status(action === "create" ? 201 : 200).json({ success: true, design: result.design, notes: plan.notes });
  } catch (error) {
    if (/up to \d+ custom designs/.test(error.message)) return res.status(400).json({ success: false, message: error.message });
    fail(res, error, "Unable to save the design");
  }
}

exports.createCustomDesign = (req, res) => save(req, res, "create");
exports.updateCustomDesign = (req, res) => save(req, res, "update");

// DELETE /api/custom-designs/:designId
exports.deleteCustomDesign = async (req, res) => {
  try {
    if (!(await deleteCustomDesign(req.session.userId, req.params.designId))) {
      return res.status(404).json({ success: false, message: "Design not found" });
    }
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "Unable to delete the design");
  }
};
