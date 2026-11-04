import { useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";

// Confirmation for actions that can't be undone: the admin types `phrase`
// (a username or database name) before the button enables.
export default function ConfirmTypedModal({ show, title, children, phrase, actionLabel, onConfirm, onHide }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");

    try {
      await onConfirm(typed);
      onHide();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to complete the action");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      show={show}
      onShow={() => {
        setTyped("");
        setError("");
      }}
      onHide={busy ? undefined : onHide}
      centered
    >
      <Modal.Header closeButton={!busy}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="mb-3">{children}</div>
        <Form.Label className="small">
          Type <code>{phrase}</code> to confirm
        </Form.Label>
        <Form.Control
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoFocus
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" disabled={busy} onClick={onHide}>Cancel</Button>
        <Button variant="danger" disabled={busy || typed !== phrase} onClick={confirm}>
          {busy ? "Working..." : actionLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
