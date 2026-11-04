import { useState } from "react";
import { Alert, Button, Card, Form } from "react-bootstrap";

import { unlockActivity, unlockActivityWithGoogle } from "../../api/accountApi";
import GoogleButton from "../Auth/GoogleButton";
import { useGoogleClientId } from "../Auth/useGoogleClientId";

// Shown while the activity log is locked: the account password, or the
// connected Google account, opens it
export default function LockScreen({ unlockMinutes, hasPassword = true, hasGoogle = false, onUnlocked }) {
  const clientId = useGoogleClientId();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const { data } = await unlockActivity(password);
      setPassword("");
      onUnlocked(data.unlockedUntil);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to unlock");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  const confirmWithGoogle = async (credential) => {
    setBusy(true);
    setError("");

    try {
      const { data } = await unlockActivityWithGoogle(credential);
      onUnlocked(data.unlockedUntil);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to unlock");
    } finally {
      setBusy(false);
    }
  };

  const showGoogle = hasGoogle && Boolean(clientId);

  return (
    <Card className="border-0 shadow-sm mx-auto" style={{ maxWidth: 440 }}>
      <Card.Body className="p-4 p-md-5 text-center">
        <div
          className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center mb-3"
          style={{ width: 72, height: 72 }}
        >
          <i className="bi bi-lock-fill fs-2" />
        </div>

        <h5 className="fw-semibold mb-2">Your activity log is locked</h5>
        <p className="text-secondary small mb-4">
          It shows your changes, sign-ins, sessions and storage.{" "}
          {hasPassword ? "Enter your password" : "Confirm with Google"} to open it for {unlockMinutes} minutes.
        </p>

        {error && <Alert variant="danger" className="text-start small">{error}</Alert>}

        {showGoogle && (
          <div className={hasPassword ? "mb-3" : ""}>
            <GoogleButton clientId={clientId} text="continue_with" onCredential={confirmWithGoogle} onError={setError} />
          </div>
        )}

        {!hasPassword && !showGoogle && (
          <Alert variant="warning" className="text-start small mb-0">
            Google sign-in isn't available right now. Set a password from your account menu to open your activity log.
          </Alert>
        )}

        {hasPassword && <Form onSubmit={submit} className="text-start">
          <Form.Group className="mb-4" controlId="unlock-password">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              autoFocus
            />
          </Form.Group>

          <Button type="submit" className="w-100" disabled={busy}>
            <i className="bi bi-unlock me-2" />
            {busy ? "Checking..." : "Unlock"}
          </Button>
        </Form>}
      </Card.Body>
    </Card>
  );
}
