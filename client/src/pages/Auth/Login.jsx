
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { loginUser } from "../../api/authApi";
import GoogleSignIn from "./GoogleSignIn";

export default function Login() {
  const navigate = useNavigate();
  const { state } = useLocation();

  // Set by the sign-up and reset password pages
  const notice = state?.registered
    ? "Account created. Sign in to continue."
    : state?.passwordReset
      ? "Your password has been reset. Sign in with your new password."
      : "";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginUser({ identifier, password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <img src="/logo-icon.png" alt="UltraUnityVerse logo" width="64" height="64" className="d-block mx-auto mb-3" />
        <h1>Welcome back</h1>

        <p className="auth-subtitle">
          Don't have an account?{" "}
          <Link to="/signup">Sign up</Link>
        </p>

        <div className="auth-card">
          {notice && (
            <p className="auth-success" role="status">
              {notice}
            </p>
          )}

          <GoogleSignIn dividerText="Or continue with username/email" text="signin_with" />

          <form onSubmit={handleSubmit}>
            <label htmlFor="identifier">
              Username or email address
            </label>

            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />

            <div className="password-label">
              <label htmlFor="password">Password</label>

              <button
                type="button"
                className="text-button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <>
                    <EyeOff size={15} /> Hide
                  </>
                ) : (
                  <>
                    <Eye size={15} /> Show
                  </>
                )}
              </button>
            </div>

            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <Link className="forgot-link" to="/forgot-password">
              Forgot your password?
            </Link>

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
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
