import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CONTACT } from "../Contact/contactInfo";
import { publicUrl, STATIC_SITE } from "../../staticSite";

const STATS = [
  ["45", "portfolio designs"],
  ["28", "resume designs"],
  ["7", "AI agents working together"],
  ["109/109", "agent test cases pass"]
];

const VALUES = [
  {
    icon: "bi-search",
    title: "Evidence over guesswork",
    text: "Every match score points to the lines in your resume that support it. Nothing is inflated to hit a number."
  },
  {
    icon: "bi-patch-check",
    title: "AI that can't make things up",
    text: "Rewritten text is checked against your portfolio. A line that adds a number or a name you never wrote is rejected."
  },
  {
    icon: "bi-person-check",
    title: "You stay in control",
    text: "Agents ask before they save, ask which one when you could mean several entries, and every change can be undone."
  },
  {
    icon: "bi-shield-lock",
    title: "Private by default",
    text: "Each account has its own database. Activity history sits behind your password, and you can end any session."
  }
];

const STEPS = [
  ["bi-pencil-square", "Build your portfolio", "Add experience, education, projects and skills, or just tell the assistant in a sentence."],
  ["bi-palette", "Pick a look", "Choose from 45 portfolio designs and 28 resume designs, or describe your own."],
  ["bi-file-earmark-person", "Tailor a resume", "Paste a job description and CV Maker picks and rewrites your most relevant work."],
  ["bi-bullseye", "Match and improve", "JobPilot scores each requirement, shows the evidence and suggests honest rewrites."]
];

const AGENTS = [
  ["bi-diagram-3", "Supervisor", "Reads each message and sends it to the right agent, or asks when it isn't sure."],
  ["bi-input-cursor-text", "Data entry", "Adds and edits portfolio entries, asking for anything required that's missing."],
  ["bi-brush", "Design", "Changes colours, fonts and layouts, and creates custom designs."],
  ["bi-chat-square-quote", "Q&A", "Answers from your own portfolio with hybrid RAG and GraphRAG, and lists its sources."],
  ["bi-file-earmark-text", "Resume customizer", "Builds and revises resumes for a job, with every rewrite checked."],
  ["bi-clipboard-check", "ATS Reviewer", "Checks keywords, structure and bullets, as its own agent over A2A."],
  ["bi-easel", "Portfolio Designer", "Plans new designs, as its own agent over A2A."]
];

const STACK = ["React 19", "Vite", "Bootstrap", "Node.js", "Express 5", "MongoDB", "LangGraph", "LangChain", "MCP", "A2A", "Ollama", "Workers AI", "scikit-learn"];

export default function About() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="uuv-info-page">
      <section className="uuv-info-hero text-center">
        <div className="container">
          <img src={publicUrl("logo-icon.png")} alt="" width="88" height="88" className="mb-3" />
          <p className="uuv-slogan mb-2">About</p>
          <h1 className="display-5 fw-bold mb-3">
            Your career, <span className="uuv-gradient-text">unified</span>
          </h1>
          <p className="lead text-secondary col-lg-8 mx-auto mb-4">
            UltraUnityVerse brings your portfolio, resumes and job applications into one
            place, with a team of AI agents that help you, and never make things up.
          </p>
          <dl className="uuv-info-stats">
            {STATS.map(([value, label]) => (
              <div key={label}>
                <dt className="uuv-gradient-text">{value}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-4 g-lg-5 align-items-center">
          <div className="col-lg-5">
            <p className="uuv-service-index mb-1">Our mission</p>
            <h2 className="h3 fw-bold mb-3">Why we built it</h2>
            <p className="text-secondary mb-3">
              Job seekers keep their career story scattered across old resumes, profiles
              and notes, then rewrite it for every application. Matching tools often hand
              back a single percentage with no reason behind it, and AI writers happily
              invent results you never had.
            </p>
            <p className="text-secondary mb-0">
              UltraUnityVerse keeps one complete record of your work and builds everything
              else from it: portfolios, resumes that fit the role, and job matches that
              explain themselves, with the evidence attached.
            </p>
          </div>
          <div className="col-lg-7">
            <div className="row g-3">
              {VALUES.map((value) => (
                <div key={value.title} className="col-sm-6">
                  <div className="card h-100 uuv-service-card">
                    <div className="card-body p-4">
                      <div className="uuv-service-icon uuv-service-icon-sm mb-3">
                        <i className={`bi ${value.icon}`} aria-hidden="true"></i>
                      </div>
                      <h3 className="h6 fw-bold mb-1">{value.title}</h3>
                      <p className="small text-secondary mb-0">{value.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="uuv-info-band py-5">
        <div className="container">
          <h2 className="h3 fw-bold text-center mb-2">How it works</h2>
          <p className="text-secondary text-center mb-4">Four steps from a blank page to a stronger application.</p>
          <ol className="uuv-info-steps list-unstyled mb-0">
            {STEPS.map(([icon, title, text], index) => (
              <li key={title}>
                <div className="uuv-step-number mb-3">{index + 1}</div>
                <h3 className="h6 fw-bold mb-1"><i className={`bi ${icon} me-2`} aria-hidden="true"></i>{title}</h3>
                <p className="small text-secondary mb-0">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container py-5">
        <div className="text-center mb-4">
          <p className="uuv-service-index mb-1">Under the hood</p>
          <h2 className="h3 fw-bold mb-2">A team of AI agents</h2>
          <p className="text-secondary col-lg-8 mx-auto mb-0">
            Each agent has one job. They share the same tools over the Model Context
            Protocol, and when no language model is running, rules and trained models
            keep them working.
          </p>
        </div>
        <div className="uuv-info-agents">
          {AGENTS.map(([icon, name, text]) => (
            <div key={name} className="uuv-info-agent">
              <i className={`bi ${icon}`} aria-hidden="true"></i>
              <div>
                <h3 className="h6 fw-bold mb-1">{name}</h3>
                <p className="small text-secondary mb-0">{text}</p>
              </div>
            </div>
          ))}
        </div>
        <ul className="uuv-info-stack list-unstyled" aria-label="Built with">
          {STACK.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="container pb-5">
        <div className="row justify-content-center">
          <div className="col-lg-9">
            <div className="card uuv-service-card uuv-creator-card">
              <div className="card-body p-4 p-md-5 d-flex flex-column flex-sm-row align-items-sm-center gap-4">
                <div className="uuv-creator-avatar" aria-hidden="true">SU</div>
                <div>
                  <p className="small text-uppercase fw-semibold text-secondary mb-1">Created by</p>
                  <h2 className="h4 fw-bold mb-2">Sai Uday R Udumula</h2>
                  <p className="text-secondary mb-3">
                    UltraUnityVerse was designed and built by Sai Uday R Udumula, combining
                    full-stack engineering with AI agents to make career tools that are
                    useful and honest.
                  </p>
                  <div className="d-flex gap-2 flex-wrap">
                    <a href={CONTACT.githubUrl} target="_blank" rel="noreferrer" className="btn btn-outline-secondary btn-sm">
                      <i className="bi bi-github me-1" aria-hidden="true"></i>GitHub
                    </a>
                    <a href={CONTACT.emailUrl} className="btn btn-outline-secondary btn-sm">
                      <i className="bi bi-envelope me-1" aria-hidden="true"></i>Email
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container pb-5">
        <div className="uuv-info-cta text-center p-4 p-md-5">
          <h2 className="h3 fw-bold mb-2">See what you can do</h2>
          <p className="mb-4 opacity-75">
            {STATIC_SITE ? "Explore the tools, or open a demo account. No sign-up needed." : "Explore the tools, or create your free account."}
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to="/services" className="btn btn-light px-4">Our services</Link>
            <Link to="/signup" className="btn btn-outline-light px-4">{STATIC_SITE ? "Try the demo" : "Get started"}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
