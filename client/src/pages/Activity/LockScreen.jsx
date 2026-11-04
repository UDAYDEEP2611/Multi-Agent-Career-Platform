import { useState } from "react";
import { Alert, Button, Card, Form } from "react-bootstrap";

import { unlockActivity } from "../../api/accountApi";

// Shown while the activity log is locked: the account password opens it
export default function LockScreen({ unlockMinutes, onUnlocked }) {
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
          It shows your changes, sign-ins, sessions and storage. Enter your
          password to open it for {unlockMinutes} minutes.
        </p>

        {error && <Alert variant="danger" className="text-start small">{error}</Alert>}

        <Form onSubmit={submit} className="text-start">
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
        </Form>
      </Card.Body>
    </Card>
  );
}
