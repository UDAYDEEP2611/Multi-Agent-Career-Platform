import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { STATUSES, canRetry } from "./errorStatuses";
import "./errorPage.css";
import { publicUrl } from "../../staticSite";

// Sits inside the app layout, so the navbar and footer stay on the page
export default function ErrorPage({ code = 404 }) {
  const navigate = useNavigate();
  const { title, message } = STATUSES[code];

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${code} ${title} · UltraUnityVerse`;
    return () => {
      document.title = previousTitle;
    };
  }, [code, title]);

  return (
    <main className="uuv-error">
      <div className="uuv-error-brand">
        <img src={publicUrl("logo-icon.png")} alt="" className="uuv-error-logo" width="96" height="96" />
        <span className="uuv-error-company">UltraUnityVerse</span>
      </div>

      <p className="uuv-error-code uuv-gradient-text">{code}</p>
      <h1 className="uuv-error-title">{title}</h1>
      <p className="uuv-error-message">{message}</p>

      <div className="uuv-error-actions">
        {code === 401 ? (
          <Link to="/login" className="btn uuv-signup-btn px-4">
            <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true"></i>Log in
          </Link>
        ) : canRetry(code) ? (
          <button type="button" className="btn uuv-signup-btn px-4" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-clockwise me-2" aria-hidden="true"></i>Try again
          </button>
        ) : (
          <button type="button" className="btn uuv-signup-btn px-4" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left me-2" aria-hidden="true"></i>Go back
          </button>
        )}
        <Link to="/" className="btn btn-outline-secondary px-4">
          <i className="bi bi-house me-2" aria-hidden="true"></i>Back to home
        </Link>
      </div>
    </main>
  );
}

// /403, /503 and so on; anything that isn't a known status code is a 404
export function StatusRoute() {
  const { code } = useParams();
  return <ErrorPage code={STATUSES[code] ? Number(code) : 404} />;
}
