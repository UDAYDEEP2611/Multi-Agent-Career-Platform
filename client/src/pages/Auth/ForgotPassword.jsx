import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../api/authApi";
import { publicUrl } from "../../staticSite";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await requestPasswordReset(email);
      setSent(data.message);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to send the reset email. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <img src={publicUrl("logo-icon.png")} alt="UltraUnityVerse logo" width="64" height="64" className="d-block mx-auto mb-3" />
        <h1>Forgot password?</h1>

        <p className="auth-subtitle">
          Remembered it?{" "}
          <Link to="/login">Sign in</Link>
        </p>

        <div className="auth-card">
          {sent ? (
            <div className="auth-message">
              <i className="bi bi-envelope-check text-primary" aria-hidden="true" />
              <p>{sent}</p>
              <p className="text-muted small mb-4">The link expires in 60 minutes.</p>
              <button type="button" className="text-button mx-auto" onClick={() => setSent("")}>
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="small text-muted">
                Enter the email address for your account and we'll send you a link to reset your password.
              </p>

              <label htmlFor="reset-email">Email address</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
