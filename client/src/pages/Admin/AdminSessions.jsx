import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner, Table } from "react-bootstrap";

import AdminPage from "./AdminPage";
import { formatDateTime, formatRelative } from "./adminFormat";
import { getAdminSessions, endAdminSession, cleanExpiredSessions } from "../../api/adminApi";

export default function AdminSessions() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = () =>
    getAdminSessions()
      .then(({ data }) => setSessions(data.sessions || []))
      .catch((err) => setError(err.response?.data?.message || "Unable to load sessions"));

  useEffect(() => {
    load();
  }, []);

  const end = async (session) => {
    setBusy(session.handle);

    try {
      await endAdminSession(session.handle);
      setSessions((previous) => previous.filter((item) => item.handle !== session.handle));
      setNotice(`Session for ${session.user?.username || "visitor"} ended.`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to end session");
    } finally {
      setBusy("");
    }
  };

  const clean = async () => {
    setBusy("clean");

    try {
      const { data } = await cleanExpiredSessions();
      setNotice(`${data.removed} expired session(s) removed.`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to remove expired sessions");
    } finally {
      setBusy("");
    }
  };

  return (
    <AdminPage
      title="Sessions"
      description="Who is signed in right now. Ending a session signs that device out."
      actions={
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={load} disabled={!!busy}>
            <i className="bi bi-arrow-clockwise me-1" />Refresh
          </Button>
          <Button variant="outline-secondary" onClick={clean} disabled={!!busy}>
            <i className="bi bi-trash3 me-1" />Remove expired
          </Button>
        </div>
      }
    >
      {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert variant="success" dismissible onClose={() => setNotice("")}>{notice}</Alert>}

      {!sessions ? (
        !error && <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>User</th>
                  <th>Session</th>
                  <th>Expires</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.handle}>
                    <td>
                      {session.user ? (
                        <>
                          <div className="fw-medium">
                            {session.user.username}
                            {session.user.role === "admin" && <Badge bg="primary" className="ms-2 fw-normal">Admin</Badge>}
                            {session.isCurrent && <Badge bg="secondary" className="ms-2 fw-normal">This session</Badge>}
                          </div>
                          <div className="small text-secondary">{session.user.email}</div>
                        </>
                      ) : (
                        <span className="text-secondary">Not signed in</span>
                      )}
                    </td>
                    <td><code className="small">{session.handle}</code></td>
                    <td className="small">
                      <div>{formatRelative(session.expires)}</div>
                      <div className="text-secondary">{formatDateTime(session.expires)}</div>
                    </td>
                    <td className="text-end">
                      {session.isCurrent ? (
                        <span className="small text-secondary">Use Log out</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          disabled={busy === session.handle}
                          onClick={() => end(session)}
                        >
                          End session
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}

                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">No active sessions.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      <p className="small text-secondary mt-3">
        <i className="bi bi-info-circle me-1" />
        Sessions last 24 hours. The code shown is a one-way fingerprint, not the
        session ID itself, so it can't be used to sign in.
      </p>
    </AdminPage>
  );
}
