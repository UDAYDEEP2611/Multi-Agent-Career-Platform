import { useEffect, useState } from "react";
import { sendContactMessage } from "../../api/contactApi";
import { STATIC_SITE } from "../../staticSite";
import { CONTACT } from "./contactInfo";
import "./contact.css";

const EMPTY_FORM = { name: "", email: "", phone: "", message: "", website: "" };
const MAX_MESSAGE = 2000;

export default function Contact() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const set = (name) => (event) => setForm((previous) => ({ ...previous, [name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSending(true);

    try {
      await sendContactMessage(form);
      setForm(EMPTY_FORM);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="uuv-contact">
      <div className="uuv-contact-inner">
        <section className="uuv-contact-intro">
          <p className="uuv-contact-eyebrow">Contact Us</p>
          <h1 className="uuv-contact-title">How can we <span className="uuv-gradient-text">help?</span></h1>
          <p className="uuv-contact-lead">
            Tell us what you need, and we'll get back to you by email or phone.
          </p>

          <ul className="uuv-contact-ways">
            <li>
              <span className="uuv-contact-icon"><i className="bi bi-geo-alt" aria-hidden="true" /></span>
              <div>
                <span className="uuv-contact-label">Visit us</span>
                <a href={CONTACT.mapUrl} target="_blank" rel="noreferrer">
                  {CONTACT.addressLines.join(" ")}
                </a>
              </div>
            </li>
            <li>
              <span className="uuv-contact-icon"><i className="bi bi-telephone" aria-hidden="true" /></span>
              <div>
                <span className="uuv-contact-label">Call us</span>
                <a href={CONTACT.phoneUrl}>{CONTACT.phone}</a>
              </div>
            </li>
            <li>
              <span className="uuv-contact-icon"><i className="bi bi-envelope" aria-hidden="true" /></span>
              <div>
                <span className="uuv-contact-label">Email us</span>
                <a href={CONTACT.emailUrl}>{CONTACT.email}</a>
              </div>
            </li>
          </ul>
        </section>

        <section className="uuv-contact-card">
          {sent ? (
            <div className="uuv-contact-sent" role="status">
              <span className="uuv-contact-sent-icon"><i className="bi bi-check-lg" aria-hidden="true" /></span>
              <h2>Message received</h2>
              <p>Thanks for reaching out. We'll reply as soon as we can.</p>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setSent(false)}>
                Send another message
              </button>
            </div>
          ) : STATIC_SITE ? (
            <div className="uuv-contact-sent">
              <span className="uuv-contact-sent-icon"><i className="bi bi-chat-heart" aria-hidden="true" /></span>
              <h2>Get in touch</h2>
              <p>This public demo can't send messages from a form, but we'd love to hear from you directly.</p>
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <a href={CONTACT.emailUrl} className="btn uuv-signup-btn"><i className="bi bi-envelope me-2" aria-hidden="true" />Email us</a>
                <a href={CONTACT.phoneUrl} className="btn btn-outline-secondary"><i className="bi bi-telephone me-2" aria-hidden="true" />Call us</a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="uuv-contact-form-title">Send us a message</h2>

              {error && <div className="alert alert-danger" role="alert">{error}</div>}

              <div className="row g-3">
                <div className="col-12">
                  <label htmlFor="contact-name" className="form-label">Name</label>
                  <input
                    id="contact-name"
                    className="form-control"
                    value={form.name}
                    onChange={set("name")}
                    maxLength={100}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label htmlFor="contact-email" className="form-label">Email</label>
                  <input
                    id="contact-email"
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={set("email")}
                    maxLength={254}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label htmlFor="contact-phone" className="form-label">
                    Phone <span className="text-secondary fw-normal">(optional)</span>
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    className="form-control"
                    value={form.phone}
                    onChange={set("phone")}
                    maxLength={25}
                    autoComplete="tel"
                  />
                </div>
                <div className="col-12">
                  <label htmlFor="contact-message" className="form-label">What do you need help with?</label>
                  <textarea
                    id="contact-message"
                    className="form-control"
                    rows={6}
                    value={form.message}
                    onChange={set("message")}
                    minLength={10}
                    maxLength={MAX_MESSAGE}
                    placeholder="Describe what you need, with any details that might help."
                    required
                  />
                  <div className="form-text text-end">{form.message.length}/{MAX_MESSAGE}</div>
                </div>

                {/* Left empty by people; bots tend to fill in every field */}
                <div className="uuv-contact-trap" aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={set("website")}
                  />
                </div>
              </div>

              <button type="submit" className="btn uuv-signup-btn w-100 mt-4" disabled={sending}>
                {sending ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Sending...</>
                ) : (
                  <><i className="bi bi-send me-2" aria-hidden="true" />Send message</>
                )}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
