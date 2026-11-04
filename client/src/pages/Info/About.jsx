import { useEffect } from "react";
import { Link } from "react-router-dom";
import { publicUrl } from "../../staticSite";

const VALUES = [
  {
    icon: "bi-search",
    title: "Evidence over guesswork",
    text: "Every match score points to the lines in your resume that support it. Nothing is inflated to hit a number."
  },
  {
    icon: "bi-person-check",
    title: "You stay in control",
    text: "Your portfolio is yours. You choose what goes into each resume and confirm anything the resume doesn't show."
  },
  {
    icon: "bi-lightning-charge",
    title: "Write once, reuse everywhere",
    text: "One career record feeds your resumes, job matches and AI tools, so you never retype your history."
  },
  {
    icon: "bi-shield-lock",
    title: "Private by default",
    text: "Activity history sits behind your password, and you can see and end every signed-in session."
  }
];

const STEPS = [
  ["Build your portfolio", "Add experience, education, projects and skills with the details that prove them."],
  ["Create a resume", "Pick a template and the content that fits the role, then save it as a PDF."],
  ["Match it to a job", "Paste a job description and see requirement by requirement where you stand."],
  ["Improve and apply", "Follow the recommendations, answer quick questions, and track every match."]
];

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
          <p className="lead text-secondary col-lg-8 mx-auto mb-0">
            UltraUnityVerse brings your portfolio, resumes and job applications into one
            place, and uses AI to help, never to make things up.
          </p>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-4 g-lg-5 align-items-center">
          <div className="col-lg-6">
            <h2 className="h3 fw-bold mb-3">Why we built it</h2>
            <p className="text-secondary mb-3">
              Job seekers keep their career story scattered across old resumes, profiles
              and notes, then rewrite it for every application. Matching tools often hand
              back a single percentage with no reason behind it.
            </p>
            <p className="text-secondary mb-0">
              UltraUnityVerse keeps one complete record of your work and builds everything
              else from it: resumes that fit the role and job matches that explain
              themselves, with the evidence attached.
            </p>
          </div>
          <div className="col-lg-6">
            <div className="row g-3">
              {VALUES.map((value) => (
                <div key={value.title} className="col-sm-6">
                  <div className="card h-100 uuv-service-card">
                    <div className="card-body p-3">
                      <div className="uuv-service-icon uuv-service-icon-sm mb-2">
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
          <h2 className="h3 fw-bold text-center mb-4">How it works</h2>
          <div className="row g-4">
            {STEPS.map(([title, text], index) => (
              <div key={title} className="col-12 col-sm-6 col-lg-3">
                <div className="uuv-step-number mb-3">{index + 1}</div>
                <h3 className="h6 fw-bold mb-1">{title}</h3>
                <p className="small text-secondary mb-0">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card uuv-service-card">
              <div className="card-body p-4 d-flex flex-column flex-sm-row align-items-sm-center gap-4">
                <div className="uuv-creator-avatar" aria-hidden="true">SU</div>
                <div>
                  <p className="small text-uppercase fw-semibold text-secondary mb-1">Created by</p>
                  <h2 className="h4 fw-bold mb-2">Sai Uday R Udumula</h2>
                  <p className="text-secondary mb-0">
                    UltraUnityVerse was designed and built by Sai Uday R Udumula, combining
                    full-stack engineering with AI agents to make career tools that are
                    useful and honest.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container pb-5">
        <div className="uuv-info-cta text-center p-4 p-md-5">
          <h2 className="h3 fw-bold mb-2">See what you can do</h2>
          <p className="mb-4 opacity-75">Explore the tools, or create your free account.</p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to="/services" className="btn btn-light px-4">Our services</Link>
            <Link to="/signup" className="btn btn-outline-light px-4">Get started</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
