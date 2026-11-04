import { Link } from "react-router-dom";
import { SERVICES } from "../Info/servicesData";

const PORTFOLIO_LINKS = [
  ["Profile", "/dashboard/profile"],
  ["Experience", "/dashboard/experience"],
  ["Education", "/dashboard/education"],
  ["Projects", "/dashboard/projects"],
  ["Skills", "/dashboard/skills"],
  ["Certifications", "/dashboard/certifications"],
  ["Achievements", "/dashboard/achievements"]
];

const COMPANY_LINKS = [
  ["About", "/about"],
  ["Services", "/services"],
  ["Create an account", "/signup"],
  ["Sign in", "/login"]
];

function LinkColumn({ title, links }) {
  return (
    <div className="col-6 col-md-4 col-lg-2">
      <h6 className="uuv-footer-heading">{title}</h6>
      <ul className="list-unstyled mb-0">
        {links.map(([label, to]) => (
          <li key={label} className="mb-2">
            <Link to={to} className="uuv-footer-link">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="uuv-footer d-print-none" data-bs-theme="dark">
      <div className="container-fluid px-3 px-lg-5 pt-5 pb-3">
        <div className="row g-4 pb-4">
          <div className="col-12 col-lg-4 pe-lg-5">
            <Link to="/" className="d-inline-flex align-items-center gap-2 text-decoration-none mb-3">
              <img src="/logo-icon.png" alt="" width="32" height="32" />
              <span className="uuv-footer-brand">UltraUnityVerse</span>
            </Link>
            <p className="uuv-footer-slogan mb-2">Your Career, Unified</p>
            <p className="uuv-footer-text uuv-footer-intro mb-4">
              Build your portfolio once, turn it into tailored resumes, and see
              how well you fit every job, with evidence you can trust.
            </p>
            <Link to="/signup" className="btn uuv-signup-btn btn-sm px-4">
              Get started free
            </Link>
          </div>

          <div className="col-12 col-md-4 col-lg-4">
            <h6 className="uuv-footer-heading">Services</h6>
            <ul className="list-unstyled mb-0 uuv-footer-services">
              {SERVICES.map((service) => (
                <li key={service.id} className="mb-2">
                  <Link to={`/services#${service.id}`} className="uuv-footer-link">
                    <i className={`bi ${service.icon} me-2`} aria-hidden="true"></i>
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <LinkColumn title="Portfolio" links={PORTFOLIO_LINKS} />
          <LinkColumn title="Company" links={COMPANY_LINKS} />
        </div>

        <div className="uuv-footer-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pt-4">
          <p className="mb-0 uuv-footer-text">
            © {year} UltraUnityVerse. All rights reserved.
            <span className="mx-2 d-none d-sm-inline">·</span>
            <span className="d-block d-sm-inline">
              Created by <span className="uuv-footer-author">Sai Uday R Udumula</span>
            </span>
          </p>
          <div className="d-flex flex-wrap gap-3">
            <Link to="/about" className="uuv-footer-link small">About</Link>
            <Link to="/services" className="uuv-footer-link small">Services</Link>
            <span className="uuv-footer-text small">
              <i className="bi bi-heart-fill text-danger me-1" aria-hidden="true"></i>
              Built with React, Express &amp; AI agents
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
