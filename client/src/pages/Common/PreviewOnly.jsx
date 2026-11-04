import { Link } from "react-router-dom";

import { publicUrl } from "../../staticSite";

// Shown on this public preview in place of pages that need the server
export default function PreviewOnly() {
  return (
    <main className="auth-page">
      <div className="auth-container">
        <img src={publicUrl("logo-icon.png")} alt="UltraUnityVerse logo" width="64" height="64" className="d-block mx-auto mb-3" />
        <h1>Not available in this preview</h1>
        <p className="auth-subtitle">
          This is the public preview of UltraUnityVerse. Accounts, portfolios and resumes need the full app with its server, which isn't running on this site.
        </p>
        <div className="d-flex gap-3 justify-content-center flex-wrap">
          <Link to="/services" className="btn btn-primary px-4">See what it does</Link>
          <Link to="/contact" className="btn btn-outline-secondary px-4">Contact us</Link>
        </div>
      </div>
    </main>
  );
}
