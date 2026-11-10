// What UltraUnityVerse offers. Shared by the Services page and the footer,
// so both always list the same things.
export const SERVICES = [
  {
    id: "portfolio",
    icon: "bi-person-badge",
    title: "Portfolio Builder",
    short: "One place for your whole career story.",
    description:
      "Record your profile, summary, experience, education, projects, skills and certifications once, with the tasks, media and files that back them up. Everything else on the platform is built from this record.",
    features: [
      "Experience and education with their own projects, tasks and attachments",
      "Achievements, volunteering, publications, patents and interests",
      "Recommendations from people you've worked with",
      "Separate switches for the portfolio and for resumes"
    ],
    stat: ["13", "portfolio sections"],
    example: "I did my MS in CS at UNT, 2021 to 2023",
    to: "/dashboard"
  },
  {
    id: "designs",
    icon: "bi-palette",
    title: "Portfolio & Resume Designs",
    short: "Look the part, in light or dark.",
    description:
      "Show your portfolio in 45 designs across six styles, and your resumes in 28 one- and two-column layouts. Change colours and fonts, or describe a new design in chat and get your own version.",
    features: [
      "45 portfolio designs: Minimal, Creative, Classic, Playful, Developer and Professional",
      "28 resume designs with colour and section choices",
      "Custom designs made from a sentence in chat",
      "Every design in light and dark mode, and print-ready as a PDF"
    ],
    stat: ["73", "designs"],
    example: "Make a dark green Slate called Forest and hide projects",
    to: "/dashboard/portfolios"
  },
  {
    id: "cv-maker",
    icon: "bi-file-earmark-person",
    title: "CV Maker",
    short: "A resume tailored to the job, in seconds.",
    description:
      "Turn your portfolio into a clean, ATS-friendly resume and tailor it to a job description. AI picks and rewrites your most relevant work, and any line that adds a number or name your portfolio doesn't have is rejected.",
    features: [
      "Tailored to a pasted job description",
      "AI rewrites checked against your own portfolio",
      "Revise it in plain words: \"shorter summary, more on Python\"",
      "Save as PDF, copy the text or download a .txt"
    ],
    stat: ["0", "made-up facts"],
    example: "Tailor my resume to this Data Engineer job",
    to: "/dashboard/resume"
  },
  {
    id: "jobpilot",
    icon: "bi-bullseye",
    title: "JobPilot Resume Match",
    short: "See how well you fit a job, and why.",
    description:
      "Upload a resume and paste a job description. JobPilot scores the match requirement by requirement, quotes the evidence behind each score, and tells apart skills you only list from skills you've used in real work.",
    features: [
      "Required and preferred qualifications scored separately",
      "Evidence quoted from your resume for each requirement",
      "Bullet rewrites with the scores before and after",
      "Quick questions for experience the resume doesn't show"
    ],
    stat: ["72h", "Log Book history"],
    example: "Kubernetes: related (Docker), not a match. Here's why.",
    to: "/dashboard/resume-match"
  },
  {
    id: "ats",
    icon: "bi-shield-check",
    title: "ATS Resume Check",
    short: "Make sure applicant systems can read you.",
    description:
      "A separate ATS Reviewer agent checks structure, keywords and bullet quality, and points to the lines worth rewriting. Its result is kept apart from your fit score, so one never hides the other.",
    features: [
      "Keyword coverage against the job",
      "Formatting and section checks",
      "Weak bullets flagged with the reason",
      "Runs as its own agent over A2A"
    ],
    stat: ["A2A", "independent reviewer"],
    example: "Weak bullet: no result shown. Say what changed.",
    to: "/dashboard/resume-match"
  },
  {
    id: "assistant",
    icon: "bi-chat-dots",
    title: "AI Portfolio Assistant",
    short: "Update and question your portfolio in chat.",
    description:
      "A supervisor sends each message to the right agent: data entry adds and edits entries, design changes how things look, and Q&A answers from your own portfolio with sources. Every change can be undone.",
    features: [
      "Asks for missing details and waits for your confirmation",
      "Answers with the entries it used as sources",
      "Asks which one when a request could mean several entries",
      "One-click undo for each message's changes"
    ],
    stat: ["109/109", "evaluation cases pass"],
    example: "Which projects used LangGraph?",
    to: "/dashboard"
  },
  {
    id: "agents",
    icon: "bi-cpu",
    title: "MCP & A2A Agent Tools",
    short: "Your portfolio, ready for any AI assistant.",
    description:
      "The same tools the built-in agents use are open over the Model Context Protocol, so assistants such as Claude Desktop can read your portfolio and build resumes. The ATS Reviewer and Portfolio Designer speak Agent2Agent.",
    features: [
      "MCP tools for portfolio data, job keywords and match scoring",
      "Build a resume from an outside AI assistant",
      "A2A agents with public agent cards",
      "AI reads the text; scoring stays rule-based"
    ],
    stat: ["MCP", "+ A2A protocols"],
    example: "find_job_keywords → evaluate_job_match → build_resume",
    to: "/services#agents"
  },
  {
    id: "security",
    icon: "bi-lock",
    title: "Account & Privacy",
    short: "Your data stays yours.",
    description:
      "Each account has its own database. See where you're signed in and what changed, sign out other sessions, and keep your activity history behind your password.",
    features: [
      "A separate database for every account",
      "Activity log locked behind your password",
      "Active sessions you can sign out remotely",
      "Storage usage at a glance"
    ],
    stat: ["1", "database per account"],
    example: "Signed out of 2 other sessions",
    to: "/dashboard/activity"
  }
];
