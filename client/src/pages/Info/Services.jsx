import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { SERVICES } from "./servicesData";

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
          <p className="lead text-secondary col-lg-8 mx-auto mb-0">
            From one portfolio to tailored resumes and honest job matching. Each tool
            builds on the same career record, so nothing has to be typed twice.
          </p>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-4">
          {SERVICES.map((service) => (
            <div key={service.id} className="col-12 col-md-6 col-xl-4">
              <article id={service.id} className="card h-100 uuv-service-card">
                <div className="card-body p-4 d-flex flex-column">
                  <div className="uuv-service-icon mb-3">
                    <i className={`bi ${service.icon}`} aria-hidden="true"></i>
                  </div>
                  <h2 className="h5 fw-bold mb-1">{service.title}</h2>
                  <p className="text-primary-emphasis small fw-semibold mb-3">{service.short}</p>
                  <p className="text-secondary mb-3">{service.description}</p>
                  <ul className="list-unstyled small mb-4">
                    {service.features.map((feature) => (
                      <li key={feature} className="d-flex gap-2 mb-2">
                        <i className="bi bi-check-circle-fill text-success" aria-hidden="true"></i>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {!service.to.startsWith("/services") && (
                    <Link to={service.to} className="btn btn-outline-primary btn-sm mt-auto align-self-start">
                      Open {service.title} <i className="bi bi-arrow-right ms-1" aria-hidden="true"></i>
                    </Link>
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>
      </section>

      <section className="container pb-5">
        <div className="uuv-info-cta text-center p-4 p-md-5">
          <h2 className="h3 fw-bold mb-2">Ready to bring your career together?</h2>
          <p className="mb-4 opacity-75">Create a free account and start with your portfolio.</p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to="/signup" className="btn btn-light px-4">Get started</Link>
            <Link to="/about" className="btn btn-outline-light px-4">About us</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
