import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner } from "react-bootstrap";

import { getMySessions, signOutOtherSessions } from "../../api/accountApi";
import { deviceName } from "./deviceName";

const when = (value) =>
  value ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

// Where this account is signed in right now
export default function SessionsPanel({ onLocked }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    getMySessions()
      .then(({ data }) => setSessions(data.sessions || []))
      .catch((err) => (err.response?.status === 423 ? onLocked() : setError("Unable to load sessions")));

  useEffect(() => {
    load();
    // Loads once when the tab opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOutOthers = async () => {
    setBusy(true);

    try {
      const { data } = await signOutOtherSessions();
      setNotice(`${data.ended} other session(s) signed out.`);
      await load();
    } catch (err) {
      if (err.response?.status === 423) onLocked();
      else setError("Unable to sign out other sessions");
    } finally {
      setBusy(false);
    }
  };

  if (!sessions) {
    return error ? <Alert variant="danger">{error}</Alert> : <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>;
  }

  const others = sessions.filter((session) => !session.isCurrent).length;

  return (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <h6 className="fw-semibold mb-0">
            <i className="bi bi-broadcast me-2 text-primary" />
            Signed in now
          </h6>
          <Button size="sm" variant="outline-danger" disabled={busy || others === 0} onClick={signOutOthers}>
            <i className="bi bi-box-arrow-right me-1" />
            Sign out all other devices
          </Button>
        </div>

        {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}
        {notice && <Alert variant="success" dismissible onClose={() => setNotice("")}>{notice}</Alert>}

        {sessions.length === 0 ? (
          <p className="small text-secondary mb-0">No sessions found.</p>
        ) : (
          sessions.map((session, index) => (
            <div key={session.handle} className={`d-flex gap-3 align-items-center py-2 ${index ? "border-top" : ""}`}>
              <i className={`bi ${/iOS|Android/.test(deviceName(session.userAgent)) ? "bi-phone" : "bi-laptop"} fs-5 text-secondary`} />
              <div className="flex-grow-1">
                <div className="fw-medium">
                  {deviceName(session.userAgent)}
                  {session.isCurrent && <Badge bg="success" className="ms-2 fw-normal">This device</Badge>}
                </div>
                <div className="small text-secondary">
                  Signed in {when(session.signedInAt)}
                  {session.ip && ` · ${session.ip}`} · expires {when(session.expires)}
                </div>
              </div>
            </div>
          ))
        )}
      </Card.Body>
    </Card>
  );
}
