// What UltraUnityVerse offers. Shared by the Services page and the footer,
// so both always list the same things.
export const SERVICES = [
  {
    id: "portfolio",
    icon: "bi-person-badge",
    title: "Portfolio Builder",
    short: "One place for your whole career story.",
    description:
      "Record your profile, summary, experience, education, projects, skills and certifications once, with the tasks, media and files that back them up.",
    features: [
      "Experience and education with projects, tasks and attachments",
      "Achievements, volunteering, publications, patents and interests",
      "Recommendations from people you've worked with",
      "Skills linked to the work that shows them"
    ],
    to: "/dashboard"
  },
  {
    id: "cv-maker",
    icon: "bi-file-earmark-person",
    title: "CV Maker",
    short: "Resumes built from your portfolio.",
    description:
      "Turn your portfolio into a clean, ATS-friendly resume. Pick a template, preview it live and choose exactly what goes in.",
    features: [
      "Professional templates with a live preview",
      "Content pulled straight from your portfolio",
      "Save as PDF or download as plain text",
      "Several saved resumes for different roles"
    ],
    to: "/dashboard/resume"
  },
  {
    id: "jobpilot",
    icon: "bi-bullseye",
    title: "JobPilot Resume Match",
    short: "See how well you fit a job, and why.",
    description:
      "Compare a resume with a job description requirement by requirement. Every score is backed by evidence from your resume and an explanation you can check.",
    features: [
      "Required and preferred qualifications scored separately",
      "Evidence quoted from your resume for each requirement",
      "Quick questions to confirm experience the resume doesn't show",
      "Saved match history to track your applications"
    ],
    to: "/dashboard/resume-match"
  },
  {
    id: "ats",
    icon: "bi-shield-check",
    title: "ATS Resume Check",
    short: "Make sure applicant systems can read you.",
    description:
      "An independent ATS reviewer agent checks structure, keywords and bullet quality, and points to the lines worth rewriting.",
    features: [
      "Keyword coverage against the job",
      "Formatting and section checks",
      "Bullets flagged for stronger rewrites",
      "Kept separate from your fit score"
    ],
    to: "/dashboard/resume-match"
  },
  {
    id: "agents",
    icon: "bi-cpu",
    title: "AI Agent Tools",
    short: "Your portfolio, ready for AI assistants.",
    description:
      "Portfolio and resume tools are available over the Model Context Protocol (MCP), and the ATS reviewer speaks Agent-to-Agent (A2A).",
    features: [
      "MCP tools for job keywords, skills and match scoring",
      "Build a resume from an AI assistant such as Claude Desktop",
      "A2A ATS reviewer with a public agent card",
      "AI helps read text; scoring stays deterministic"
    ],
    to: "/services#agents"
  },
  {
    id: "security",
    icon: "bi-lock",
    title: "Account & Activity Security",
    short: "Stay in control of your account.",
    description:
      "See where you're signed in and what changed, and keep your activity history behind your password.",
    features: [
      "Activity log locked behind your password",
      "Active sessions you can sign out remotely",
      "Password reset and change",
      "Storage usage at a glance"
    ],
    to: "/dashboard/activity"
  }
];
