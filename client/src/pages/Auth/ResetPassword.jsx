import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { checkResetToken, resetPassword } from "../../api/authApi";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Read once; the token is then removed from the address bar
  const [token] = useState(() => searchParams.get("token") || "");
  const [status, setStatus] = useState(token ? "checking" : "invalid");
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);

    let active = true;

    checkResetToken(token)
      .then(() => active && setStatus("ready"))
      .catch(() => active && setStatus("invalid"));

    return () => {
      active = false;
    };
  }, [token]);

  const updateField = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await resetPassword({ token, ...form });
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to reset your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <img src="/logo-icon.png" alt="UltraUnityVerse logo" width="64" height="64" className="d-block mx-auto mb-3" />
        <h1>Reset your password</h1>

        <p className="auth-subtitle">
          Back to{" "}
          <Link to="/login">Sign in</Link>
        </p>

        <div className="auth-card">
          {status === "checking" && (
            <p className="auth-message mb-0">Checking your reset link...</p>
          )}

          {status === "invalid" && (
            <div className="auth-message">
              <i className="bi bi-link-45deg text-danger" aria-hidden="true" />
              <p>This reset link is invalid or has expired. Links work once, for 60 minutes.</p>
              <Link className="primary-button mt-3" to="/forgot-password">
                Request a new link
              </Link>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit}>
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={updateField}
                autoComplete="new-password"
                minLength={12}
                maxLength={72}
                required
              />

              <label htmlFor="confirm-new-password">Confirm new password</label>
              <input
                id="confirm-new-password"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={updateField}
                autoComplete="new-password"
                required
              />

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show passwords
              </label>

              <p className="small text-muted">
                Use 12 to 72 characters. You'll be signed out on every device.
              </p>

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
                {loading ? "Saving..." : "Reset password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
