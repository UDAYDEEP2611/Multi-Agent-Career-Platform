import { Link } from "react-router-dom";
import { publicUrl, STATIC_SITE } from "../../staticSite";

// Welcome page for visitors who aren't signed in
export default function GuestHome() {
  return (
    <div className="col-lg-8 mx-auto text-center">
      <img
        src={publicUrl("logo-icon.png")}
        alt="UltraUnityVerse logo"
        width="140"
        height="140"
        className="mb-4"
      />

      <h1 className="display-4 fw-bold mb-2">
        Welcome to{" "}
        <span className="uuv-gradient-text">
          UltraUnityVerse
        </span>
      </h1>

      <p className="uuv-slogan mb-4">Your Career, Unified</p>

      <p className="lead text-secondary mb-4">
        Build and manage professional portfolios
        tailored to your career goals, powered by
        intelligent AI workflows.
      </p>

      <div className="d-flex gap-3 justify-content-center flex-wrap">
        {STATIC_SITE ? (
          <>
            <Link to="/services" className="btn btn-primary btn-lg px-4">See what it does</Link>
            <Link to="/contact" className="btn btn-outline-secondary btn-lg px-4">Contact us</Link>
          </>
        ) : (
          <>
            <Link to="/signup" className="btn btn-primary btn-lg px-4">
              Get Started
            </Link>

            <Link to="/login" className="btn btn-outline-secondary btn-lg px-4">
              Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
