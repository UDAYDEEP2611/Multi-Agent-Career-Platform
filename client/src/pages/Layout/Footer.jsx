import { useState } from "react";
import { Link } from "react-router-dom";
import { subscribeToUpdates } from "../../api/contactApi";
import { CONTACT } from "../Contact/contactInfo";
import { SERVICES } from "../Info/servicesData";
import { CvMakerIcon, JobPilotIcon } from "./FeatureIcons";
import "./footer.css";
import { DEMO_FORMS, publicUrl, STATIC_SITE } from "../../staticSite";

const TOOL_LINKS = [
  ["My Portfolios", "/dashboard/portfolios", "bi-easel"],
  ["My Resumes", "/dashboard/resumes", "bi-file-earmark-richtext"],
  ["CV Maker", "/dashboard/resume", <CvMakerIcon key="cv" />],
  ["JobPilot", "/dashboard/resume-match", <JobPilotIcon key="pilot" />],
  ["Log Book", "/dashboard/resume-match/logs", "bi-journal-text"]
];

const COMPANY_LINKS = [
  ["About", "/about", "bi-info-circle"],
  ["Services", "/services", "bi-grid-1x2"],
  ["Contact Us", "/contact", "bi-headset"],
  ["Source code", CONTACT.githubUrl, "bi-github"]
];

const SERVICE_LINKS = SERVICES.map((service) => [service.title, `/services#${service.id}`, service.icon]);

function LinkColumn({ title, links }) {
  return (
    <nav aria-label={title}>
      <h2 className="uuv-footer-heading"><span aria-hidden="true">//</span>{title}</h2>
      <ul className="uuv-footer-list">
        {links.map(([label, to, icon]) => {
          const content = (
            <>
              <span className="uuv-footer-link-icon" aria-hidden="true">
                {typeof icon === "string" ? <i className={`bi ${icon}`}></i> : icon}
              </span>
              {label}
            </>
          );
          return (
            <li key={label}>
              {to.startsWith("http")
                ? <a href={to} target="_blank" rel="noreferrer" className="uuv-footer-link">{content}</a>
                : <Link to={to} className="uuv-footer-link">{content}</Link>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Subscribe() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState({ text: "", failed: false });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSending(true);
    setNote({ text: "", failed: false });

    try {
      await subscribeToUpdates({ email, website });
      setEmail("");
      setNote({ text: "You're subscribed. Thanks for joining us!", failed: false });
    } catch (err) {
      setNote({ text: err.response?.data?.message || "We couldn't subscribe you. Please try again.", failed: true });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h2 className="uuv-footer-heading"><span aria-hidden="true">//</span>Subscribe</h2>
      <p className="uuv-footer-subscribe-title">Want to know more?</p>
      <p className="uuv-footer-subscribe-text">Subscribe with your email to hear about what's new.</p>
      <form className="uuv-footer-subscribe" onSubmit={handleSubmit}>
        <i className="bi bi-envelope uuv-footer-subscribe-icon" aria-hidden="true"></i>
        <label htmlFor="footer-email" className="visually-hidden">Your email address</label>
        <input
          id="footer-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          maxLength={254}
          autoComplete="email"
          required
        />
        {/* Left empty by people; bots tend to fill in every field */}
        <input
          className="uuv-footer-trap"
          aria-hidden="true"
          tabIndex={-1}
          autoComplete="off"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
        <button type="submit" aria-label="Subscribe" disabled={sending}>
          <i className={`bi ${sending ? "bi-hourglass-split" : "bi-arrow-up-right"}`} aria-hidden="true"></i>
        </button>
      </form>
      <p className={`uuv-footer-subscribe-note${note.failed ? " is-failed" : ""}`} role="status">{note.text}</p>
    </div>
  );
}

// In a GitHub Pages build with nowhere to keep sign-ups
function TryIt() {
  return (
    <div>
      <h2 className="uuv-footer-heading"><span aria-hidden="true">//</span>Try it</h2>
      <p className="uuv-footer-subscribe-title">See it in action.</p>
      <p className="uuv-footer-subscribe-text">Open a demo account and try the AI agents, resume designs and JobPilot. No sign-up needed.</p>
      <div className="uuv-footer-try">
        <Link to="/login" className="btn uuv-signup-btn btn-sm px-3">
          <i className="bi bi-play-fill me-1" aria-hidden="true"></i>Try the demo
        </Link>
        <a href={CONTACT.githubUrl} target="_blank" rel="noreferrer" className="uuv-footer-try-link">
          <i className="bi bi-github me-1" aria-hidden="true"></i>View the code
        </a>
      </div>
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="uuv-footer d-print-none" data-bs-theme="dark">
      <div className="uuv-footer-inner">
        <div className="uuv-footer-top uuv-footer-row">
          <Link to="/" className="uuv-footer-brand">
            <img src={publicUrl("logo-icon.png")} alt="" width="36" height="36" />
            UltraUnityVerse
          </Link>
          <p className="uuv-footer-slogan">Your Career, Unified</p>
        </div>

        <div className="uuv-footer-hero uuv-footer-row">
          <div>
            <p className="uuv-footer-title h1">Start your journey with us.</p>
            <p className="uuv-footer-intro">
              Build your portfolio once, turn it into tailored resumes, and see
              how well you fit every job, with evidence you can trust.
            </p>
            <Link to="/signup" className="btn uuv-signup-btn px-4 py-2">
              Get started free<i className="bi bi-arrow-up-right ms-2" aria-hidden="true"></i>
            </Link>
          </div>

          <dl className="uuv-footer-reach">
            <div>
              <dt><i className="bi bi-geo-alt-fill" aria-hidden="true"></i>Location</dt>
              <dd>
                <a href={CONTACT.mapUrl} target="_blank" rel="noreferrer">
                  {CONTACT.addressLines[0]}<br />{CONTACT.addressLines[1]}
                </a>
              </dd>
            </div>
            <div>
              <dt><i className="bi bi-telephone-fill" aria-hidden="true"></i>Call us</dt>
              <dd><a href={CONTACT.phoneUrl}>{CONTACT.phone}</a></dd>
            </div>
            <div>
              <dt><i className="bi bi-envelope-fill" aria-hidden="true"></i>Email us</dt>
              <dd><a href={CONTACT.emailUrl}>{CONTACT.email}</a></dd>
            </div>
            <div>
              <dt><i className="bi bi-headset" aria-hidden="true"></i>Need help?</dt>
              <dd>
                <Link to="/contact">
                  Tell us what you need<i className="bi bi-arrow-up-right ms-2" aria-hidden="true"></i>
                </Link>
              </dd>
            </div>
          </dl>
        </div>

        <div className="uuv-footer-links uuv-footer-row">
          <LinkColumn title="Services" links={SERVICE_LINKS} />
          <LinkColumn title="Tools" links={TOOL_LINKS} />
          <LinkColumn title="Company" links={COMPANY_LINKS} />
          {STATIC_SITE && !DEMO_FORMS ? <TryIt /> : <Subscribe />}
        </div>

        <div className="uuv-footer-bottom">
          <p>© {year} UltraUnityVerse. All rights reserved.</p>
          <div className="uuv-footer-social">
            <a href={CONTACT.mapUrl} target="_blank" rel="noreferrer" aria-label="Find us on the map"><i className="bi bi-geo-alt-fill" aria-hidden="true"></i></a>
            <a href={CONTACT.phoneUrl} aria-label="Call us"><i className="bi bi-telephone-fill" aria-hidden="true"></i></a>
            <a href={CONTACT.emailUrl} aria-label="Email us"><i className="bi bi-envelope-fill" aria-hidden="true"></i></a>
            <a href={CONTACT.githubUrl} target="_blank" rel="noreferrer" aria-label="UltraUnityVerse on GitHub"><i className="bi bi-github" aria-hidden="true"></i></a>
          </div>
          <p className="uuv-footer-credit">Created by <span className="uuv-footer-author">UltraUnityVerse Core</span></p>
        </div>
      </div>
    </footer>
  );
}
