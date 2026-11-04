const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const z = require("zod");
const catalog = require("../scripts/skillCatalogData");
const { isSkillKeyword, reviewResume } = require("../services/resume/atsRules");
const { dictionaryKeywords } = require("../services/resume/skillDictionary");
const { groupSkills } = require("../services/resume/skillGroups");
const { cleanSkillLists } = require("../services/resume/resumeQuality");
const { reviewViaA2A } = require("../a2a/atsReviewerClient");
const { evaluateJobMatch } = require("../services/match/jobMatchAgent");

// The portfolio MCP server (Model Context Protocol).
//
// Resume tools, used by the resume agent itself and by any MCP client:
//   find_job_keywords    known skills a job description asks for
//   search_skill_catalog standard skill names
//   group_skills         clean and sort skills into resume categories
//   check_ats            ATS review, done by the ATS Reviewer agent over A2A
//   evaluate_job_match   evidence-based, weighted job-fit score
//
//   list_section_schemas the fields each portfolio section takes (from its model)
//
// Portfolio tools, only when the server is started for one user (see
// mcp/stdio.js, e.g. for Claude Desktop, and the chat agents):
//   get_portfolio        the user's portfolio, as the resume builder sees it
//   build_resume         runs the full resume agent
//   search_portfolio     hybrid RAG search plus GraphRAG facts
//   find_existing_entry  an entry the user already has that looks the same
//   check_skill          whether a skill is already there (any case), and look-alikes
//   get_section_record   whether the profile or summary exists, and what's in it
//   add_to_buffer        puts a prepared entry in the buffer zone for review
//   list_buffer          entries waiting in the buffer zone
//   get_resume_settings  what the designed resumes include
//   update_resume_settings  more or fewer jobs, projects… on the resumes (all, or one design)
//   list_entries         every entry with its Show in portfolio / Show in resume switches
//   set_entry_visibility switches an entry on or off for the portfolio or resumes
//   list_custom_designs  the user's custom portfolio designs
//   apply_design_plan    creates, changes or deletes a custom design

const json = (value) => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  structuredContent: value
});

const stringList = z.array(z.string().max(200)).max(500);

function searchCatalog(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = catalog.filter((skill) => skill.name.toLowerCase().startsWith(q));
  const later = catalog.filter((skill) => !starts.includes(skill) && new RegExp(`[ ./-]${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(skill.name.toLowerCase()));
  return [...starts, ...later].slice(0, 10);
}

// Review by the A2A agent, or the same rules run here if it's unreachable
async function atsReview(resume, keywords) {
  const review = await reviewViaA2A({ resume, keywords });
  return review
    ? { review, reviewedBy: "ATS Reviewer agent (A2A)" }
    : { review: reviewResume(resume, keywords), reviewedBy: "built-in review (A2A agent unreachable)" };
}

// user: { id, username, email } to add the portfolio tools; run(fn) runs
// fn with that user's database selected
function createPortfolioMcpServer({ user = null, run = (fn) => fn() } = {}) {
  const server = new McpServer({ name: "ultraunityverse-portfolio", version: "1.0.0" });

  server.registerTool(
    "find_job_keywords",
    {
      title: "Find job keywords",
      description: "Finds the technical skills a job description asks for (known skills and the given extra names), skipping pay, location, titles and plain verbs.",
      inputSchema: {
        jobDescription: z.string().max(8000),
        extraSkills: stringList.optional(),
        targetTitle: z.string().max(120).optional()
      },
      outputSchema: { keywords: z.array(z.string()) }
    },
    async ({ jobDescription, extraSkills = [], targetTitle = "" }) =>
      json({
        keywords: dictionaryKeywords(jobDescription, extraSkills).filter((keyword) => isSkillKeyword(keyword, targetTitle))
      })
  );

  server.registerTool(
    "search_skill_catalog",
    {
      title: "Search skill catalog",
      description: "Looks up standard skill names (e.g. 'lang' -> LangChain, LangGraph).",
      inputSchema: { query: z.string().max(100) },
      outputSchema: { skills: z.array(z.object({ name: z.string(), skillType: z.string() })) }
    },
    async ({ query }) => json({ skills: searchCatalog(query) })
  );

  server.registerTool(
    "group_skills",
    {
      title: "Group skills",
      description: "Fixes skill spellings, removes repeats (OCI = Oracle Cloud Infrastructure) and sorts skills into resume categories like 'Languages & Engineering' and 'Generative AI & Agentic AI'.",
      inputSchema: { technical: stringList, soft: stringList.optional() },
      outputSchema: {
        technical: z.array(z.string()),
        soft: z.array(z.string()),
        groups: z.array(z.object({ label: z.string(), skills: z.array(z.string()) })),
        notes: z.array(z.string())
      }
    },
    async ({ technical, soft = [] }) => {
      const cleaned = cleanSkillLists(technical, soft);
      return json({ ...cleaned, groups: groupSkills(cleaned.technical, cleaned.soft) });
    }
  );

  server.registerTool(
    "check_ats",
    {
      title: "Check resume against ATS rules",
      description: "Reviews a built resume (as returned by build_resume) against ATS rules and job keywords. The review is done by the ATS Reviewer agent over A2A.",
      inputSchema: { resume: z.record(z.string(), z.any()), keywords: stringList.optional() },
      outputSchema: { review: z.record(z.string(), z.any()), reviewedBy: z.string() }
    },
    async ({ resume, keywords = [] }) => json(await atsReview(resume, keywords))
  );

  server.registerTool(
    "evaluate_job_match",
    {
      title: "Evaluate job match",
      description: "Scores how well a built resume fits a job: finds requirements, checks the evidence for each (strong / demonstrated / listed only / not shown), counts non-overlapping years of experience and returns a weighted score per category. Deterministic: no AI decides the score.",
      inputSchema: {
        resume: z.record(z.string(), z.any()),
        jobDescription: z.string().max(8000).optional(),
        requirements: z.array(z.record(z.string(), z.any())).max(60).optional(),
        weights: z.record(z.string(), z.number().min(0).max(100)).optional()
      }
    },
    async ({ resume, jobDescription = "", requirements, weights }) =>
      json(await evaluateJobMatch({ resume, jobDescription, requirements: requirements || null, weights: weights || null }))
  );

  server.registerTool(
    "list_section_schemas",
    {
      title: "List section schemas",
      description: "The fields each portfolio section (education, experience, projects, certifications…) takes, read from its data model: type, whether it's required and the allowed values.",
      inputSchema: { sections: z.array(z.string().max(40)).max(20).optional() }
    },
    async ({ sections }) => {
      const { schemaSummary, specOf } = require("../services/agents/sectionSpecs");
      return json({ sections: schemaSummary(sections?.filter((id) => specOf(id))) });
    }
  );

  if (!user) return server;

  // Loaded on first use: these need the user models
  const workspace = () => require("../services/agents/workspace");
  const knowledge = async () => {
    const { gatherResumeData } = require("../services/resume/resumeData");
    const { knowledgeFor } = require("../services/agents/portfolioKnowledge");
    const source = await run(() => gatherResumeData(user.id, user));
    return knowledgeFor(user.id, source);
  };
  const record = z.record(z.string(), z.any());

  server.registerTool(
    "search_portfolio",
    {
      title: "Search my portfolio",
      description: "Finds the parts of the portfolio that answer a question: hybrid search (BM25, plus embeddings when an embedding model is installed) over jobs, schools, projects and more, and GraphRAG facts from the portfolio's knowledge graph around the entities the question names.",
      inputSchema: { query: z.string().max(1000), k: z.number().int().min(1).max(10).optional() }
    },
    async ({ query, k = 5 }) => {
      const { graphFacts } = require("../services/agents/portfolioKnowledge");
      const index = await knowledge();
      const results = await index.search(query, k);
      return json({
        mode: index.mode,
        results: results.map((doc) => ({ ...doc.metadata, text: doc.pageContent })),
        graph: graphFacts(index.graph, query)
      });
    }
  );

  server.registerTool(
    "find_existing_entry",
    {
      title: "Find an existing entry",
      description: "Looks through the portfolio's knowledge graph for an entry that looks like this one (same school and degree, same company and title, same project name…).",
      inputSchema: { section: z.string().max(40), data: record }
    },
    async ({ section, data }) => {
      const { findExisting } = require("../services/agents/portfolioKnowledge");
      const match = findExisting((await knowledge()).graph, section, data);
      return json({ match: match ? { label: match.label, when: match.when || "", section: match.section } : null });
    }
  );

  server.registerTool(
    "check_skill",
    {
      title: "Check a skill",
      description: "Whether a skill is already on the Skills page or waiting in the buffer (case and spacing don't matter), look-alikes the user already has, and the catalog's spelling.",
      inputSchema: { name: z.string().min(1).max(100) }
    },
    async ({ name }) => json(await run(() => workspace().checkSkill(user.id, name)))
  );

  server.registerTool(
    "get_section_record",
    {
      title: "Get a single-record section",
      description: "For sections that are one record (profile, summary): whether it exists yet and what it holds.",
      inputSchema: { section: z.enum(["profile", "summary"]) }
    },
    async ({ section }) => json(await run(() => workspace().getSectionRecord(user.id, section)))
  );

  server.registerTool(
    "add_to_buffer",
    {
      title: "Add to the buffer zone",
      description: "Puts a prepared entry for a portfolio section in the buffer zone. Nothing in the portfolio changes until the user confirms it on that section's page.",
      inputSchema: {
        section: z.string().max(40),
        data: record,
        sourceText: z.string().max(4000).optional(),
        notes: z.array(z.string().max(300)).max(5).optional()
      }
    },
    async ({ section, data, sourceText = "", notes = [] }) =>
      json({ draft: await run(() => workspace().addDraft(user.id, { section, data, sourceText, notes })) })
  );

  server.registerTool(
    "list_buffer",
    {
      title: "List the buffer zone",
      description: "Entries waiting in the buffer zone for the user to confirm, optionally for one section.",
      inputSchema: { section: z.string().max(40).optional() }
    },
    async ({ section }) => json({ drafts: await run(() => workspace().listDrafts(user.id, section)) })
  );

  server.registerTool(
    "get_resume_settings",
    {
      title: "Get resume settings",
      description: "What the designed resumes include: how many jobs, schools, projects and certifications (0 = all), which optional sections, and whether every skill or only the key ones.",
      inputSchema: {}
    },
    async () => json(await run(() => workspace().getResumeSettings(user.id)))
  );

  server.registerTool(
    "update_resume_settings",
    {
      title: "Update resume settings",
      description: "Changes what the designed resumes include. limits: { experience|education|projects|certifications: count, null for all, or \"default\" }; show/hide: optional sections (achievements, volunteering, publications, patents, interests); allSkills: true for every skill; columns: the column a section sits in on two-column resumes, e.g. { education: \"right\" } (left, right, side or main); hideFields / showFields: one detail of an entry, e.g. [\"education:<id>:grade\"] (grade, location, dates, description, issuer); skillStyle: boxes, list, bars, dots or inline; order: section ids in the order they should appear; rewrite: wording changed on resumes only, the portfolio keeps the original: { replace: { from, to } }, { summary }, { line }, { contact: { phone } }, { titles: { experience } } or { clear: true }.",
      inputSchema: {
        limits: z.record(z.string(), z.union([z.number().int().min(1).max(50), z.null(), z.literal("default")])).optional(),
        show: z.array(z.string().max(30)).max(10).optional(),
        hide: z.array(z.string().max(30)).max(10).optional(),
        allSkills: z.boolean().optional(),
        columns: z.record(z.string(), z.enum(["left", "right", "side", "main"])).optional(),
        designId: z.string().max(40).optional(),
        hideEntries: z.array(z.string().max(80)).max(50).optional(),
        showEntries: z.array(z.string().max(80)).max(50).optional(),
        hideFields: z.array(z.string().max(80)).max(100).optional(),
        showFields: z.array(z.string().max(80)).max(100).optional(),
        skillStyle: z.enum(["boxes", "list", "bars", "dots", "inline"]).optional(),
        order: z.array(z.string().max(30)).max(20).optional(),
        tweaks: z.object({
          sideShift: z.number().min(-40).max(40).optional(),
          margin: z.number().min(-100).max(200).optional(),
          gutter: z.number().min(-100).max(200).optional(),
          text: z.number().min(-100).max(200).optional(),
          spacing: z.number().min(-100).max(200).optional()
        }).optional(),
        rewrite: z.object({
          replace: z.object({ from: z.string().max(1000), to: z.string().max(1000) }).optional(),
          summary: z.string().max(1500).optional(),
          line: z.string().max(1500).optional(),
          contact: z.record(z.string(), z.string().max(200)).optional(),
          titles: z.record(z.string(), z.string().max(60)).optional(),
          clear: z.boolean().optional()
        }).optional(),
        accent: z.string().max(7).optional(),
        reset: z.boolean().optional()
      }
    },
    async ({ designId = "", ...changes }) => json(await run(() => workspace().updateResumeSettings(user.id, changes, designId)))
  );

  server.registerTool(
    "get_resume_text",
    {
      title: "Get resume text",
      description: "The text a resume is filled from (contact, summary, jobs, schools, projects, certifications and the rest), before any resume-only wording.",
      inputSchema: {}
    },
    async () => {
      const { gatherResumeData } = require("../services/resume/resumeData");
      return json(await run(() => gatherResumeData(user.id, user, { audience: "resume" })));
    }
  );

  server.registerTool(
    "list_entries",
    {
      title: "List my entries",
      description: "Every portfolio entry (jobs, schools, projects, certifications, achievements, volunteering, publications, patents, interests, recommendations, skills) with its id and whether it shows on the portfolio and on resumes. section narrows it to one.",
      inputSchema: { section: z.string().max(40).optional() }
    },
    async ({ section }) => {
      const { listEntries } = require("../services/portfolio/entryVisibility");
      return json({ entries: await run(() => listEntries(user.id, section)) });
    }
  );

  server.registerTool(
    "set_entry_visibility",
    {
      title: "Show or hide an entry",
      description: "Switches one entry on or off for the portfolio websites (showInPortfolio) and for every resume (showInResume).",
      inputSchema: {
        section: z.string().max(40),
        id: z.string().max(40),
        showInPortfolio: z.boolean().optional(),
        showInResume: z.boolean().optional()
      }
    },
    async ({ section, id, ...flags }) => {
      const { setEntryVisibility } = require("../services/portfolio/entryVisibility");
      const entry = await run(() => setEntryVisibility(user.id, section, id, flags));
      if (!entry) return { isError: true, content: [{ type: "text", text: "Entry not found" }] };
      return json({ entry });
    }
  );

  server.registerTool(
    "list_custom_designs",
    {
      title: "List my custom designs",
      description: "The user's custom portfolio designs: base design, colour, fonts, corners, mode, hidden sections, order and titles.",
      inputSchema: {}
    },
    async () => json({ designs: await run(() => workspace().listCustomDesigns(user.id)) })
  );

  server.registerTool(
    "apply_design_plan",
    {
      title: "Apply a design plan",
      description: "Creates, changes or deletes a custom portfolio design from a plan (as the Portfolio Designer agent returns it). The plan is checked against the design catalog first.",
      inputSchema: { plan: record }
    },
    async ({ plan }) => {
      const { sanitizePlan } = require("../services/agents/designPlanner");
      const custom = await run(() => workspace().listCustomDesigns(user.id));
      const checked = sanitizePlan(plan, custom, plan.targetId || "");
      const result = await run(() => workspace().applyDesignPlan(user.id, checked));
      return json({ ...result, notes: checked.notes });
    }
  );

  server.registerTool(
    "get_portfolio",
    {
      title: "Get my portfolio",
      description: `Everything in ${user.username}'s portfolio that can go on a resume: contact, summary, experience, education, projects, skills, certifications and more.`,
      inputSchema: {}
    },
    async () => {
      const { gatherResumeData } = require("../services/resume/resumeData");
      return json(await run(() => gatherResumeData(user.id, user)));
    }
  );

  server.registerTool(
    "build_resume",
    {
      title: "Build my resume",
      description: "Runs the resume agent over the whole portfolio: tailors it to a job, writes bullets with the local AI (Ollama) if useAi, fixes spelling, groups skills and returns the resume with its ATS review.",
      inputSchema: {
        targetTitle: z.string().max(120).optional(),
        jobDescription: z.string().max(8000).optional(),
        instructions: z.string().max(1000).optional(),
        useAi: z.boolean().optional()
      }
    },
    async ({ targetTitle = "", jobDescription = "", instructions = "", useAi = false }) => {
      // Loaded here: the resume agent itself uses this server's tools
      const { gatherResumeData } = require("../services/resume/resumeData");
      const { buildResume } = require("../services/resume/resumeAgent");
      const { ollamaStatus, createOllamaLlm } = require("../services/resume/ollama");

      if (useAi && !(await ollamaStatus()).available) {
        return { isError: true, content: [{ type: "text", text: "Ollama isn't available; try again with useAi false." }] };
      }

      const source = await run(() => gatherResumeData(user.id, user));
      const sections = { summary: true, experience: true, education: true, projects: true, skills: true };
      const result = await buildResume({
        source,
        options: { sections, targetTitle, jobDescription, instructions, showContact: {}, addMissingKeywords: false, useAi },
        llm: useAi ? createOllamaLlm() : null
      });

      return json(result);
    }
  );

  return server;
}

module.exports = { createPortfolioMcpServer, atsReview };
