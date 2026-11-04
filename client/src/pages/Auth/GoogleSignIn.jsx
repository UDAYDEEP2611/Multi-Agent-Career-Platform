import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { googleSignIn } from "../../api/authApi";
import GoogleButton from "./GoogleButton";
import { useGoogleClientId } from "./useGoogleClientId";

// "Continue with Google" on the sign-in and sign-up pages. If the email already
// has a password account, that password is asked for once to connect Google.
export default function GoogleSignIn({ dividerText, text }) {
  const navigate = useNavigate();
  const clientId = useGoogleClientId();
  const [connect, setConnect] = useState(null); // { credential, email }
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signIn = async (credential, typed) => {
    setBusy(true);
    setError("");
    try {
      await googleSignIn({ credential, password: typed });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const reply = err.response?.data;
      if (reply?.needsPassword) setConnect({ credential, email: reply.email });
      // A wrong password shows its reason; the first ask explains itself
      setError(reply?.needsPassword && !typed ? "" : reply?.message || "Unable to sign in with Google. Please try again.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  if (!clientId) return null;

  if (connect) {
    return (
      <>
        <form
          className="google-connect"
          onSubmit={(event) => {
            event.preventDefault();
            signIn(connect.credential, password);
          }}
        >
          <p className="google-connect-note">
            <strong>{connect.email}</strong> already has an account here. Enter its password once to connect Google to it.
          </p>
          <label htmlFor="google-connect-password">Password</label>
          <input
            id="google-connect-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            autoFocus
          />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Connecting..." : "Connect Google and sign in"}
          </button>
          <button
            type="button"
            className="text-button google-connect-cancel"
            onClick={() => {
              setConnect(null);
              setError("");
            }}
          >
            Cancel
          </button>
        </form>
        <div className="auth-divider"><span>{dividerText}</span></div>
      </>
    );
  }

  return (
    <>
      <GoogleButton clientId={clientId} text={text} onCredential={(credential) => signIn(credential)} onError={setError} />
      {busy && <p className="google-connect-note" role="status">Signing in...</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="auth-divider"><span>{dividerText}</span></div>
    </>
  );
}
