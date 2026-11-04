const { planViaA2A } = require("../../a2a/designerClient");
const { planDesign, planResume, isResumeRequest } = require("./designPlanner");

const LABELS = { experience: "jobs", education: "schools", projects: "projects", certifications: "certifications" };

function describeResume(settings) {
  const parts = Object.entries(settings.limits).map(([id, count]) => `${count === 0 ? "all" : count} ${LABELS[id]}`);
  parts.push(settings.allSkills ? "every skill" : "key skills (up to 15)");
  if (settings.extras.length) parts.push(settings.extras.join(", "));
  return parts.join(", ");
}

// What the designed resumes include, changed through MCP
async function runResume({ text, tools, llm = null, signal }) {
  // Naming entries ("hide the Blood Bank project from my resumes"): the resume
  // customizer finds them (RAG / GraphRAG) and switches them off on every resume
  const { rulePlan, keywordsOf, runResumeCustomizer } = require("./resumeCustomizer");
  const entryPlan = rulePlan(text);
  if (entryPlan.columns || entryPlan.moveAsk || entryPlan.fieldAsk || entryPlan.partAsk || entryPlan.skillStyle || entryPlan.editAsk || entryPlan.order || entryPlan.pageHide || entryPlan.pageShow || entryPlan.detailsAsk || [...(entryPlan.hideEntries || []), ...(entryPlan.showEntries || [])].some((phrase) => keywordsOf(phrase).length)) {
    const result = await runResumeCustomizer({ text, designId: "", llm, tools, signal });
    return { reply: result.reply, links: [{ label: "Open resumes", to: "/dashboard/resumes" }], steps: result.steps, changed: result.changed, resume: true };
  }
  const steps = ["Read it as a change to what your resumes include"];
  const changes = planResume(text);
  if (!Object.keys(changes).length) {
    const current = await tools.call("get_resume_settings");
    return {
      reply: `Your resumes show ${describeResume(current)}. Tell me what to change, for example "show all my projects on my resume", "3 jobs on my resume", "add interests to my resume" or "all skills on my resume".`,
      links: [{ label: "Open resumes", to: "/dashboard/resumes" }],
      steps
    };
  }
  const settings = await tools.call("update_resume_settings", changes);
  steps.push("Saved with the MCP tool update_resume_settings");
  return {
    reply: `Done. Your resumes now show ${describeResume(settings)}.`,
    links: [{ label: "Open resumes", to: "/dashboard/resumes" }],
    steps,
    changed: true,
    resume: true
  };
}
const { FONTS } = require("./designCatalog");

// The design step of the chat: reads the user's custom designs (MCP),
// asks the Portfolio Designer agent for a plan (A2A, or the same planner
// in-process when that agent isn't running), applies it (MCP) and says
// what changed.

const sectionList = (ids) => ids.join(", ");

function describeChanges(changes) {
  const parts = [];
  if (changes.accent) parts.push(`accent ${changes.accent}`);
  if (changes.font) parts.push(`${changes.font} for text`);
  if (changes.headingFont) parts.push(`${changes.headingFont} for headings`);
  if (changes.corners) parts.push(`${changes.corners} corners`);
  if (changes.mode) parts.push(`always ${changes.mode}`);
  if (changes.hide?.length) parts.push(`hid ${sectionList(changes.hide)}`);
  if (changes.show?.length) parts.push(`showing ${sectionList(changes.show)}`);
  if (changes.order?.length) parts.push(`order starts with ${sectionList(changes.order.slice(0, 3))}`);
  for (const [id, title] of Object.entries(changes.titles || {})) parts.push(`${id} is now "${title}"`);
  for (const [id, count] of Object.entries(changes.limits || {})) {
    parts.push(count === null ? `showing all ${id}` : `only the first ${count} ${count === 1 ? id.replace(/s$/, "") : id}`);
  }
  if (changes.heroSummary) parts.push("new hero summary");
  return parts;
}

async function runDesign({ text, currentId = "", llm = null, tools, signal }) {
  if (isResumeRequest(text)) return runResume({ text, tools, llm, signal });
  const steps = [];
  const { designs: custom } = await tools.call("list_custom_designs");
  steps.push(`Read your ${custom.length} custom design${custom.length === 1 ? "" : "s"} with the MCP tool list_custom_designs`);

  let plan = await planViaA2A({ request: text, custom, currentId }, signal);
  if (plan) steps.push(`The Portfolio Designer agent planned it over A2A (${plan.plannedBy})`);
  else {
    plan = await planDesign({ request: text, custom, currentId, llm, signal });
    steps.push(`Planned in-process (the Portfolio Designer A2A agent wasn't reachable; ${plan.plannedBy})`);
  }

  if (plan.action === "list") {
    return {
      reply: custom.length
        ? `Your custom designs:\n${custom.map((design) => `• ${design.name} (from ${design.baseName})`).join("\n")}`
        : "You don't have custom designs yet. Try: \"Make a dark green Slate called Forest and hide projects\".",
      links: custom.slice(0, 3).map((design) => ({ label: `Open ${design.name}`, to: `/portfolio/custom-${design.id}` })),
      steps
    };
  }
  if (plan.action === "none") {
    return {
      reply: `I couldn't tell what to change. You can ask for a colour ("make it navy"), fonts (${FONTS.slice(0, 4).join(", ")}…), corners (sharp, soft, round), dark or light, hiding or showing sections, putting a section first, or renaming one.`,
      choices: ["Make a new Slate design", "Hide projects", "Use dark mode"],
      steps
    };
  }

  const result = await tools.call("apply_design_plan", { plan: { ...plan, targetId: plan.targetId || currentId } });
  steps.push(`Applied the plan with the MCP tool apply_design_plan (${result.action})`);
  const notes = [...(plan.notes || []), ...(result.notes || [])];
  const unique = [...new Set(notes)];

  if (result.action === "delete") {
    return { reply: `Deleted "${result.deleted.name}".`, links: [{ label: "All designs", to: "/dashboard/portfolios" }], steps, changed: true };
  }
  if (!result.design) {
    return { reply: "I couldn't find that design. Open the custom design you want to change, or ask me to make a new one.", steps };
  }

  const changes = describeChanges(plan.changes);
  const verb = result.action === "create" ? `Made "${result.design.name}" from ${result.design.baseName}` : `Updated "${result.design.name}"`;
  return {
    reply: `${verb}${changes.length ? `: ${changes.join(", ")}` : ""}.${unique.length ? ` ${unique.join(" ")}` : ""}`,
    links: [{ label: `Open ${result.design.name}`, to: `/portfolio/custom-${result.design.id}` }],
    steps,
    changed: true,
    designId: result.design.id
  };
}

module.exports = { runDesign };
