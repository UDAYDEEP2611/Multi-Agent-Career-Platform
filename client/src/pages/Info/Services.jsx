import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { STATIC_SITE } from "../../staticSite";
import { SERVICES } from "./servicesData";

const FLOW = [
  ["bi-person-badge", "Portfolio", "Your one career record"],
  ["bi-palette", "Designs", "Portfolio and resume looks"],
  ["bi-file-earmark-person", "CV Maker", "A resume for each job"],
  ["bi-bullseye", "JobPilot", "Match, evidence and rewrites"]
];

const FAQ = [
  ["Does the AI make things up?", "No. Rewritten text is checked against your portfolio, and a line that adds a number or a name you never wrote is rejected. JobPilot's rewrites only name skills your work already shows."],
  ["Does it work without AI?", "Yes. Rules and small trained models keep the assistant, CV Maker and JobPilot working when no language model is running. AI makes the writing better, not possible."],
  ["What can I upload to JobPilot?", "A resume as a PDF, DOCX, RTF or TXT file, plus the job description as text. Each result stays in your Log Book for 72 hours."],
  ["Can I undo what the assistant changed?", "Yes. Each chat message's changes are recorded together, and one click puts back what they replaced."]
];

export default function Services() {
  const { hash } = useLocation();

  // Footer links point at a service: scroll to it once the page is drawn
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <main className="uuv-info-page">
      <section className="uuv-info-hero text-center">
        <div className="container">
          <p className="uuv-slogan mb-2">Services</p>
          <h1 className="display-5 fw-bold mb-3">
            Everything you need to <span className="uuv-gradient-text">land the right role</span>
          </h1>
          <p className="lead text-secondary col-lg-8 mx-auto mb-4">
            From one portfolio to tailored resumes and honest job matching. Every tool
            builds on the same career record, so nothing has to be typed twice.
          </p>
          <nav className="uuv-info-chips" aria-label="Services on this page">
            {SERVICES.map((service) => (
              <a key={service.id} href={`#${service.id}`} onClick={(event) => {
                event.preventDefault();
                document.getElementById(service.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>
                <i className={`bi ${service.icon}`} aria-hidden="true"></i>{service.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="container py-5">
        <h2 className="h4 fw-bold text-center mb-4">One record, every tool</h2>
        <ol className="uuv-info-flow list-unstyled mb-0">
          {FLOW.map(([icon, title, text]) => (
            <li key={title}>
              <div className="uuv-service-icon uuv-service-icon-sm" aria-hidden="true"><i className={`bi ${icon}`}></i></div>
              <div>
                <p className="fw-bold mb-0">{title}</p>
                <p className="small text-secondary mb-0">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container pb-5">
        {SERVICES.map((service, index) => (
          <article key={service.id} id={service.id} className={`uuv-service-row${index % 2 ? " is-flipped" : ""}`}>
            <div className="uuv-service-copy">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="uuv-service-icon" aria-hidden="true"><i className={`bi ${service.icon}`}></i></div>
                <div>
                  <p className="uuv-service-index mb-0">{String(index + 1).padStart(2, "0")}</p>
                  <h2 className="h4 fw-bold mb-0">{service.title}</h2>
                </div>
              </div>
              <p className="uuv-service-short mb-2">{service.short}</p>
              <p className="text-secondary mb-3">{service.description}</p>
              <ul className="uuv-service-features list-unstyled mb-4">
                {service.features.map((feature) => (
                  <li key={feature}>
                    <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {!service.to.startsWith("/services") && (
                <Link to={service.to} className="btn btn-outline-primary btn-sm">
                  Open {service.title} <i className="bi bi-arrow-right ms-1" aria-hidden="true"></i>
                </Link>
              )}
            </div>
            <div className="uuv-service-visual" aria-hidden="true">
              <i className={`bi ${service.icon} uuv-service-visual-icon`}></i>
              <p className="uuv-service-stat mb-0">{service.stat[0]}</p>
              <p className="uuv-service-stat-label">{service.stat[1]}</p>
              <p className="uuv-service-example mb-0">{service.example}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="uuv-info-band py-5">
        <div className="container">
          <h2 className="h3 fw-bold text-center mb-4">Questions people ask</h2>
          <div className="uuv-info-faq mx-auto">
            {FAQ.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p className="text-secondary mb-0">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="uuv-info-cta text-center p-4 p-md-5">
          <h2 className="h3 fw-bold mb-2">Ready to bring your career together?</h2>
          <p className="mb-4 opacity-75">
            {STATIC_SITE ? "Open a demo account and try every tool. No sign-up needed." : "Create a free account and start with your portfolio."}
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to="/signup" className="btn btn-light px-4">{STATIC_SITE ? "Try the demo" : "Get started free"}</Link>
            <Link to="/about" className="btn btn-outline-light px-4">About us</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
