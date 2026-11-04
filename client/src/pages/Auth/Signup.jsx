
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../../api/authApi";
import GoogleSignIn from "./GoogleSignIn";
import { publicUrl } from "../../staticSite";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateField = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value
    });
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
      await registerUser(form);

      // Registration doesn't create a login session yet.
      navigate("/login", {
        replace: true,
        state: { registered: true }
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to create account."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <img src={publicUrl("logo-icon.png")} alt="UltraUnityVerse logo" width="64" height="64" className="d-block mx-auto mb-3" />
        <h1>Create your account</h1>

        <p className="auth-subtitle">
          Already have an account?{" "}
          <Link to="/login">Sign in</Link>
        </p>

        <div className="auth-card">
          <GoogleSignIn dividerText="Or sign up with email" text="signup_with" />

          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              value={form.username}
              onChange={updateField}
              autoComplete="username"
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              required
            />

            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              autoComplete="email"
              required
            />

            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={updateField}
              autoComplete="new-password"
              minLength={12}
              required
            />

            <label htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
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
                onChange={(e) =>
                  setShowPassword(e.target.checked)
                }
              />
              Show passwords
            </label>

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
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
